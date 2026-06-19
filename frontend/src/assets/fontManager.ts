/**
 * FontManager.ts — менеджер системных шрифтов для Neutralinojs.
 *
 * Архитектура:
 *   1. init()  — создаёт .tmp/, загружает кэш БД с диска (быстро)
 *   2. scan()  — сканирует системные папки, обрабатывает только НОВЫЕ файлы,
 *               генерирует SVG-превью, обновляет БД на диске
 *   3. После init() шрифты уже доступны из кэша — UI не ждёт scan()
 *
 * SVG-превью хранятся в .tmp/previews/ и доступны по /.tmp/previews/*.svg
 * через встроенный HTTP-сервер Neutralino.
 *
 * Переносимость путей:
 *   На диск пишутся токенизированные пути: {{LOCALAPPDATA}}/Microsoft/Windows/Fonts/font.ttf
 *   При загрузке токены раскрываются в реальные пути текущего пользователя.
 *   В памяти всегда хранятся реальные пути — getPathByFullName() готов к использованию сразу.
 */

import { filesystem, computer, os } from '@neutralinojs/lib'
import opentype from 'opentype.js'

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface FontEntry {
  fileName: string // 'arial.ttf'
  filePath: string // 'C:/Windows/Fonts/arial.ttf'
  fullName: string // 'Arial' или 'Arial Bold'
  style: string // 'Regular', 'Bold', 'Italic', …
  svgPreviewPath: string // '/.tmp/previews/arial_ttf.svg' (web URL, '' если unsupported)
  supported: boolean // false для TTC и повреждённых файлов
}

// ─── Токены для переносимых путей ────────────────────────────────────────────
// [токен в JSON, имя переменной окружения]
// Порядок важен: более специфичные (длинные) переменные идут первыми,
// чтобы {{LOCALAPPDATA}} не перекрыл вложенный путь раньше {{APPDATA}}.
const PATH_TOKENS = [
  ['{{LOCALAPPDATA}}', 'LOCALAPPDATA'],
  ['{{APPDATA}}', 'APPDATA'],
  ['{{HOME}}', 'HOME']
] as const

// ─── Класс ───────────────────────────────────────────────────────────────────

export class FontManager {
  private readonly DB_PATH = '.tmp/fonts-db.json'
  private readonly PREVIEW_DIR = '.tmp/previews' // путь на диске
  private readonly PREVIEW_WEB = '/.tmp/previews' // web-путь через Neutralino HTTP

  private database: FontEntry[] = []
  // fullName.toLowerCase() → FontEntry — для быстрого поиска пути при loadFont
  private nameIndex = new Map<string, FontEntry>()

  // Имена файлов (lowercase), обнаруженные при последнем scan().
  // Используется getSupportedFonts(true) для фильтрации только реально существующих на диске шрифтов.
  private scannedFileNames = new Set<string>()

  // Значения переменных окружения, загруженные один раз в init().
  // Ключ — имя переменной ('LOCALAPPDATA', 'HOME', …), значение — путь с / как разделителем.
  private envVars = new Map<string, string>()

  // ── Публичное API ───────────────────────────────────────────────────────────

  /**
   * Создаёт .tmp-папки и загружает существующую БД с диска.
   * Быстрая операция — вызывать при старте приложения.
   * После вызова getSupportedFonts() уже возвращает данные из кэша.
   */
  async init(): Promise<void> {
    try {
      await filesystem.createDirectory('.tmp')
    } catch {}
    try {
      await filesystem.createDirectory(this.PREVIEW_DIR)
    } catch {}

    // Загружаем переменные окружения один раз — используются и здесь, и в scan/_getSystemFontDirs
    await this._loadEnvVars()

    try {
      const raw = await filesystem.readFile(this.DB_PATH)
      const stored: FontEntry[] = JSON.parse(raw)
      // Разворачиваем токены → реальные пути текущего пользователя
      this.database = stored.map((e) => ({
        ...e,
        filePath: this._detokenizePath(e.filePath)
      }))
      this._rebuildIndex()
    } catch {
      this.database = []
    }
  }

