/**
 * labelDiff.ts — ЧИСТАЯ утилита пиксель-перфект сверки двух слоёв текстовых строк.
 *
 * Контракт: plans/text-layout-unification-plan.md (Фаза 5/6, «Пиксель-перфект утилита»).
 *
 * Жёсткие требования:
 *  - БЕЗ @neutralinojs/lib, БЕЗ document/window на верхнем уровне.
 *  - Только чистые функции → покрывается unit-тестами на FakeData.
 *
 * Назначение:
 *  Сравнить, как один и тот же шаблон (из одного buildTemplateData()) размещает
 *  текстовые строки на трёх путях рендеринга (HTML-печать / SVG / канвас).
 *  Вход — два «слоя строк» (RenderLine[]):
 *    - HTML-слой: что реально разместил htmlRenderer (парсинг выходной HTML-строки);
 *    - SVG-слой:  та же раскладка computeTextLayout, которую использует renderToSVG
 *      (SVG-пути не несут текста/координат для обратного парсинга).
 *
 *  Сравниваются позиции (x/y), размеры (w/h), текст и переносы (число строк).
 *  Порог по умолчанию — 0.1 мм (параметризуем). Конвертация px→мм — через pxToMm()
 *  из textLayout.ts (единый MM_TO_PX).
 */

import { pxToMm } from './textLayout'
import type { TextMetricsProvider } from './textLayout'

// ── Типы ──────────────────────────────────────────────────────────────────────

export type DiffRotation = 0 | 90 | 180 | 270
export type DiffAxis = 'x' | 'y' | 'width' | 'height' | 'text' | 'lines'

/**
 * Строка текста, как её размещает рендерер.
 * Координаты — в системе «повёрнутого текста» (текст всегда горизонтален в своём
 * внутреннем пространстве), от ЛЕВОГО/ВЕРХНЕГО края внутренней области блока
 * (без паддингов). Поворот блока задаётся отдельным полем rotation и применяется
 * рендерером как внешний transform вокруг центра блока — поэтому оба слоя
 * сравниваются в одной (внутренней) системе координат.
 */
export interface RenderLine {
  /** ID элемента (обычный текст или ячейка таблицы). */
  elementId: string
  /** Текст строки. Пустая строка кодируется '\u00A0' (как в рендерерах HTML/SVG). */
  text: string
  /** Левый край строки, px, от внутренней области (без паддингов). */
  xPx: number
  /** Верх строки (baselineY − ascender), px, от внутренней области. */
  yPx: number
  /** Ширина строки, px. */
  widthPx: number
  /**
   * Высота строки, px (обычно fontSize × lineHeight).
   * 0 / undefined → ось height не сравнивается (напр. HTML-слой из парсинга).
   */
  heightPx?: number
  /** Поворот текстового блока. */
  rotation: DiffRotation
  /** Доп. группировка (например, tableId для ячеек таблицы). */
  layerId?: string
}

/** Одно расхождение (одна строка × одна ось). */
export interface LabelDiffDiscrepancy {
  elementId: string
  lineText: string
  axis: DiffAxis
  /** Ожидаемое значение (HTML-слой) — координата/размер/текст/число строк. */
  expected: number | string
  /** Фактическое значение (SVG-слой). */
  actual: number | string
  /** Модуль разницы в px. Для осей text/lines — 0. */
  deltaPx: number
  /** Модуль разницы в мм (pxToMm). Для структурных осей text/lines — 0. */
  deltaMm: number
}

/** Агрегированный вердикт. */
export interface LabelDiffAggregate {
  /** Максимальный delta по геометрическим осям (x/y/width/height). */
  maxDeltaMm: number
  /**
   * true, если maxDeltaMm > порога ИЛИ есть структурное расхождение
   * (разный текст строки или разное число строк — признак расхождения переноса).
   */
  exceedsThreshold: boolean
  /** Всего строк в HTML-слое (эталонный рендер). */
  totalLines: number
  /** Строк, реально попарно сравнённых (min(HTML, SVG) по каждому элементу). */
  comparedLines: number
}

export interface LabelDiffReport {
  discrepancies: LabelDiffDiscrepancy[]
  aggregate: LabelDiffAggregate
}

export interface DiffOptions {
  /** Порог в мм. По умолчанию 0.1. */
  thresholdMm?: number
}

/** Порог по умолчанию — 0.1 мм (контракт плана). */
export const DEFAULT_THRESHOLD_MM = 0.1

// ── Вспомогательные ───────────────────────────────────────────────────────────

function groupByElement(lines: RenderLine[]): Map<string, RenderLine[]> {
  const map = new Map<string, RenderLine[]>()
  for (const line of lines) {
    const arr = map.get(line.elementId)
    if (arr) arr.push(line)
    else map.set(line.elementId, [line])
  }
  return map
}

