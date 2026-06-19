import { filesystem } from '@neutralinojs/lib'

/**
 * Структура путей из config.json
 */
export interface AppPaths {
  ok: string // Операционные карты (родительская папка)
  okPdf: string // Операционные карты / ОК PDF (подпапка)
  kd: string // Конструкторская документация
  passports: string // Паспорта
  marking: string // Наклейки / Гравировка
  other: string // Прочие документы
  convertFolder: string
  resourcesPath: string
}

export interface AppServices {
  wsUrl: string
}

export interface AppConfigData {
  version: string
  paths: AppPaths
  services: AppServices
}

// ─── Дефолтные значения (fallback) ──────────────────────────────────────────
// Если config.json не найден — используем эти, чтобы не сломать совместимость
const DEFAULT_PATHS: AppPaths = {
  ok: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Операционные карты',
  okPdf:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Операционные карты/ОК PDF',
  kd: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/КД',
  passports: '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта',
  marking:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Наклейки/Гравировка',
  other:
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Софт/прикладные документы',
  convertFolder: './convertFolder',
  resourcesPath: '/frontend/dist/'
}

const DEFAULT_SERVICES: AppServices = {
  wsUrl: '10.69.19.59:3000'
}

/**
 * Единый загрузчик конфигурации приложения.
 *
 * Загружает config.json из корня приложения (рядом с TAU.exe/neutralino.config.json).
 * Если файл не найден — использует дефолтные значения (полная обратная совместимость).
 *
 * Использование:
 *   import { appConfig } from '@/assets/utils/AppConfig'
 *   await appConfig.load()
 *   console.log(appConfig.paths.passports)
 */
class AppConfig {
  private data: AppConfigData | null = null
  private loaded = false

  /**
   * Загрузить config.json. Должен быть вызван при старте приложения (main.ts / App.vue).
   * Безопасен для повторных вызовов — второй раз ничего не делает.
   */
  async load(): Promise<void> {
    if (this.loaded) return

    try {
      const raw = await filesystem.readFile('./config.json')
      const parsed: AppConfigData = JSON.parse(raw)

      // Валидация: проверяем, что есть paths
      if (!parsed.paths) {
        console.warn('[AppConfig] config.json не содержит "paths" — использую дефолтные')
        this.data = {
          version: '1.0.0',
          paths: { ...DEFAULT_PATHS },
          services: { ...DEFAULT_SERVICES }
        }
      } else {
        this.data = {
          version: parsed.version || '1.0.0',
          paths: { ...DEFAULT_PATHS, ...parsed.paths },
          services: { ...DEFAULT_SERVICES, ...parsed.services }
        }
      }

      console.log('[AppConfig] Успешно загружен, paths:', this.data.paths)
    } catch (err) {
      console.warn('[AppConfig] Не удалось прочитать config.json — использую дефолтные пути')
      console.warn('[AppConfig] Ошибка:', err)
      this.data = {
        version: '1.0.0',
        paths: { ...DEFAULT_PATHS },
        services: { ...DEFAULT_SERVICES }
      }
    }

    this.loaded = true
  }

  /**
   * Нормализовать UNC-путь: обратные слеши → прямые (для единообразия в коде)
   */
  private normalize(value: string): string {
    return value.replace(/\\/g, '/')
  }

  get paths(): AppPaths {
    if (!this.data) {
      console.warn('[AppConfig] config не загружен! Возвращаю дефолтные пути.')
      return DEFAULT_PATHS
    }
    return this.data.paths
  }

  get services(): AppServices {
    if (!this.data) return DEFAULT_SERVICES
    return this.data.services
  }

  /**
   * Получить нормализованный путь (с / разделителями) для использования в коде
   */
  getPath(key: keyof AppPaths): string {
    return this.normalize(this.paths[key])
  }
}

// Singleton
export const appConfig = new AppConfig()
