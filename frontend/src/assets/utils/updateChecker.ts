import { filesystem, events, app, resources, os } from '@neutralinojs/lib'

/**
 * Структура манифеста обновлений
 */
export interface ManifestVersion {
  version: string
  published: string
  changelog?: string
  critical?: boolean
}

export interface ManifestData {
  latest: string
  versions: ManifestVersion[]
}

/**
 * UpdateChecker — отслеживает новые версии приложения.
 *
 * Работает в связке с Launcher.exe:
 *  - Launcher копирует актуальный бинарник в локальную папку
 *  - Приложение (NeutralinoJS) уведомляет пользователя о новых версиях
 *  - Пользователь может согласиться на обновление → приложение завершается
 *  - Launcher при следующем запуске подхватывает новую версию
 *
 * Архитектура:
 *  - Прочитать manifest.json с сетевой папки updates/
 *  - Проверить, не появилась ли версия > текущей
 *  - Сообщить UI-компоненту (через callback или событие)
 *
 * Путь к updates/ определяется из config.json (поле updatesPath)
 * Если его нет — пытаемся построить относительно NL_PATH
 */
export class UpdateChecker {
  private updatesPath: string
  private currentVersion: string
  private onUpdateAvailable: ((manifest: ManifestData, latest: ManifestVersion) => void) | null =
    null
  private checkIntervalId: ReturnType<typeof setInterval> | null = null
  private watcherId: number | null = null
  private isChecking = false

  /**
   * @param updatesPath  — UNC-путь к папке updates/ (например \\\\server\\share\\TAU\\updates)
   * @param currentVersion — текущая версия приложения (из neutralino.config.json или version.json)
   */
  constructor(updatesPath: string, currentVersion: string) {
    this.updatesPath = updatesPath.replace(/\/+$/, '').replace(/\\+$/, '')
    this.currentVersion = currentVersion
  }

  /**
   * Установить callback, который вызывается при обнаружении новой версии
   */
  onUpdate(callback: (manifest: ManifestData, latest: ManifestVersion) => void): void {
    this.onUpdateAvailable = callback
  }

  /**
   * Запустить отслеживание обновлений:
   *  1. Проверить при старте
   *  2. Создать watcher на папку updates/
   *  3. Запустить периодическую проверку (раз в 5 минут) — как fallback
   */
  async start(): Promise<void> {
    // 1. Проверка при старте
    await this.checkForUpdate()

    // 2. Периодическая проверка (каждые 5 минут)
    this.checkIntervalId = setInterval(
      () => {
        this.checkForUpdate()
      },
      5 * 60 * 1000
    )

    // 3. Watcher на папку updates/ (NeutralinoJS filesystem watcher)
    try {
      this.watcherId = await filesystem.createWatcher(this.updatesPath)
      console.log('[UpdateChecker] Watcher создан на:', this.updatesPath)

      events.on('watchEvent', async (ev) => {
        console.log('[UpdateChecker] Событие watcher:', ev.detail)
        if (ev.detail && typeof ev.detail === 'object') {
          await this.checkForUpdate()
        }
      })
    } catch (err) {
      console.warn(
        '[UpdateChecker] Не удалось создать watcher (возможно, UNC-путь не поддерживается):',
        err
      )
      // Без watcher — полагаемся на interval
    }
  }

  /**
   * Остановить отслеживание
   */
  stop(): void {
    if (this.checkIntervalId) {
      clearInterval(this.checkIntervalId)
      this.checkIntervalId = null
    }
    if (this.watcherId !== null) {
      try {
        filesystem.removeWatcher(this.watcherId)
      } catch {
        /* ignore */
      }
      this.watcherId = null
    }
  }

  /**
   * Прочитать manifest.json и сравнить версии.
   * Если найдена новая версия — вызвать callback.
   */
  async checkForUpdate(): Promise<void> {
    if (this.isChecking) return
    this.isChecking = true

    try {
      const manifest = await this.readManifest()
      if (!manifest || !manifest.versions || manifest.versions.length === 0) {
        return
      }

      const latestVersion =
        manifest.versions.find((v) => v.version === manifest.latest) ??
        manifest.versions[manifest.versions.length - 1]

      if (!latestVersion) return

      const compareResult = compareSemver(latestVersion.version, this.currentVersion)
      if (compareResult > 0) {
        console.log(
          `[UpdateChecker] Доступна новая версия: ${latestVersion.version} (текущая: ${this.currentVersion})`
        )
        this.onUpdateAvailable?.(manifest, latestVersion)
      }
    } catch (err) {
      console.warn('[UpdateChecker] Ошибка проверки обновления:', err)
    } finally {
      this.isChecking = false
    }
  }

