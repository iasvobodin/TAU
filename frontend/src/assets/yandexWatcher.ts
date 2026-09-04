import { filesystem, os } from '@neutralinojs/lib'

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

// ─── Утилиты ──────────────────────────────────────────────────────────────────

/** Проверяет, является ли путь UNC-сетевым (начинается с // или \\) */
function isUncPath(path: string): boolean {
  return path.startsWith('//') || path.startsWith('\\\\')
}

/**
 * Нормализует Unix-подобный путь / в Windows-формат \\
 * //server/share → \\\\server\\share
 */
function toWindowsPath(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '\\')
}

/**
 * Разбивает путь Яндекс.Диска на сегменты.
 * Пример: "TAUQuality/Фото ТАУ контроль/07.2026" → ["TAUQuality", "Фото ТАУ контроль", "07.2026"]
 */
function splitPathSegments(yandexPath: string): string[] {
  return yandexPath.split('/').filter(Boolean)
}

/**
 * Создаёт папку на Яндекс.Диске (все уровни вложенности).
 * Если папка уже существует — ошибка игнорируется.
 */
export async function ensureYandexFolderExists(token: string, yandexPath: string): Promise<void> {
  const segments = splitPathSegments(yandexPath)
  let current = ''

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : segment
    const res = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources?path=${encodeURIComponent(current)}`,
      {
        method: 'PUT',
        headers: { Authorization: `OAuth ${token}` }
      }
    )

    if (res.ok) {
      console.log(`📁 Папка создана: ${current}`)
    } else if (res.status === 409) {
      // 409 = уже существует — не ошибка
      console.log(`📁 Папка уже существует: ${current}`)
    } else {
      const errBody = await res.text().catch(() => '')
      throw new Error(`Ошибка создания папки "${current}": ${res.status} ${errBody}`)
    }
  }
}

/**
 * Сохраняет файл (ArrayBuffer) по указанному пути.
 * Если путь UNC-сетевой — использует временный локальный файл + копирование через shell,
 * иначе пишет напрямую через Neutralino filesystem API.
 */
async function saveFileToLocalDir(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  localDir: string
): Promise<string> {
  if (isUncPath(localDir)) {
    // ── UNC-путь: сохраняем во временный локальный файл, затем копируем ──
    const tempDir = './.tmp/yandex'
    try {
      await filesystem.createDirectory(tempDir)
    } catch {
      // директория уже существует — ок
    }

    const tempPath = `${tempDir}/${fileName}`
    await filesystem.writeBinaryFile(tempPath, arrayBuffer)
    console.log(`💾 Временный файл: ${tempPath}`)

    // Копируем в UNC через cmd copy
    const uncPath = `${localDir.replace(/\/$/, '')}/${fileName}`
    const winUncPath = toWindowsPath(uncPath)
    const winTempPath = toWindowsPath(tempPath)

    const cmd = `copy /Y "${winTempPath}" "${winUncPath}"`
    console.log(`📋 Копирование: ${cmd}`)
    await os.execCommand(cmd)

    // Удаляем временный файл
    try {
      await filesystem.remove(tempPath)
    } catch {
      // не критично
    }

    console.log(`✅ Файл скопирован в UNC: ${uncPath}`)
    return uncPath
  } else {
    // ── Локальный путь: пишем напрямую ──
    const localPath = `${localDir.replace(/\/$/, '')}/${fileName}`
    await filesystem.writeBinaryFile(localPath, arrayBuffer)
    console.log(`✅ Файл сохранён: ${localPath}`)
    return localPath
  }
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

  const downloadFile = async (remotePath: string, fileName: string) => {
    const linkRes = await fetch(
      `https://cloud-api.yandex.net/v1/disk/resources/download?path=${encodeURIComponent(remotePath)}`,
      { headers: { Authorization: `OAuth ${token}` } }
    )
    if (!linkRes.ok) throw new Error(`Ошибка получения ссылки на файл ${remotePath}`)

    const { href } = await linkRes.json()
    const fileRes = await fetch(href)
    if (!fileRes.ok) throw new Error(`Ошибка загрузки файла ${remotePath}: ${fileRes.status}`)

    const arrayBuffer = await fileRes.arrayBuffer()
    await saveFileToLocalDir(arrayBuffer, fileName, localDir)
  }

  const poll = async () => {
    if (!isActive) return
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
              await downloadFile(f.path, f.name)
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
