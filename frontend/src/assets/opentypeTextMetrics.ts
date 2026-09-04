/**
 * opentypeTextMetrics.ts — ОБЩИЙ адаптер TextMetricsProvider над opentype-шрифтом.
 *
 * Контракт: plans/text-layout-unification-plan.md (раздел 4.2 «Адаптер метрик»,
 * Фаза 4 — дедупликация адаптера между SVG- и HTML-рендерерами).
 *
 * Жёсткие требования:
 *  - ЧИСТЫЙ модуль: импортирует только opentype.js, БЕЗ @neutralinojs/lib,
 *    БЕЗ document/window на верхнем уровне.
 *  - Используется ОБОИМИ рендерерами:
 *      - renderToSVG.ts  (SVG-путь, Фаза 3 → Фаза 4)
 *      - htmlRenderer.ts (HTML-печать, Фаза 4)
 *    чтобы метрики и раскладка строк были едиными (допуск ≤ 0.1 мм HTML↔SVG).
 *
 * measureWidth = font.getAdvanceWidth + letterSpacing (между соседними символами),
 * ascender/descender — из метрик шрифта (hhea) при заданном fontSize.
 */

import opentype from 'opentype.js'
import type { TextMetricsProvider } from './textLayout'

export function createOpentypeTextMetricsProvider(font: opentype.Font): TextMetricsProvider {
  return {
    measureWidth(text, fontSizePx, letterSpacingPx) {
      const charCount = Array.from(text).length
      const spacingPx = letterSpacingPx * Math.max(0, charCount - 1)
      return font.getAdvanceWidth(text, fontSizePx) + spacingPx
    },
    ascenderPx(fontSizePx) {
      return (font.ascender / font.unitsPerEm) * fontSizePx
    },
    descenderPx(fontSizePx) {
      return (font.descender / font.unitsPerEm) * fontSizePx
    }
  }
}