// ── Сверка ────────────────────────────────────────────────────────────────────

/**
 * Сравнивает HTML-слой и SVG-слой строк, извлечённые из одного buildTemplateData().
 *
 * Алгоритм:
 *  1. Группирует оба слоя по elementId (порядок строк внутри элемента сохраняется).
 *  2. Для каждого элемента:
 *     - если число строк различается → расхождение оси 'lines' (перенос);
 *     - попарно по min(html, svg) строк: текст ('text'), x, y, width,
 *       и height (только если задана на обеих сторонах).
 *  3. Агрегирует: maxDeltaMm, exceedsThreshold (порог параметризуем), totalLines,
 *     comparedLines.
 *
 * Оси x/y/width/height — геометрические (deltaMm = pxToMm(|Δ|)).
 * Оси text/lines — структурные: deltaMm = 0, но при их наличии вердикт FAIL
 * (текст/перенос различаются независимо от пиксельной точности).
 */
export function diffRenderLines(
  htmlLines: RenderLine[],
  svgLines: RenderLine[],
  options: DiffOptions = {}
): LabelDiffReport {
  const thresholdMm = options.thresholdMm ?? DEFAULT_THRESHOLD_MM
  const discrepancies: LabelDiffDiscrepancy[] = []

  const htmlByEl = groupByElement(htmlLines)
  const svgByEl = groupByElement(svgLines)
  const allIds = new Set<string>([...htmlByEl.keys(), ...svgByEl.keys()])

  const pushGeo = (
    elementId: string,
    lineText: string,
    axis: 'x' | 'y' | 'width' | 'height',
    expected: number,
    actual: number,
    delta: number
  ): void => {
    discrepancies.push({
      elementId,
      lineText,
      axis,
      expected,
      actual,
      deltaPx: delta,
      deltaMm: pxToMm(delta)
    })
  }

  let comparedLines = 0

  for (const id of allIds) {
    const hLines = htmlByEl.get(id) ?? []
    const sLines = svgByEl.get(id) ?? []

    // Перенос: разное число строк у элемента
    if (hLines.length !== sLines.length) {
      discrepancies.push({
        elementId: id,
        lineText: '',
        axis: 'lines',
        expected: hLines.length,
        actual: sLines.length,
        deltaPx: Math.abs(hLines.length - sLines.length),
        deltaMm: 0
      })
    }

    const n = Math.min(hLines.length, sLines.length)
    comparedLines += n
    for (let i = 0; i < n; i++) {
      const h = hLines[i]
      const s = sLines[i]
      const lineText = h.text

      // Текст строки (структурная ось)
      if (h.text !== s.text) {
        const dWidth = Math.abs(h.widthPx - s.widthPx)
        discrepancies.push({
          elementId: id,
          lineText,
          axis: 'text',
          expected: h.text,
          actual: s.text,
          deltaPx: dWidth,
          deltaMm: pxToMm(dWidth)
        })
      }

      // Позиции и размеры (геометрические оси)
      const dx = Math.abs(h.xPx - s.xPx)
      if (dx > 0) pushGeo(id, lineText, 'x', h.xPx, s.xPx, dx)

      const dy = Math.abs(h.yPx - s.yPx)
      if (dy > 0) pushGeo(id, lineText, 'y', h.yPx, s.yPx, dy)

      const dw = Math.abs(h.widthPx - s.widthPx)
      if (dw > 0) pushGeo(id, lineText, 'width', h.widthPx, s.widthPx, dw)

      // Высота — только если задана на обеих сторонах
      const hh = h.heightPx
      const sh = s.heightPx
      if (hh != null && hh > 0 && sh != null && sh > 0) {
        const dh = Math.abs(hh - sh)
        if (dh > 0) pushGeo(id, lineText, 'height', hh, sh, dh)
      }
    }
  }

  // Структурные расхождения (текст/перенос) → вердикт FAIL независимо от пикселей
  const hasStructural = discrepancies.some((d) => d.axis === 'text' || d.axis === 'lines')
  const maxDeltaMm = discrepancies.reduce((max, d) => Math.max(max, d.deltaMm), 0)

  return {
    discrepancies,
    aggregate: {
      maxDeltaMm,
      exceedsThreshold: maxDeltaMm > thresholdMm || hasStructural,
      totalLines: htmlLines.length,
      comparedLines
    }
  }
}

/**
 * Хелпер для отображения: максимальный delta (мм) конкретной строки двух слоёв.
 * Используется DevView для подсветки расходящихся строк на оверлее.
 * Возвращает 0, если соответствие строки не найдено/совпадает идеально.
 */
