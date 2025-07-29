import { filesystem } from '@neutralinojs/lib'
import type { DirectoryEntry } from '@neutralinojs/lib'

export async function findFileInDirectory(
  partOfFileName: string,
  directory: string
): Promise<DirectoryEntry | null> {
  try {
    //чекаем директорию, перед чтением файлов
    await filesystem.getStats(directory)
    const entries = await filesystem.readDirectory(directory)

    return findFileByPartNumber(partOfFileName, entries) ?? null
  } catch (error) {
    console.error('Ошибка при поиске файла:', error)
    return null
  }
}

function findFileByPartNumber(
  partOfFileName: string,
  entries: DirectoryEntry[]
): DirectoryEntry | undefined {
  return entries.find((item) => item.type === 'FILE' && item.entry.includes(partOfFileName))
}
