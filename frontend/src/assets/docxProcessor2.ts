import { patchDocument, PatchType, TextRun } from 'docx'
import { filesystem, os, resources, window as neuWindow } from '@neutralinojs/lib'

// Типы для входных данных и результатов
interface Specification {
  [key: string]: { SN?: string }
}

interface FileEntry {
  type: string
  entry: string
  path: string
}

interface Product {
  specification: Specification
}

// Конфигурация
const CONFIG = {
  tmpDir: `${window.NL_PATH}/.tmp`,
  vbsScriptName: 'convert.ps1',
  passportDir: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта',
  searchKey: 'плата 2'
} as const

// Получение текущей даты в формате MM.YYYY
const getCurrentMonthYear = (): string => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = now.getFullYear()
  return `${month}.${year}`
}

// Нормализация пути для Windows
const normalizePath = (path: string): string => path.replace(/^\/\//, '\\\\').replace(/\//g, '\\')

// Чтение серийного номера с обрезкой последних 3 символов
const getSerialNumber = (specification: Specification): string => {
  const result = Object.entries(specification).find(([key]) => key.includes(CONFIG.searchKey))
  const snValue = result?.[1]?.SN
  return snValue && snValue.length >= 3 ? snValue.slice(0, -3) : snValue || ''
}

// Поиск файла в директории по partNumber
const findFileByPartNumber = async (partNumber: string): Promise<FileEntry> => {
  try {
    const dirEntries = await filesystem.readDirectory(CONFIG.passportDir)
    const file = dirEntries.find((item) => item.type === 'FILE' && item.entry.includes(partNumber))
    if (!file) {
      throw new Error(`Файл с partNumber "${partNumber}" не найден`)
    }
    return file
  } catch (error) {
    const err = error as Error
    throw new Error(`Ошибка при поиске файла: ${err.message}`)
  }
}

// Патч .docx файла
const patchDocx = async (fileData: ArrayBuffer, serialNumber: string): Promise<ArrayBuffer> => {
  try {
    const patches = {
      serialnumber: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(serialNumber)]
      },
      currentdate: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(getCurrentMonthYear())]
      }
    }
    return await patchDocument({
      outputType: 'arraybuffer',
      data: fileData,
      patches
    })
  } catch (error) {
    const err = error as Error
    throw new Error(`Ошибка при патче документа: ${err.message}`)
  }
}

// Сохранение пропатченного файла с временным именем
const savePatchedFile = async (fileName: string, data: ArrayBuffer): Promise<string> => {
  try {
    const tempFileName = `temp_${Date.now()}.docx`
    const outputPath = `${CONFIG.tmpDir}/${tempFileName}`
    await filesystem.writeBinaryFile(outputPath, data)
    console.log(`Файл успешно сохранен: ${outputPath}`)
    return tempFileName
  } catch (error) {
    const err = error as Error
    throw new Error(`Ошибка при сохранении файла: ${err.message}`)
  }
}

// Запуск PowerShell-скрипта для конвертации
const runVbsConversion = async (fileName: string): Promise<void> => {
  const ps1Path = `${CONFIG.tmpDir}/${CONFIG.vbsScriptName}`
  const escapedFileName = fileName.replace(/"/g, '""')
  const command = `powershell -ExecutionPolicy Bypass -File "${normalizePath(ps1Path)}" "${escapedFileName}"`

  // Функция для создания тайм-аута
  const timeout = (ms: number) =>
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Команда превысила время ожидания (${ms} мс)`)), ms)
    )

  try {
    const ps1Content = await resources.readFile('/frontend/dist/convert.ps1')
    console.log('Переместили файл скрипта')

    await filesystem.writeFile(ps1Path, ps1Content)
    console.log('Пишем PowerShell-скрипт во временную папку')

    console.log('Выполняемая команда:', command)

    // Выполняем команду с тайм-аутом 30 секунд
    const result: any = await Promise.race([os.execCommand(command), timeout(30000)])
    console.log('Выполняем команду')

    console.log('stdout:', result.stdOut)
    console.log('stderr:', result.stdErr)
    console.log('exitCode:', result.exitCode)

    if (result.exitCode !== 0) {
      throw new Error(`PowerShell-скрипт завершился с ошибкой (exitCode: ${result.exitCode})`)
    }
  } catch (error) {
    const err = error as Error
    throw new Error(`Ошибка при запуске PowerShell-конвертации: ${err.message}`)
  }
}

// Создание HTML для отображения PDF
const createFile = async (fileName: string) => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Viewer</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      embed {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <embed src="http://127.0.0.1:8080/.tmp/${fileName.slice(0, -5)}.pdf" type="application/pdf" />
  </body>
  </html>
  `
  function stringToUint8Array(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str)
  }

  const data = stringToUint8Array(htmlContent)

  // Проверяем и создаём временную папку, если не существует
  try {
    await filesystem.readDirectory(CONFIG.tmpDir)
  } catch (error) {
    await filesystem.createDirectory(CONFIG.tmpDir)
  }

  const fileNameHTML = 'pdf-viewer.html'
  const outputPath = `${CONFIG.tmpDir}/${fileNameHTML}`
  try {
    await filesystem.writeBinaryFile(outputPath, data)
    console.log(`Файл ${fileNameHTML} успешно создан`)
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
    throw error
  }
  try {
    await neuWindow.create(`/.tmp/${fileNameHTML}`, {
      x: 0,
      y: 0,
      width: 700,
      height: 1050,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: false,
      processArgs: '--window-id=W_PDF'
    })
  } catch (error) {
    console.error('Ошибка при создании окна:', error)
    throw error
  }
}

// Основная функция для обработки паспорта
export const printPassport = async (partNumber: string, product: Product): Promise<void> => {
  try {
    const file = await findFileByPartNumber(partNumber)
    const serialNumber = getSerialNumber(product.specification)
    const filePath = normalizePath(file.path)
    const fileData = await filesystem.readBinaryFile(filePath)
    const patchedData = await patchDocx(fileData, serialNumber)
    const tempFileName = await savePatchedFile(file.entry, patchedData)
    await runVbsConversion(tempFileName)
    console.log(`Обработка файла ${file.entry} завершена`)
    await createFile(tempFileName)
  } catch (error) {
    const err = error as Error
    console.error(`Ошибка при обработке паспорта: ${err.message}`)
    throw err
  }
}