  /**
   * Установить флаг для Launcher'а, что нужно обновление
   * При следующем запуске Launcher подхватит новую версию
   */
  async requestRestart(): Promise<void> {
    try {
      // Записываем флаг обновления в локальную папку
      const flagData = JSON.stringify(
        {
          requestedVersion: null, // null = latest
          requestedAt: new Date().toISOString()
        },
        null,
        2
      )

      await filesystem.writeFile('./app-update.json', flagData)
      console.log('[UpdateChecker] Флаг обновления записан. Завершаю приложение.')
    } catch (err) {
      console.error('[UpdateChecker] Ошибка записи флага обновления:', err)
    }

    // Завершаем приложение
    app.exit()
  }

  // ─── Private ────────────────────────────────────────────────────────────

  /**
   * Прочитать manifest.json с сетевой шары.
   *
   * filesystem.readFile() НЕ работает с UNC-путями (ошибка NE_FS_FILRDER).
   * Поэтому:
   *   1. Копируем manifest.json из UNC во временную локальную папку через cmd copy
   *      (как уже делается в yandexWatcher.ts для записи файлов на UNC)
   *   2. Читаем локальную копию через filesystem.readFile()
   *   3. Удаляем временный файл
   */
  private async readManifest(): Promise<ManifestData | null> {
    const manifestPath = `${this.updatesPath}/manifest.json`
    const tempDir = './.tmp/updates'
    const tempFile = `${tempDir}/manifest.json`

    // 1. Копируем manifest.json из UNC во временную локальную папку
    try {
      // Создаём временную папку, если нет
      try {
        await filesystem.createDirectory(tempDir)
      } catch {
        // уже существует — ок
      }

      // Конвертируем UNC-путь в Windows-формат для cmd
      const winUncPath = toWindowsPath(manifestPath)
      const winTempPath = toWindowsPath(tempFile)

      // Копируем через cmd copy (как в yandexWatcher.ts)
      const cmd = `copy /Y "${winUncPath}" "${winTempPath}"`
      console.log(`[UpdateChecker] Копирование: ${cmd}`)
      const result = await os.execCommand(cmd)

      if (result.exitCode !== 0) {
        throw new Error(`cmd copy вернул код ${result.exitCode}: ${result.stdErr}`)
      }

      // Читаем локальную копию
      const content = await filesystem.readFile(tempFile)
      const parsed = JSON.parse(content) as ManifestData

      if (!parsed.latest || !parsed.versions) {
        console.warn('[UpdateChecker] Неверный формат manifest.json (сетевой)')
        return null
      }

      console.log('[UpdateChecker] Манифест прочитан с сетевой шары:', manifestPath)
      return parsed
    } catch (err) {
      console.warn(`[UpdateChecker] Сетевой манифест недоступен ${manifestPath}:`, err)
    } finally {
      // Удаляем временный файл
      try {
        await filesystem.remove(tempFile)
      } catch {
        // не критично
      }
    }

    // 2. Fallback — читаем из локальных ресурсов приложения (bundled)
    //    Работает только в production-сборке NeutralinoJS
    try {
      const content = await resources.readFile('updates/manifest.json')
      const parsed = JSON.parse(content) as ManifestData

      if (!parsed.latest || !parsed.versions) {
        console.warn('[UpdateChecker] Неверный формат manifest.json (локальный)')
        return null
      }

      console.log('[UpdateChecker] Манифест прочитан из локальных ресурсов, версия:', parsed.latest)
      return parsed
    } catch (err) {
      console.warn('[UpdateChecker] Локальный манифест также недоступен:', err)
      return null
    }
  }

  /**
   * Получить последнюю версию из манифеста
   */
  async getLatestVersion(): Promise<string | null> {
    const manifest = await this.readManifest()
    return manifest?.latest ?? null
  }
}

// ─── Windows path helpers ───────────────────────────────────────────────────

/**
 * Нормализует Unix-подобный путь / в Windows-формат \\
 * //server/share → \\\\server\\share
 */
function toWindowsPath(path: string): string {
  return path.replace(/^\//, '').replace(/\//g, '\\')
}

// ─── Semver helpers ────────────────────────────────────────────────────────

/**
 * Сравнение семантических версий.
 * Возвращает:
 *   > 0 если a > b
 *   < 0 если a < b
 *   0 если равны
 */
export function compareSemver(a: string, b: string): number {
  const cleanA = a.replace(/^v/, '')
  const cleanB = b.replace(/^v/, '')

  const partsA = cleanA.split('.').map(Number)
  const partsB = cleanB.split('.').map(Number)

  const maxLen = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < maxLen; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA !== numB) return numA - numB
  }
  return 0
}
