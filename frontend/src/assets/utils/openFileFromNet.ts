import { findFileInDirectory } from './findFileInDirectory'
import { openSecondWindow } from './openSecondWindow'

export const openFileFromNet = async (
  fileName: string | null | undefined = '',
  dir: string,
  serverPoint: string
): Promise<void> => {
  if (typeof fileName === 'string') {
    try {
      const fileEntry = await findFileInDirectory(fileName, dir)
      console.log(fileEntry, fileName, dir)

      if (!fileEntry) {
        console.warn('File not found in directory')
        return
      }
      // const normalizedPath = normalizeUncPath(fileEntry.path)
      await openSecondWindow(dir, fileEntry.entry, serverPoint)

      // await os.execCommand(`explorer "${normalizedPath}"`)
    } catch (error) {
      console.error('Failed to open file:', error)
      throw error
    }
  } else {
    console.log('не указан параметр поиска')
    return
  }
}
