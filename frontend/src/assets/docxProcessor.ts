import { patchDocument, PatchType, TextRun } from 'docx'
import { filesystem, os, server, events, resources, window as neuWindow } from '@neutralinojs/lib'

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
    const err = error as Error // Явная типизация ошибки
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
    const err = error as Error // Явная типизация ошибки
    throw new Error(`Ошибка при патче документа: ${err.message}`)
  }
}

// Сохранение пропатченного файла
const savePatchedFile = async (
  partNumber: string,
  serialNumber: string,
  data: ArrayBuffer
): Promise<void> => {
  try {
    await filesystem.createDirectory('./convertFolder')
  } catch (error) {
    console.log(error)
  }

  try {
    const vbsContent = await resources.readFile('/frontend/dist/convert.ps1')

    await filesystem.writeFile('./convertFolder/convert.ps1', vbsContent)

    console.log('Скрипт сохранён во временную папку:', './convertFolder')
  } catch (error) {
    console.log(error)
  }
  try {
    const outputPath = `./convertFolder/${partNumber}__${serialNumber}.docx`
    await filesystem.writeBinaryFile(outputPath, data)
    console.log(`Файл успешно сохранен: ${outputPath}`)
  } catch (error) {
    const err = error as Error // Явная типизация ошибки
    throw new Error(`Ошибка при сохранении файла: ${err.message}`)
  }
}

const openPrintPassportWindow = async () => {
  try {
    // Открываем новое окно
    await neuWindow.create(`/print-pdf`, {
      x: 0,
      y: 0,
      width: 700,
      height: 950,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: true,
      processArgs: '--window-id=W_PDF'
    })
  } catch (error) {
    console.log(error)
  }
}

const createFile = async (fileName: string) => {
  const fn = `${'passport.docx'.slice(0, -5)}.pdf`

  try {
    await server.mount('/convertFolder', './convertFolder')
  } catch (error) {
    console.log(error)
  }

  console.log('server is mounted on convertFolder')

  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Viewer</title>
     <script src="http://localhost:8080/__neutralino_globals.js"></script>
    <script src="
https://cdn.jsdelivr.net/npm/@neutralinojs/lib@6.1.0/dist/neutralino.min.js
"></script>
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
    <embed src="http://127.0.0.1:8080/convertFolder/${fn}" type="application/pdf" />
  </body>
  <script>
    // Проверка наличия Neutralino в window
    console.log("window.Neutralino:", window.Neutralino);

      window.Neutralino.init();
           window.Neutralino.events.on('windowClose', async (event) => {
      console.log('Neutralino windowClose', event)
       await window.Neutralino.events.broadcast("PDF", "W_PDF_VIEWER");
    })
      window.addEventListener('beforeunload', async () => {
        console.log("Отправляем событие windowClose");
        await window.Neutralino.events.broadcast("PDFwindowClose", "W_PDF_VIEWER");
      });
  </script>
  </html>
`
  // Функция для конвертации строки в Uint8Array
  function stringToUint8Array(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str)
  }

  // Преобразуем HTML в Uint8Array
  const data = stringToUint8Array(htmlContent)

  // Запись файла в Neutralino
  const fileNameHTML = 'pdf-viewer.html'
  const outputPath = `./convertFolder/${fileNameHTML}`
  try {
    await filesystem.writeBinaryFile(outputPath, data)
    console.log(`Файл ${fileNameHTML} успешно создан`)
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  } // convertFolder/${fileNameHTML}
  try {
    // Открываем новое окно
    await neuWindow.create(`/print-pdf`, {
      x: 0,
      y: 0,
      width: 700,
      height: 950,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: true,
      processArgs: '--window-id=W_PDF'
    })
  } catch (error) {
    console.log(error)
  }
}
const tryToConvert = async (fileName: string): Promise<void> => {
  try {
    const sharedPath = await filesystem.getAbsolutePath('./convertFolder')
    const scriptPath = `${sharedPath}\\convert.ps1`

    const result = await os.spawnProcess(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`)
    console.log('еще одна попытка конвертнуть', result)

    // Возвращаем промис, который резолвится на 'exit'
    return new Promise<void>((resolve, reject) => {
      const handler = (evt: any) => {
        if (result.id === evt.detail.id) {
          switch (evt.detail.action) {
            case 'stdOut':
              console.log(evt.detail.data)
              break
            case 'stdErr':
              console.error(evt.detail.data)
              break
            case 'exit':
              events.off('spawnedProcess', handler) // отписка от события
              resolve()
              break
          }
        }
      }

      events.on('spawnedProcess', handler)
    })
  } catch (error) {
    console.error(error)
    return Promise.reject(error) // важно прокинуть ошибку
  }
}

// Основная функция для обработки паспорта
export const printPassport = async (partNumber: string, serialNumber: string): Promise<boolean> => {
  try {
    // Находим файл
    const file = await findFileByPartNumber(partNumber)
    // Нормализуем путь и читаем файл
    const filePath = normalizePath(file.path)
    const fileData = await filesystem.readBinaryFile(filePath)
    // Патчим документ
    const patchedData = await patchDocx(fileData, serialNumber) // Убрано fileData.buffer
    // Сохраняем пропатченный файл
    await savePatchedFile(partNumber, serialNumber, patchedData)
  } catch (error) {
    const err = error as Error // Явная типизация ошибки
    console.error(`Ошибка при обработке паспорта: ${err.message}`)
    throw err // Пробрасываем ошибку для внешней обработки
  }
  try {
    await tryToConvert('example.docx') // ждём завершения через 'exit'
    console.log('Конвертация завершена успешно')
    return true // Возвращаем что-то после await
  } catch (error) {
    console.error('Произошла ошибка при конвертации', error)
    return false
  }
}