export function lineMaxDeltaMm(h: RenderLine, s: RenderLine | undefined): number {
  if (!s) return Number.POSITIVE_INFINITY
  let max = Math.max(
    Math.abs(h.xPx - s.xPx),
    Math.abs(h.yPx - s.yPx),
    Math.abs(h.widthPx - s.widthPx)
  )
  if (h.heightPx != null && s.heightPx != null) {
    max = Math.max(max, Math.abs(h.heightPx - s.heightPx))
  }
  return pxToMm(max)
}

// ═══ Посимвольная сверка рендеров (ТЕСТОВАЯ опция, только в режиме сверки) ═════
// Контракт: plans/text-layout-unification-plan.md (раздел «Посимвольная сверка
// рендеров»). Включается ТОЛЬКО в панели LabelDiffPanel и unit-тестах — НЕ в
// основном пути рендера. Остаётся чистым модулем (без Neutralino/Vue/DOM).

/** Позиция одного символа в строке. */
export interface CharPos {
  /** Символ (кодовая точка). */
  char: string
  /** Левый край символа, px, от внутренней области блока (без паддингов). */
  xPx: number
  /** Индекс символа в строке (0-based, в порядке Array.from). */
  index: number
}

export interface LabelCharDiffOptions {
  /** Порог в мм. По умолчанию 0.1. */
  thresholdMm?: number
  /**
   * Провайдер метрик по элементу (в тестах — fake, в панели — opentype/fallback).
   * undefined для элемента → посимвольное сравнение этого элемента пропускается.
   */
  providerFor?: (elementId: string) => TextMetricsProvider | undefined
  /** Размер шрифта (px, без zoom) по элементу. */
  fontSizeFor?: (elementId: string) => number
  /**
   * ФАКТИЧЕСКИЕ позиции символов HTML-слоя (реальное браузерное измерение в панели).
   * Когда для (elementId, lineIndex) возвращается массив — HTML-сторона использует
   * его вместо численного computeCharPositions; иначе HTML-сторона считается численно
   * через computeCharPositions (общий провайдер, как SVG-сторона).
   */
  htmlCharPositionsFor?: (elementId: string, lineIndex: number) => CharPos[] | undefined
}

/** Одно посимвольное расхождение (одна строка × один символ). */
export interface LabelCharDiscrepancy {
  elementId: string
  lineIndex: number
  /**
   * Индекс символа в строке. -1 — СТРУКТУРНОЕ расхождение:
   *   char === CHAR_DIFF_TEXT_MARKER  — разный текст строки;
   *   char === CHAR_DIFF_LINES_MARKER — разное число строк (перенос).
   * В структурном случае expectedX/actualX несут число строк (для <lines>) или 0.
   */
  charIndex: number
  /** Символ (кодовая точка); для структурных — маркер '<text>' / '<lines>'. */
  char: string
  /** Ожидаемая позиция символа (HTML-слой), px, от внутренней области. */
  expectedX: number
  /** Фактическая позиция (SVG-слой), px. */
  actualX: number
  /** Модуль разницы в px. Для структурных — 0 (или |число строк|). */
  deltaPx: number
  /** Модуль разницы в мм (pxToMm). Для структурных — 0. */
  deltaMm: number
}

export interface LabelCharDiffReport {
  discrepancies: LabelCharDiscrepancy[]
  /** Сколько пар символов реально попарно сравнено. */
  comparedChars: number
  /** Максимальный delta по символам, мм. */
  maxDeltaMm: number
  /**
   * true, если maxDeltaMm > порога ИЛИ есть структурное расхождение
   * (разный текст строки / разное число строк).
   */
  exceedsThreshold: boolean
}

/** Маркер структурного расхождения «разный текст строки». */
export const CHAR_DIFF_TEXT_MARKER = '<text>'
/** Маркер структурного расхождения «разное число строк (перенос)». */
export const CHAR_DIFF_LINES_MARKER = '<lines>'

/**
 * Кумулятивные позиции символов строки:
 *   x0 = xStartPx, для i>0: x_i = xStartPx + sum(advance[0..i-1]).
 * Ширина каждого символа — через provider.measureWidth(char, fontSizePx, letterSpacingPx)
 * (посимвольно). Пустая строка → пустой массив. Пробелы обрабатываются как обычные
 * символы (их advance учитывается). Чистая функция — без DOM/Neutralino.
 */
export function computeCharPositions(
  provider: TextMetricsProvider,
  text: string,
  xStartPx: number,
  fontSizePx: number,
  letterSpacingPx = 0
): CharPos[] {
  const chars = Array.from(String(text))
  const result: CharPos[] = []
  let x = xStartPx
  for (let i = 0; i < chars.length; i++) {
    result.push({ char: chars[i], xPx: x, index: i })
    x += provider.measureWidth(chars[i], fontSizePx, letterSpacingPx)
  }
  return result
}

