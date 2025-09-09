import {
  filesystem,
  Mode,
  os,
  computer,
  extensions,
  window as neuWindow,
  events
} from '@neutralinojs/lib'

export interface FileSaveResult {
  filePath: string
  previewUrl: string
  fileName: string
  file: File
}

export interface FileReadResult {
  blob: Blob
  previewUrl: string
  fileType: string
  fileSize: number
}

/**
 * Обрабатывает файл из input, сохраняет его в указанную папку и возвращает информацию о файле
 */
export const processAndSaveFile = async (
  event: Event,
  saveDirectory: string = './uploads',
  componentPN: string = '' // Путь по умолчанию
): Promise<FileSaveResult | null> => {
  const input = event.target as HTMLInputElement
  const files = input.files

  if (!files || !files[0]) {
    throw new Error('Файл не выбран')
  }

  const file = files[0]

  // Генерируем уникальное имя файла
  const fileExtension = getFileExtension(file.name)
  const uniqueFileName = generateUniqueFileName(fileExtension, componentPN)
  const filePath = `${saveDirectory}/${uniqueFileName}`

  try {
    // Читаем файл как ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Сохраняем файл через Neutralino Filesystem API
    // await filesystem.writeBinaryFile(filePath, arrayBuffer)

    // Создаем URL для превью
    const blob = new Blob([arrayBuffer], { type: file.type })
    const previewUrl = URL.createObjectURL(blob)

    console.log('Файл успешно сохранен:', filePath)

    return {
      file,
      filePath,
      previewUrl,
      fileName: uniqueFileName
    }
  } catch (error) {
    console.error('Ошибка при сохранении файла:', error)
    throw new Error(
      `Не удалось сохранить файл: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    )
  }
}

/**
 * Генерирует уникальное имя файла с timestamp и random ID
 */
const generateUniqueFileName = (extension: string, componentPN: string = ''): string => {
  // const timestamp = Date.now()
  function secureRandomId() {
    return crypto.randomUUID() // Современные браузеры
  }
  const randomId = Math.random().toString(36).substring(2, 9)
  return `${componentPN}_${randomId}${extension}`
}

/**
 * Извлекает расширение файла из имени
 */
const getFileExtension = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.')
  return lastDotIndex > 0 ? fileName.substring(lastDotIndex) : ''
}

/**
 * Вспомогательная функция для создания директории, если она не существует
 */
export const ensureDirectoryExists = async (directoryPath: string): Promise<void> => {
  try {
    await filesystem.createDirectory(directoryPath)
    console.log('Директория создана или уже существует:', directoryPath)
  } catch (error) {
    console.warn('Не удалось создать директорию (возможно уже существует):', error)
  }
}

/**
 * Очищает URL превью для освобождения памяти
 */
export const revokePreviewUrl = (previewUrl: string): void => {
  URL.revokeObjectURL(previewUrl)
}

/**
 * Получает MIME-type по расширению файла
 */
export const getMimeTypeFromExtension = (filePath: string): string => {
  const extension = filePath.split('.').pop()?.toLowerCase() || ''
  const mimeMap: { [key: string]: string } = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain'
  }
  return mimeMap[extension] || 'application/octet-stream'
}

export const readFileAndCreatePreview = async (filePath: string): Promise<FileReadResult> => {
  if (!filePath) {
    throw new Error('Путь к файлу не указан')
  }

  try {
    // Читаем файл через Neutralino Filesystem API
    const fileData = await filesystem.readBinaryFile(filePath)
    console.log(fileData, 'fileData')

    // Получаем MIME-type файла
    const fileType = getMimeTypeFromExtension(filePath)
    console.log(fileType, 'fileType')

    // Создаем Blob из бинарных данных
    const blob = new Blob([fileData], { type: fileType })

    // Создаем URL для превью
    const previewUrl = URL.createObjectURL(blob)

    // Получаем информацию о файле
    const stats = await filesystem.getStats(filePath)

    return {
      blob,
      previewUrl,
      fileType,
      fileSize: stats.size
    }
  } catch (error) {
    console.error('Ошибка при чтении файла:', error)
    throw new Error(
      `Не удалось прочитать файл: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`
    )
  }
}
