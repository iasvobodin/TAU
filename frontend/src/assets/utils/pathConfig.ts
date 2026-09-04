import { filesystem } from '@neutralinojs/lib'

/**
 * Структура путей приложения
 */
export interface AppPaths {
  ok: string
  okPdf: string
  kd: string
  passports: string
  marking: string
  other: string
  convertFolder: string
  resourcesPath: string
}

// Дефолтные значения (из config.json на момент написания)
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

/**
 * Путь к локальному файлу конфигурации путей
 */
function getConfigPath(): string {
  return `${window.NL_PATH}/.tmp/pathsConfig.json`
}

/**
 * Загрузить конфигурацию путей.
 *
 * ПРИОРИТЕТ (изменён!):
 *   1. config.json (мастер-копия в корне) — содержит актуальные UNC-пути
 *   2. .tmp/pathsConfig.json (локальные настройки пользователя)
 *   3. DEFAULT_PATHS (хардкод)
 *
 * Раньше pathsConfig.json имел высший приоритет, что приводило к проблеме:
 * после обновления config.json (Launcher копирует с UNC-путями), старый
 * pathsConfig.json перезаписывал новые пути старыми относительными.
 */
export async function loadPathsConfig(): Promise<AppPaths> {
  // 1. Пробуем config.json в корне (имеет высший приоритет)
  try {
    const raw = await filesystem.readFile('./config.json')
    const parsed = JSON.parse(raw)
    if (parsed.paths) {
      const merged: AppPaths = { ...DEFAULT_PATHS, ...parsed.paths }
      // Сохраняем локально для кеша (но с уменьшенным приоритетом)
      try {
        await savePathsConfig(merged)
      } catch {
        // Не критично если не сохранится
      }
      return merged
    }
  } catch {
    // нет config.json — идём дальше
  }

  // 2. Пробуем локальную копию (если config.json не найден)
  try {
    const content = await filesystem.readFile(getConfigPath())
    const parsed = JSON.parse(content) as AppPaths
    if (parsed.ok) {
      return parsed
    }
  } catch {
    // нет локальной копии — идём к дефолтам
  }

  // 3. Дефолты
  return { ...DEFAULT_PATHS }
}

/**
 * Сохранить конфигурацию путей локально
 */
export async function savePathsConfig(paths: AppPaths): Promise<void> {
  await filesystem.writeFile(getConfigPath(), JSON.stringify(paths, null, 2))
}