  /**
   * Сканирует системные папки шрифтов.
   * Обрабатывает новые файлы + перепроверяет ранее неправильно помеченные как unsupported
   * (например, если прошлая версия кода имела более строгую проверку supported).
   * Вызывать после init() в фоне — не блокирует показ UI.
   */
  async scan(): Promise<void> {
    const dirs = await this._getSystemFontDirs()
    const discovered: { path: string; name: string }[] = []
    for (const dir of dirs) {
      await this._recursiveScan(dir, discovered)
    }

    // Запоминаем имена файлов, найденных на этом компьютере, для фильтрации в getSupportedFonts(true)
    this.scannedFileNames = new Set(discovered.map((f) => f.name.toLowerCase()))

    // Файлы, которых ещё нет в базе
    const existingNames = new Set(this.database.map((e) => e.fileName.toLowerCase()))
    const newFiles = discovered.filter((f) => !existingNames.has(f.name.toLowerCase()))

    // Записи в базе, помеченные как unsupported, но не являющиеся TTC —
    // они могли быть неправильно классифицированы предыдущей версией кода.
    const wronglyUnsupported = this.database.filter(
      (e) => !e.supported && !e.fileName.toLowerCase().endsWith('.ttc')
    )

    // Удаляем из базы те, что будем перепроверять
    if (wronglyUnsupported.length) {
      const toRecheck = new Set(wronglyUnsupported.map((e) => e.fileName.toLowerCase()))
      this.database = this.database.filter((e) => !toRecheck.has(e.fileName.toLowerCase()))
      this._rebuildIndex()
    }

    const filesToProcess = [
      ...newFiles,
      ...wronglyUnsupported.map((e) => ({ path: e.filePath, name: e.fileName }))
    ]

    if (!filesToProcess.length) return

    for (const file of filesToProcess) {
      try {
        const entries = await this._processFile(file.path, file.name)
        for (const entry of entries) {
          this.database.push(entry)
          this.nameIndex.set(entry.fullName.toLowerCase(), entry)
        }
      } catch (err) {
        console.warn(`[FontManager] Skip ${file.name}:`, err)
      }
    }

    // Сохраняем на диск с токенизированными путями — файл будет работать
    // на любом компьютере и под любым пользователем.
    const tokenized = this.database.map((e) => ({
      ...e,
      filePath: this._tokenizePath(e.filePath)
    }))
    await filesystem.writeFile(this.DB_PATH, JSON.stringify(tokenized, null, 2))
  }

  /**
   * Все поддерживаемые шрифты, отсортированные по имени.
   * @param onlyScanned — если true, возвращает только шрифты, файлы которых были найдены
   *                      при последнем scan() (т.е. реально существующие на этом компьютере).
   */
  getSupportedFonts(onlyScanned?: boolean): FontEntry[] {
    let result = this.database.filter((e) => e.supported)
    if (onlyScanned && this.scannedFileNames.size > 0) {
      result = result.filter((e) => this.scannedFileNames.has(e.fileName.toLowerCase()))
    }
    return result.sort((a, b) => a.fullName.localeCompare(b.fullName))
  }

  /** Полный путь к файлу шрифта по его fullName. null если не найден. */
  getPathByFullName(name: string): string | null {
    return this.nameIndex.get(name.toLowerCase())?.filePath ?? null
  }

  // ── Приватные методы ────────────────────────────────────────────────────────

  private _rebuildIndex(): void {
    this.nameIndex.clear()
    for (const entry of this.database) {
      this.nameIndex.set(entry.fullName.toLowerCase(), entry)
    }
  }

  // ── Токенизация путей ───────────────────────────────────────────────────────

  /**
   * Читает нужные переменные окружения и кэширует их в this.envVars.
   * Вызывается один раз в init().
   */
  private async _loadEnvVars(): Promise<void> {
    for (const [, varName] of PATH_TOKENS) {
      if (this.envVars.has(varName)) continue
      try {
        const val = await os.getEnv(varName)
        if (val) {
          // Нормализуем разделители: \ → /
          this.envVars.set(varName, val.replace(/\\/g, '/'))
        }
      } catch {
        // Переменная недоступна на этой платформе — пропускаем
      }
    }
  }

  /**
   * Заменяет реальные значения env-переменных на токены для сохранения в JSON.
   * Пример: 'C:/Users/john/AppData/Local/Microsoft/Windows/Fonts/f.ttf'
   *      → '{{LOCALAPPDATA}}/Microsoft/Windows/Fonts/f.ttf'
   */
  private _tokenizePath(path: string): string {
    let result = path
    for (const [token, varName] of PATH_TOKENS) {
      const val = this.envVars.get(varName)
      if (val && result.startsWith(val)) {
        result = token + result.slice(val.length)
        break // один путь содержит только один корневой токен
      }
    }
    return result
  }

  /**
   * Раскрывает токены в реальные пути текущего пользователя.
   * Пример: '{{LOCALAPPDATA}}/Microsoft/Windows/Fonts/f.ttf'
   *      → 'C:/Users/currentuser/AppData/Local/Microsoft/Windows/Fonts/f.ttf'
   */
  private _detokenizePath(path: string): string {
    let result = path
    for (const [token, varName] of PATH_TOKENS) {
      if (result.startsWith(token)) {
        const val = this.envVars.get(varName)
        if (val) {
          result = val + result.slice(token.length)
        }
        break
      }
    }
    return result
  }

  // ── Системные папки шрифтов ─────────────────────────────────────────────────

