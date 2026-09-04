import { filesystem } from '@neutralinojs/lib'
import type { AppPaths } from './pathConfig'

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface PathCheckResult {
  /** Ключ пути (ok, okPdf, kd, passports, marking, other) */
  key: string
  /** Человеко-читаемое название */
  label: string
  /** Исходный путь из конфига */
  path: string
  /** Доступен ли путь */
  accessible: boolean
  /** Текст ошибки, если недоступен */
  error?: string
}

// ─── Конфигурация проверки ───────────────────────────────────────────────────

/** Ключи путей, которые являются сетевыми (UNC) — только их и проверяем */
const NETWORK_PATH_KEYS: (keyof AppPaths)[] = ['ok', 'okPdf', 'kd', 'passports', 'marking', 'other']

/** Человеко-читаемые названия путей для вывода в консоль */
const PATH_LABELS: Record<string, string> = {
  ok: 'Операционные карты',
  okPdf: 'ОК PDF',
  kd: 'Конструкторская документация',
  passports: 'Паспорта',
  marking: 'Наклейки / Гравировка',
  other: 'Прочие документы'
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Определяет, является ли путь сетевым UNC-путём.
 * UNC-пути начинаются с // или \\.
 */
function isUncPath(path: string): boolean {
  return path.startsWith('//') || path.startsWith('\\\\')
}

// ─── Основные функции ─────────────────────────────────────────────────────────

/**
 * Проверить доступность одного пути через NeutralinoJS filesystem.getStats().
 * Если путь не является UNC-сетевым — пропускаем (считаем доступным).
 */
async function checkSinglePath(key: string, path: string): Promise<PathCheckResult> {
  const result: PathCheckResult = {
    key,
    label: PATH_LABELS[key] || key,
    path,
    accessible: false
  }

  // Пропускаем локальные пути (convertFolder, resourcesPath и т.п.)
  if (!path || !isUncPath(path)) {
    result.accessible = true
    result.error = 'не сетевой путь — пропущен'
    return result
  }

  try {
    await filesystem.getStats(path)
    result.accessible = true
  } catch (err: any) {
    result.error = `путь недоступен: ${err?.message || err || 'неизвестная ошибка'}`
  }

  return result
}

/**
 * Проверить доступность всех сетевых путей из конфигурации приложения.
 * Возвращает массив результатов проверки по каждому пути.
 *
 * @param paths - объект путей из pathsStore (или AppPaths)
 */
export async function checkAllNetworkPaths(paths: AppPaths): Promise<PathCheckResult[]> {
  const results: PathCheckResult[] = []

  for (const key of NETWORK_PATH_KEYS) {
    const path = paths[key]
    const result = await checkSinglePath(key, path)
    results.push(result)
  }

  return results
}

/**
 * Вывести результаты проверки путей в консоль.
 * Если все пути доступны — console.log с ✅.
 * Если есть проблемы — console.error с ❌ и деталями.
 */
export function logPathCheckResults(results: PathCheckResult[]): void {
  const networkResults = results.filter((r) => r.error !== 'не сетевой путь — пропущен')
  const allAccessible = networkResults.every((r) => r.accessible)

  if (allAccessible) {
    console.log('✅ [pathCheck] Все сетевые пути доступны')
    for (const r of networkResults) {
      console.log(`  ✅ ${r.label}: ${r.path}`)
    }
  } else {
    console.error('❌ [pathCheck] Обнаружены проблемы с сетевыми путями:')
    for (const r of results) {
      if (r.error === 'не сетевой путь — пропущен') {
        // Не выводим локальные пути в отчёт об ошибках
        continue
      }
      if (r.accessible) {
        console.log(`  ✅ ${r.label}: ${r.path}`)
      } else {
        console.error(`  ❌ ${r.label}: ${r.path}`)
        console.error(`     Причина: ${r.error}`)
      }
    }
  }
}
