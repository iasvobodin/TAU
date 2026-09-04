// import { patchDocument, PatchType, TextRun } from 'docx'
// import { filesystem, os, server, events, resources, window as neuWindow } from '@neutralinojs/lib'
// import type { DirectoryEntry } from '@neutralinojs/lib'
// import { mountServer } from '@/assets/utils/mountServer'

// // Конфигурация
// const CONFIG = {
//   scriptName: 'convert.ps1',
//   convertPath: './convertFolder',
//   resourcesPath: '/frontend/dist/',
//   passportDir: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта',
//   searchKey: 'плата 2'
// } as const

// // Получение текущей даты в формате MM.YYYY
// const getCurrentMonthYear = (): string => {
//   const now = new Date()
//   const month = String(now.getMonth() + 1).padStart(2, '0')
//   const year = now.getFullYear()
//   return `${month}.${year}`
// }

// // Нормализация пути для Windows
// const normalizePath = (path: string): string => path.replace(/^\/\//, '\\\\').replace(/\//g, '\\')

// const findFileByPartNumber = (
//   partNumber: string,
//   entries: DirectoryEntry[]
// ): DirectoryEntry | undefined => {
//   return entries.find((item) => item.type === 'FILE' && item.entry.includes(partNumber))
// }

// // Патч .docx файла
// const patchDocx = async (fileData: ArrayBuffer, serialNumber: string): Promise<ArrayBuffer> => {
//   try {
//     const patches = {
//       serialnumber: {
//         type: PatchType.PARAGRAPH,
//         children: [new TextRun(serialNumber)]
//       },
//       currentdate: {
//         type: PatchType.PARAGRAPH,
//         children: [new TextRun(getCurrentMonthYear())]
//       }
//     }
//     return await patchDocument({
//       outputType: 'arraybuffer',
//       data: fileData,
//       patches
//     })
//   } catch (error: unknown) {
//     const message = error instanceof Error ? error.message : String(error)
//     throw new Error(`❌ Ошибка при патче .docx для SN "${serialNumber}": ${message}`)
//   }
// }

// async function ensureDirectoryExists(dir: string) {
//   try {
//     await filesystem.getStats(dir)
//     console.log(`// Папка существует `)
//   } catch {
//     // Папки нет — создаём
//     await filesystem.createDirectory(dir)
//     console.log(`Папка создана: ${dir}`)
//     await server.mount('/convertFolder', dir)
//     console.log(`сервер смонтирован: ${dir}`)
//   }
// }

// async function ensureScriptExists(dir: string) {
//   try {
//     console.log('проверяем скрипт')
//     await filesystem.getStats(dir)
//     // Папка существует
//   } catch {
//     console.log('// Файла нет — копируем')

//     const vbsContent = await resources.readFile(`${CONFIG.resourcesPath}${CONFIG.scriptName}`)
//     await filesystem.writeFile(dir, vbsContent)
//     console.log('Скрипт сохранён во временную папку:', `${CONFIG.convertPath}`)
//   }
// }

// // Сохранение пропатченного файла
// const savePatchedFile = async (
//   partNumber: string,
//   serialNumber: string,
//   data: ArrayBuffer
// ): Promise<void> => {
//   try {
//     await ensureDirectoryExists(CONFIG.convertPath)
//     await ensureScriptExists(`${CONFIG.convertPath}/${CONFIG.scriptName}`)
//     const outputPath = `${CONFIG.convertPath}/${partNumber}__${serialNumber}.docx`
//     await filesystem.writeBinaryFile(outputPath, data)
//     console.log(`Файл успешно сохранен: ${outputPath}`)
//   } catch (error) {
//     const err = error as Error // Явная типизация ошибки
//     throw new Error(`Ошибка при сохранении файла: ${err.message}`)
//   }
// }

