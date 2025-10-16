import { filesystem } from '@neutralinojs/lib'

export interface YandexDiskWatcherOptions {
  token: string // OAuth токен
  path: string // путь к папке, например "disk:/Претензии"
  intervalSec?: number // период опроса (сек)
  autoDownload?: boolean // автоматически скачивать новые файлы
  localDir?: string // локальная директория для сохранения
  onChange?: (newFiles: YandexDiskFile[]) => void | Promise<void>
  onError?: (err: Error) => void
}

export interface YandexDiskFile {
  name: string
  path: string
  size: number
  modified: string
}

/**
 * Создаёт наблюдатель за изменениями в папке на Яндекс.Диске.
 * При первом запуске просто фиксирует текущее состояние, а затем отслеживает новые файлы.
 */
export function createYandexDiskWatcher(options: YandexDiskWatcherOptions) {
  const {
    token,
    path,
    intervalSec = 15,
    autoDownload = false,
    localDir = '/storage/yandex',
    onChange,
    onError
  } = options

  let knownFiles = new Map<string, string>() // path -> modified
  let isInitialized = false
  let isActive = true

  const fetchFolderState = async (): Promise<YandexDiskFile[]> => {
    const res = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(
        path
      )}&fields=_embedded.items.name,_embedded.items.path,_embedded.items.size,_embedded.items.modified`,
      {
        headers: { Authorization: `OAuth ${token}` }
      }
    )

    if (!res.ok) throw new Error(`Ошибка доступа к Яндекс.Диску: ${res.status}`)
    const data = await res.json()
    const items = data._embedded?.items || []

    return items.map((i: any) => ({
      name: i.name,
      path: i.path,
      size: i.size,
      modified: i.modified
    }))
  }

  const downloadFile = async (remotePath: string, localPath: string) => {
    const linkRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(remotePath)}`,
      { headers: { Authorization: `OAuth ${token}` } }
    )
    if (!linkRes.ok) throw new Error(`Ошибка получения ссылки на файл ${remotePath}`)

    const { href } = await linkRes.json()
    const fileRes = await fetch(href)
    if (!fileRes.ok) throw new Error(`Ошибка загрузки файла ${remotePath}: ${fileRes.status}`)

    const arrayBuffer = await fileRes.arrayBuffer()
    await filesystem.writeBinaryFile(localPath, arrayBuffer)
    console.log(`✅ Файл сохранён: ${localPath}`)
  }

  const poll = async () => {
    if (!isActive) return
    // console.log('😎')
    try {
      const currentFiles = await fetchFolderState()

      // Инициализация (первый проход)
      if (!isInitialized) {
        for (const f of currentFiles) {
          knownFiles.set(f.path, f.modified)
        }
        isInitialized = true
        console.log(`📂 Инициализировано состояние папки (${currentFiles.length} файлов)`)
      } else {
        // Определяем новые файлы
        const newFiles = currentFiles.filter((f) => !knownFiles.has(f.path))
        if (newFiles.length > 0) {
          console.log(`📥 Найдено новых файлов: ${newFiles.length}`)
          if (autoDownload) {
            for (const f of newFiles) {
              const localPath = `${localDir}/${f.name}`
              await downloadFile(f.path, localPath)
              console.log('after download')
            }
          }
          if (onChange) await onChange(newFiles)
        }

        // Обновляем известные файлы
        knownFiles.clear()
        for (const f of currentFiles) {
          knownFiles.set(f.path, f.modified)
        }
      }
    } catch (err: any) {
      if (onError) onError(err)
      else console.error('Ошибка в watcher:', err.message)
    }

    if (isActive) setTimeout(poll, intervalSec * 1000)
  }

  poll()
  console.log('🟢 Опрос Яндекс.Диска запущен')

  return {
    stop() {
      isActive = false
      console.log('🛑 Опрос Яндекс.Диска остановлен')
    }
  }
}