/**
 * Посимвольная сверка двух слоёв строк (HTML ↔ SVG), как diffRenderLines, но
 * по символам.
 *
 * Алгоритм:
 *  1. Группирует оба слоя по elementId, попарно по min(html, svg) строк.
 *  2. Разное число строк → структурное расхождение '<lines>' (перенос).
 *  3. Для пары строк (совпавшие индекс): разный текст → структурное '<text>';
 *     иначе (одинаковый текст) — посимвольное сравнение xPx:
 *       - SVG-сторона:  computeCharPositions(provider, s.text, s.xPx, fontSizePx);
 *       - HTML-сторона: opts.htmlCharPositionsFor(id, i) если задан и вернул массив,
 *         иначе computeCharPositions(provider, h.text, h.xPx, fontSizePx).
 *  4. Агрегирует: comparedChars, maxDeltaMm, exceedsThreshold
 *     (maxDeltaMm > порога || структурное расхождение).
 *
 * Примечание: обе стороны могут считаться ОДНИМ провайдером → при одинаковых
 * строках символы совпадают идеально. Расхождения появляются, когда:
 *   - тексты/переносы строк различаются (разное число строк, разный текст);
 *   - переданный провайдер даёт иные метрики, чем фактические (для панели — когда
 *     для HTML-слоя измеряются реальные браузерные позиции символов через
 *     htmlCharPositionsFor).
 */
export function diffRenderCharacters(
  htmlLines: RenderLine[],
  svgLines: RenderLine[],
  opts: LabelCharDiffOptions = {}
): LabelCharDiffReport {
  const thresholdMm = opts.thresholdMm ?? DEFAULT_THRESHOLD_MM
  const discrepancies: LabelCharDiscrepancy[] = []
  const htmlByEl = groupByElement(htmlLines)
  const svgByEl = groupByElement(svgLines)
  const allIds = new Set<string>([...htmlByEl.keys(), ...svgByEl.keys()])

  let comparedChars = 0
  let maxDeltaMm = 0

  for (const id of allIds) {
    const hLines = htmlByEl.get(id) ?? []
    const sLines = svgByEl.get(id) ?? []
    const provider = opts.providerFor?.(id)
    const fontSizePx = opts.fontSizeFor?.(id)

    // Перенос: разное число строк — структурное расхождение
    if (hLines.length !== sLines.length) {
      discrepancies.push({
        elementId: id,
        lineIndex: Math.min(hLines.length, sLines.length),
        charIndex: -1,
        char: CHAR_DIFF_LINES_MARKER,
        expectedX: hLines.length,
        actualX: sLines.length,
        deltaPx: Math.abs(hLines.length - sLines.length),
        deltaMm: 0
      })
    }

    const n = Math.min(hLines.length, sLines.length)
    for (let i = 0; i < n; i++) {
      const h = hLines[i]
      const s = sLines[i]

      // Разный текст строки — структурное расхождение
      if (h.text !== s.text) {
        discrepancies.push({
          elementId: id,
          lineIndex: i,
          charIndex: -1,
          char: CHAR_DIFF_TEXT_MARKER,
          expectedX: 0,
          actualX: 0,
          deltaPx: 0,
          deltaMm: 0
        })
        continue
      }

      // Посимвольное сравнение требует провайдера и размера шрифта
      if (!provider || fontSizePx == null || fontSizePx <= 0) continue

      const htmlChars = opts.htmlCharPositionsFor
        ? (opts.htmlCharPositionsFor(id, i) ??
          computeCharPositions(provider, h.text, h.xPx, fontSizePx))
        : computeCharPositions(provider, h.text, h.xPx, fontSizePx)
      const svgChars = computeCharPositions(provider, s.text, s.xPx, fontSizePx)

      const m = Math.min(htmlChars.length, svgChars.length)
      comparedChars += m
      for (let c = 0; c < m; c++) {
        const hc = htmlChars[c]
        const sc = svgChars[c]
        const delta = Math.abs(hc.xPx - sc.xPx)
        if (delta > 0) {
          const deltaMm = pxToMm(delta)
          if (deltaMm > maxDeltaMm) maxDeltaMm = deltaMm
          discrepancies.push({
            elementId: id,
            lineIndex: i,
            charIndex: c,
            char: hc.char,
            expectedX: hc.xPx,
            actualX: sc.xPx,
            deltaPx: delta,
            deltaMm
          })
        }
      }
    }
  }

  const hasStructural = discrepancies.some((d) => d.charIndex < 0)
  return {
    discrepancies,
    comparedChars,
    maxDeltaMm,
    exceedsThreshold: maxDeltaMm > thresholdMm || hasStructural
  }
}