  private async _getSystemFontDirs(): Promise<string[]> {
    try {
      const info = await computer.getOSInfo()
      const name = info.name.toLowerCase()

      if (name.includes('windows') || name.includes('win')) {
        // Используем уже загруженные в init() переменные — лишних вызовов os.getEnv нет
        const localAppData = this.envVars.get('LOCALAPPDATA')
        const userFontsPath = localAppData ? `${localAppData}/Microsoft/Windows/Fonts` : null
        return ['C:/Windows/Fonts', ...(userFontsPath ? [userFontsPath] : [])]
      }

      if (name.includes('darwin') || name.includes('mac')) {
        const home = this.envVars.get('HOME')
        return [
          '/System/Library/Fonts',
          '/Library/Fonts',
          ...(home ? [`${home}/Library/Fonts`] : [])
        ]
      }

      // Linux
      const home = this.envVars.get('HOME')
      return [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        ...(home ? [`${home}/.fonts`, `${home}/.local/share/fonts`] : [])
      ]
    } catch {
      // Не удалось определить платформу — пробуем всё
      return ['C:/Windows/Fonts', '/Library/Fonts', '/System/Library/Fonts', '/usr/share/fonts']
    }
  }

  private async _recursiveScan(
    dir: string,
    results: { path: string; name: string }[]
  ): Promise<void> {
    try {
      const entries = await filesystem.readDirectory(dir)
      for (const e of entries as any[]) {
        if (e.entry === '.' || e.entry === '..') continue
        const fullPath = `${dir}/${e.entry}`
        if (e.type === 'DIRECTORY') {
          await this._recursiveScan(fullPath, results)
        } else {
          const ext = e.entry.split('.').pop()?.toLowerCase()
          // woff/woff2 opentype.js не поддерживает — пропускаем
          if (ext === 'ttf' || ext === 'otf' || ext === 'ttc') {
            results.push({ path: fullPath, name: e.entry })
          }
        }
      }
    } catch {}
  }

  private async _processFile(filePath: string, fileName: string): Promise<FontEntry[]> {
    const buffer = await filesystem.readBinaryFile(filePath)
    const view = new Uint8Array(buffer)

    // TTC (TrueType Collection) — WebKit не поддерживает напрямую
    const isTTC = view[0] === 0x74 && view[1] === 0x74 && view[2] === 0x63 && view[3] === 0x66

    if (isTTC) {
      return [
        {
          fileName,
          filePath,
          fullName: fileName.replace(/\.ttc$/i, ''),
          style: 'Collection',
          svgPreviewPath: '',
          supported: false
        }
      ]
    }

    const font = opentype.parse(buffer)
    const names = font.names as any
    const family = names.preferredFamily?.en || names.fontFamily?.en || ''
    const sub = names.preferredSubfamily?.en || names.fontSubfamily?.en || 'Regular'
    const fullName =
      (sub === 'Regular' ? family : `${family} ${sub}`.trim()) ||
      fileName.replace(/\.(ttf|otf)$/i, '')

    // Если opentype.parse() не бросил исключение и unitsPerEm > 0 — шрифт валиден.
    // Проверка через font.tables (tables.glyf / tables['CFF ']) ненадёжна:
    // в разных версиях opentype.js эти ключи могут отсутствовать даже у рабочих шрифтов.
    const supported = font.unitsPerEm > 0

    let svgPreviewPath = ''

    if (supported) {
      const svgName = fileName.replace(/\./g, '_') + '.svg'
      const diskPath = `${this.PREVIEW_DIR}/${svgName}`
      svgPreviewPath = `${this.PREVIEW_WEB}/${svgName}`
      // Пропускаем генерацию если превью уже есть на диске
      if (!(await this._previewExists(diskPath))) {
        try {
          const svg = this._generatePreviewSVG(font, fullName)
          await filesystem.writeFile(diskPath, svg)
        } catch (svgErr) {
          console.warn(`[FontManager] SVG preview failed for ${fileName}:`, svgErr)
          svgPreviewPath = ''
        }
      }
    }

    return [
      {
        fileName,
        filePath,
        fullName,
        style: sub,
        svgPreviewPath,
        supported
      }
    ]
  }

  /**
   * Проверяет существование файла превью на диске.
   * Neutralinojs не имеет fs.exists() — используем getStats() и ловим ошибку.
   */
  private async _previewExists(diskPath: string): Promise<boolean> {
    try {
      await filesystem.getStats(diskPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Генерирует SVG с именем шрифта, отрендеренным самим шрифтом.
   * Текст обрезается до разумной длины чтобы вписаться в viewBox.
   */
  private _generatePreviewSVG(font: opentype.Font, text: string): string {
    const label = text.length > 32 ? text.slice(0, 32) + '…' : text
    const fontSize = 60
    const path = font.getPath(label, 8, 72, fontSize)
    const d = path.toPathData(2)
    // Если шрифт не смог сгенерировать path — возвращаем пустой SVG с текстом-fallback
    if (!d) {
      return [
        '<svg viewBox="0 0 600 90" xmlns="http://www.w3.org/2000/svg">',
        `  <text x="8" y="72" font-size="${fontSize}" fill="#1a1a1a">${label}</text>`,
        '</svg>'
      ].join('\n')
    }
    return [
      '<svg viewBox="0 0 600 90" xmlns="http://www.w3.org/2000/svg">',
      `  <path d="${d}" fill="#1a1a1a"/>`,
      '</svg>'
    ].join('\n')
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
// Импортируется из labelEditor (init/scan) и renderToSVG (getPathByFullName).

export const fontManager = new FontManager()