// const tryToConvert = async (partNumber: string, serialNumber: string): Promise<void> => {
//   try {
//     const sharedPath = await filesystem.getAbsolutePath(`${CONFIG.convertPath}`)
//     const scriptPath = `${sharedPath}\\${CONFIG.scriptName}`

//     const result = await os.spawnProcess(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`)

//     // Возвращаем промис, который резолвится на 'exit'
//     return new Promise<void>((resolve, reject) => {
//       const handler = (evt: any) => {
//         if (result.id === evt.detail.id) {
//           switch (evt.detail.action) {
//             case 'stdOut':
//               console.log(evt.detail.data)
//               break
//             case 'stdErr':
//               console.error(evt.detail.data)
//               break
//             case 'exit':
//               events.off('spawnedProcess', handler) // отписка от события
//               const outputPath = `${CONFIG.convertPath}/${partNumber}__${serialNumber}.docx`
//               filesystem.remove(outputPath)
//               resolve()
//               break
//           }
//         }
//       }

//       events.on('spawnedProcess', handler)
//     })
//   } catch (error) {
//     console.error(error)
//     return Promise.reject(error) // важно прокинуть ошибку
//   }
// }

// // Основная функция для обработки паспорта
// export const printPassport = async (partNumber: string, serialNumber: string): Promise<boolean> => {
//   try {
//     const outputPath = `${CONFIG.convertPath}/${partNumber}__${serialNumber}.pdf`
//     await filesystem.getStats(outputPath)
//     await mountServer(CONFIG.convertPath)
//     return true
//   } catch (error) {
//     try {
//       //получение списка файлов из директории
//       const entries = await filesystem.readDirectory(CONFIG.passportDir)
//       // Поиск файла в директории по partNumber
//       const foundPassport = findFileByPartNumber(partNumber, entries)

//       if (foundPassport) {
//         console.log('пасспорт для данного продукта найден')

//         try {
//           //возможно нужно вернуть для прода Нормализуем путь и читаем файл
//           const filePath = normalizePath(foundPassport.path)
//           const fileData = await filesystem.readBinaryFile(filePath)
//           const patchedData = await patchDocx(fileData, serialNumber)
//           await savePatchedFile(partNumber, serialNumber, patchedData)
//         } catch (error) {
//           if (error instanceof Error) {
//             console.log(error instanceof Error)
//             throw error // Пробрасываем ошибку для внешней обработки
//           }
//         }
//         // Патчим документ

//         // Сохраняем пропатченный файл
//       } else {
//         console.log('паспорт не найден')
//         return false
//       }
//     } catch (error) {
//       error instanceof Error
//         ? console.error(`Ошибка при обработке паспорта: ${error.message}`)
//         : console.log('Неявная ошибка')
//       throw error // Пробрасываем ошибку для внешней обработки
//     }
//     try {
//       await tryToConvert(partNumber, serialNumber) // ждём завершения через 'exit'
//       console.log('Конвертация завершена успешно')
//       return true // Возвращаем что-то после await
//     } catch (error) {
//       console.error('Произошла ошибка при конвертации', error)
//       return false
//     }
//   }
// }

import { patchDocument, PatchType, TextRun } from 'docx'
import { filesystem, os, server, events, resources } from '@neutralinojs/lib'
import type { DirectoryEntry } from '@neutralinojs/lib'
import { mountServer } from '@/assets/utils/mountServer'
import { findFileInDirectory } from '@/assets/utils/findFileInDirectory'
import { getCurrentMonthYear } from './utils/getCurrentMonthYear'
import { usePathsStore } from '@/stores/paths'

// FALLBACK — на случай если pathsStore ещё не загружен
const FALLBACK_PATHS = {
  convertFolder: './convertFolder',
  resourcesPath: '/frontend/dist/',
  passports: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта'
}

/**
 * Получить конфигурацию из pathsStore.
 * Используется в функциях (не module-level), чтобы пути были уже загружены.
 */
function getC() {
  try {
    const store = usePathsStore()
    return {
      scriptName: 'convert.ps1',
      convertPath: store.effectiveConvertFolder,
      resourcesPath: store.paths.resourcesPath,
      passportDir: store.paths.passports,
      searchKey: 'плата 2'
    }
  } catch {
    return {
      scriptName: 'convert.ps1',
      convertPath: FALLBACK_PATHS.convertFolder,
      resourcesPath: FALLBACK_PATHS.resourcesPath,
      passportDir: FALLBACK_PATHS.passports,
      searchKey: 'плата 2'
    }
  }
}

function normalizePath(path: string): string {
  return path.replace(/^\/\//, '\\\\').replace(/\//g, '\\')
}

// function findFileByPartNumber(
//   partNumber: string,
//   entries: DirectoryEntry[]
// ): DirectoryEntry | undefined {
//   return entries.find((item) => item.type === 'FILE' && item.entry.includes(partNumber))
// }

async function patchDocx(fileData: ArrayBuffer, serialNumber: string): Promise<ArrayBuffer> {
  try {
    const patches = {
      serialnumber: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(serialNumber)]
      },
      currentdate: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(getCurrentMonthYear())]
      },
      ProdName: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(`ООО «Метран Проект».`)]
      },
      ProdAddress: {
        type: PatchType.PARAGRAPH,
        children: [
          new TextRun(
            `454103, Российская Федерация, Челябинская область, г. Челябинск,\n 
            пр-кт. Новоградский, д. 15, стр.1, Тел. +7 (351) 240 88 82.`
          )
        ]
      }
    }
    return await patchDocument({
      outputType: 'arraybuffer',
      data: fileData,
      patches
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`❌ Ошибка при патче .docx для SN "${serialNumber}": ${message}`)
  }
}

async function checkIfPdfExists(partNumber: string, serialNumber: string): Promise<boolean> {
  const cfg = getC()
  const outputPath = `${cfg.convertPath}/${partNumber}__${serialNumber}.pdf`
  try {
    await filesystem.getStats(outputPath)
    //перенесём монтирование сервера в роут нового окна
    // await mountServer(CONFIG.convertPath)
    return true
  } catch {
    return false
  }
}

// async function findFileInDirectory(
//   partNumber: string,
//   directory: string
// ): Promise<DirectoryEntry | null> {
//   try {
//     const entries = await filesystem.readDirectory(directory)
//     return findFileByPartNumber(partNumber, entries) ?? null
//   } catch (error) {
//     console.error('Ошибка при поиске паспорта:', error)
//     return null
//   }
// }

async function ensureDirectoryExists(dir: string): Promise<void> {
  try {
    await filesystem.getStats(dir)
    console.log(`// Папка существует`)
  } catch {
    await filesystem.createDirectory(dir)
    console.log(`Папка создана: ${dir}`)
    await server.mount('/convertFolder', dir)
    console.log(`Сервер смонтирован: ${dir}`)
  }
}

async function ensureScriptExists(scriptPath: string): Promise<void> {
  try {
    await filesystem.getStats(scriptPath)
    console.log('Скрипт существует')
  } catch {
    const cfg = getC()
    console.log('// Файла нет — копируем')
    const vbsContent = await resources.readFile(`${cfg.resourcesPath}${cfg.scriptName}`)
    await filesystem.writeFile(scriptPath, vbsContent)
    console.log('Скрипт сохранён во временную папку:', scriptPath)
  }
}

async function savePatchedFile(
  partNumber: string,
  serialNumber: string,
  data: ArrayBuffer
): Promise<void> {
  const cfg = getC()
  try {
    await ensureDirectoryExists(cfg.convertPath)
    await ensureScriptExists(`${cfg.convertPath}/${cfg.scriptName}`)
    const outputPath = `${cfg.convertPath}/${partNumber}__${serialNumber}.docx`
    await filesystem.writeBinaryFile(outputPath, data)
    console.log(`Файл успешно сохранен: ${outputPath}`)
  } catch (error) {
    const err = error as Error
    throw new Error(`Ошибка при сохранении файла: ${err.message}`)
  }
}

async function tryToConvert(partNumber: string, serialNumber: string): Promise<void> {
  const cfg = getC()
  try {
    const sharedPath = await filesystem.getAbsolutePath(cfg.convertPath)
    const scriptPath = `${sharedPath}\\${cfg.scriptName}`
    const result = await os.spawnProcess(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`)

    return new Promise<void>((resolve, reject) => {
      function handler(evt: any) {
        if (result.id === evt.detail.id) {
          switch (evt.detail.action) {
            case 'stdOut':
              console.log(evt.detail.data)
              break
            case 'stdErr':
              console.error(evt.detail.data)
              break
            case 'exit':
              events.off('spawnedProcess', handler)
              const outputPath = `${cfg.convertPath}/${partNumber}__${serialNumber}.docx`
              filesystem.remove(outputPath).catch(console.error)
              resolve()
              break
          }
        }
      }

      events.on('spawnedProcess', handler)
    })
  } catch (error) {
    console.error(error)
    return Promise.reject(error)
  }
}

async function safelyProcessPassport(
  partNumber: string,
  serialNumber: string,
  passportPath: string
): Promise<boolean> {
  try {
    const filePath = normalizePath(passportPath)
    const fileData = await filesystem.readBinaryFile(filePath)
    const patchedData = await patchDocx(fileData, serialNumber)
    await savePatchedFile(partNumber, serialNumber, patchedData)
    return true
  } catch (error) {
    console.error('Ошибка при обработке паспорта:', error)
    return false
  }
}

async function safelyConvert(partNumber: string, serialNumber: string): Promise<boolean> {
  try {
    await tryToConvert(partNumber, serialNumber)
    console.log('✅ Конвертация завершена успешно')
    return true
  } catch (error) {
    console.error('Ошибка при конвертации в PDF:', error)
    return false
  }
}

// export async function printPassport(partNumber: string, serialNumber: string): Promise<boolean> {
//   try {
//     const alreadyConverted = await checkIfPdfExists(partNumber, serialNumber)
//     if (alreadyConverted) return true

//     const passport = await findFileInDirectory(partNumber, CONFIG.passportDir)
//     if (!passport) {
//       console.warn(`Паспорт для "${partNumber}" не найден`)
//       return false
//     }

//     const processed = await safelyProcessPassport(partNumber, serialNumber, passport.path)
//     if (!processed) return false

//     const converted = await safelyConvert(partNumber, serialNumber)
//     if (!converted) return false

//     return true
//   } catch (error) {
//     console.error('🚨 Непредвиденная ошибка при печати паспорта:', error)
//     return false
//   }
// }

function normalizeSerials(serial: string | string[]): string[] {
  return Array.isArray(serial) ? serial : [serial]
}

export async function printPassport(
  partNumber: string,
  serial: string | string[]
): Promise<boolean> {
  const serialNumbers = normalizeSerials(serial)
  const cfg = getC()

  try {
    const passport = await findFileInDirectory(partNumber, cfg.passportDir)

    if (!passport) {
      console.warn(`Паспорт для "${partNumber}" не найден`)
      return false
    }

    // 👉 1. Патчим все docx
    for (const sn of serialNumbers) {
      const alreadyConverted = await checkIfPdfExists(partNumber, sn)
      if (alreadyConverted) continue

      const processed = await safelyProcessPassport(partNumber, sn, passport.path)
      if (!processed) return false
    }

    // 👉 2. Один запуск конвертации (важно!)
    const converted = await safelyConvert(partNumber, serialNumbers[0])
    if (!converted) return false

    return true
  } catch (error) {
    console.error('🚨 Непредвиденная ошибка при печати паспорта:', error)
    return false
  }
}
