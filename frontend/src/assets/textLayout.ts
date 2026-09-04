/**
 * textLayout.ts — ЧИСТЫЙ модуль единой раскладки текста.
 *
 * Контракт: plans/text-layout-unification-plan.md
 *
 * Жёсткие требования:
 *  - БЕЗ импортов @neutralinojs/lib, document/window на верхнем уровне.
 *  - Только чистые функции + опциональный DOM-хелпер (инжектится через провайдер метрик).
 *  - Покрывается unit-тестами (frontend/src/tests/unit/textLayout.test.ts).
 *
 * Три пути рендеринга (HTML-печать / SVG / канвас) должны потреблять ОДИН результат
 * раскладки из этого модуля — единый источник MM_TO_PX, дефолтов текста и wrap-алгоритма.
 */

import type { TextRenderProps } from '../types/label'

// ── Константы ──────────────────────────────────────────────────────────────────
/** ЕДИНЫЙ коэффициент мм → px. Дубли из других файлов будут убраны в последующих фазах. */
export const MM_TO_PX = 3.78

export function mmToPx(mm: number): number {
  return mm * MM_TO_PX
}

export function pxToMm(px: number): number {
  return px / MM_TO_PX
}

// ── Типы ───────────────────────────────────────────────────────────────────────
export type TextRotation = 0 | 90 | 180 | 270
export type WrapMode = 'word' | 'char' | 'nowrap'
export type TextCase = 'none' | 'uppercase' | 'lowercase' | 'capitalize'

// ── Реестр текстовых свойств (единая точка добавления нового свойства) ────────
export const TEXT_STYLE_KEYS = [
  'fontSize',
  'fontFamily',
  'bold',
  'italic',
  'align',
  'verticalAlign',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textCase',
  'underline',
  'strikethrough',
  'textColor',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'textRotation'
] as const

export type TextStyleKey = (typeof TEXT_STYLE_KEYS)[number]

// Типизированные дефолты — внутренний источник истины (satisfies гарантирует,
// что реестр ключей и дефолты совпадают 1:1).
const TEXT_STYLE_DEFAULTS_RAW = {
  fontSize: 12,
  fontFamily: 'Arial',
  bold: false,
  italic: false,
  align: 'left',
  verticalAlign: 'middle',
  lineHeight: 1.2,
  letterSpacing: 0,
  wordSpacing: 0,
  textCase: 'none',
  underline: false,
  strikethrough: false,
  textColor: '#000000',
  paddingTop: 0,
  paddingRight: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  textRotation: 0
} as const satisfies Record<TextStyleKey, unknown>

/** Дефолты по ключам (контракт: Record<string, unknown>). */
export const TEXT_STYLE_DEFAULTS: Record<string, unknown> = TEXT_STYLE_DEFAULTS_RAW

/**
 * Единая точка нормализации текстовых пропсов.
 * Старые JSON без новых полей нормализуются дефолтами из TEXT_STYLE_DEFAULTS.
 * Миграция deprecated paddingX/paddingY выполняется в resolveTextProps() (types/label.ts).
 */
export function normalizeTextProps(raw: Partial<TextRenderProps>): TextRenderProps {
  return {
    fontSize: raw.fontSize ?? TEXT_STYLE_DEFAULTS_RAW.fontSize,
    fontFamily: raw.fontFamily ?? TEXT_STYLE_DEFAULTS_RAW.fontFamily,
    bold: raw.bold ?? TEXT_STYLE_DEFAULTS_RAW.bold,
    italic: raw.italic ?? TEXT_STYLE_DEFAULTS_RAW.italic,
    align: raw.align ?? TEXT_STYLE_DEFAULTS_RAW.align,
    verticalAlign: raw.verticalAlign ?? TEXT_STYLE_DEFAULTS_RAW.verticalAlign,
    lineHeight: raw.lineHeight ?? TEXT_STYLE_DEFAULTS_RAW.lineHeight,
    letterSpacing: raw.letterSpacing ?? TEXT_STYLE_DEFAULTS_RAW.letterSpacing,
    wordSpacing: raw.wordSpacing ?? TEXT_STYLE_DEFAULTS_RAW.wordSpacing,
    textCase: raw.textCase ?? TEXT_STYLE_DEFAULTS_RAW.textCase,
    underline: raw.underline ?? TEXT_STYLE_DEFAULTS_RAW.underline,
    strikethrough: raw.strikethrough ?? TEXT_STYLE_DEFAULTS_RAW.strikethrough,
    textColor: raw.textColor ?? TEXT_STYLE_DEFAULTS_RAW.textColor,
    paddingTop: raw.paddingTop ?? TEXT_STYLE_DEFAULTS_RAW.paddingTop,
    paddingRight: raw.paddingRight ?? TEXT_STYLE_DEFAULTS_RAW.paddingRight,
    paddingBottom: raw.paddingBottom ?? TEXT_STYLE_DEFAULTS_RAW.paddingBottom,
    paddingLeft: raw.paddingLeft ?? TEXT_STYLE_DEFAULTS_RAW.paddingLeft,
    textRotation: raw.textRotation ?? TEXT_STYLE_DEFAULTS_RAW.textRotation
  }
}

// ── Провайдер метрик (абстракция над opentype / DOM, строится в Neutralino-зоне) ──
export interface TextMetricsProvider {
  /**
   * Ширина строки в px с учётом fontSize и межсимвольного интервала.
   * letterSpacingPx добавляется между соседними символами (и между словами).
   */
  measureWidth(text: string, fontSizePx: number, letterSpacingPx: number): number
  /** Высота надстрочной части (ascender) в px при заданном fontSize. */
  ascenderPx(fontSizePx: number): number
  /** Высота подстрочной части (descender) в px при заданном fontSize. */
  descenderPx(fontSizePx: number): number
}

// ── Модель строки и результата раскладки ───────────────────────────────────────
export interface TextLine {
  text: string
  /** Измеренная ширина строки (px). */
  widthPx: number
  /** Левый край строки с учётом align (px, от внутренней области без padding). */
  xPx: number
  /** Baseline строки (px, от внутренней области без padding). */
  baselineYPx: number
}

export interface TextLayoutResult {
  lines: TextLine[]
  /** fontSizePx * lineHeight. */
  lineHeightPx: number
  /** lines.length * lineHeightPx. */
  totalHeightPx: number
}

export interface TextLayoutOptions {
  text: string
  /** Нормализуется внутри через normalizeTextProps. */
  tp: TextRenderProps
  /** Ширина блока, мм. */
  blockWmm: number
  /** Высота блока, мм. */
  blockHmm: number
  /** Поворот текста; default — tp.textRotation ?? 0. */
  textRotation?: TextRotation
  provider: TextMetricsProvider
  /** default 'word'. */
  wrapMode?: WrapMode
}

// ── Wrap-алгоритм ──────────────────────────────────────────────────────────────

/**
 * Разбивает текст на строки по ширине maxWidthPx.
 *
 * Поведение:
 *  - `\n` — жёсткие переносы (пустые строки сохраняются).
 *  - word (default): перенос по пробелам; сверхдлинное слово → посимвольный fallback.
 *  - char: посимвольный перенос всего текста.
 *  - nowrap: без переноса (только жёсткие `\n`).
 *
 * Возвращает TextLine[] с xPx = 0 и baselineYPx = 0 (позиции проставляет computeTextLayout).
 */
export function wrapText(
  provider: TextMetricsProvider,
  text: string,
  fontSizePx: number,
  maxWidthPx: number,
  letterSpacingPx = 0,
  wrapMode: WrapMode = 'word'
): TextLine[] {
  const ls = letterSpacingPx
  const result: TextLine[] = []
  const push = (lineText: string): void => {
    result.push({
      text: lineText,
      widthPx: provider.measureWidth(lineText, fontSizePx, ls),
      xPx: 0,
      baselineYPx: 0
    })
  }

  const source = String(text)

  if (wrapMode === 'nowrap') {
    for (const paragraph of source.split('\n')) push(paragraph)
    return result
  }

  if (wrapMode === 'char') {
    for (const paragraph of source.split('\n')) {
      if (paragraph === '') {
        push('')
        continue
      }
      let chunk = ''
      for (const ch of Array.from(paragraph)) {
        const candidate = chunk + ch
        if (chunk !== '' && provider.measureWidth(candidate, fontSizePx, ls) > maxWidthPx) {
          push(chunk)
          chunk = ch
        } else {
          chunk = candidate
        }
      }
      if (chunk !== '') push(chunk)
    }
    return result
  }

  // word (по умолчанию) — перенос по словам с char-fallback для сверхдлинных слов
  for (const paragraph of source.split('\n')) {
    const words = paragraph.split(' ').filter(Boolean)
    if (words.length === 0) {
      push('')
      continue
    }

    let line = ''
    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      const wordW = provider.measureWidth(word, fontSizePx, ls)

      if (line === '') {
        if (wordW <= maxWidthPx) {
          line = word
        } else {
          const chunks = charWrapWord(provider, word, fontSizePx, maxWidthPx, ls)
          for (let c = 0; c < chunks.length - 1; c++) push(chunks[c])
          line = chunks[chunks.length - 1]
        }
        continue
      }

      const candidate = line + ' ' + word
      if (provider.measureWidth(candidate, fontSizePx, ls) <= maxWidthPx) {
        line = candidate
      } else {
        push(line)
        if (wordW <= maxWidthPx) {
          line = word
        } else {
          const chunks = charWrapWord(provider, word, fontSizePx, maxWidthPx, ls)
          for (let c = 0; c < chunks.length - 1; c++) push(chunks[c])
          line = chunks[chunks.length - 1]
        }
      }
    }
    if (line !== '') push(line)
  }

  return result
}

/** Посимвольный перенос одного слова. */
function charWrapWord(
  provider: TextMetricsProvider,
  word: string,
  fontSizePx: number,
  maxWidthPx: number,
  letterSpacingPx: number
): string[] {
  const chunks: string[] = []
  let chunk = ''
  for (const ch of Array.from(word)) {
    const candidate = chunk + ch
    if (
      chunk !== '' &&
      provider.measureWidth(candidate, fontSizePx, letterSpacingPx) > maxWidthPx
    ) {
      chunks.push(chunk)
      chunk = ch
    } else {
      chunk = candidate
    }
  }
  if (chunk !== '') chunks.push(chunk)
  return chunks.length ? chunks : ['']
}

// ── Полная раскладка ───────────────────────────────────────────────────────────

/**
 * Повёрнутый контейнер строк текста относительно блока (px).
 *
 * Для 0/180 — это внутренняя область блока (без паддингов): { x: padL, y: padT, w: innerW, h: innerH }.
 * Для 90/270 — оси свопаются (wrapW = innerH, wrapH = innerW), и контейнер ЦЕНТРИРУЕТСЯ
 * относительно внутренней области, чтобы после внешнего rotate(θ) вокруг центра
 * контейнера (= центр внутренней области) текст оставался внутри блока.
 *
 * Это ЕДИНЫЙ источник повёрнутого бокса для computeTextLayout() и всех рендереров
 * (HTML / SVG / канвас) — гарантирует, что перенос и центровка при 90/270 не расходятся.
 */
export interface TextContainerBoxPx {
  /** Левый верхний угол контейнера строк относительно блока (px). */
  x: number
  /** Верхний левый угол контейнера строк относительно блока (px). */
  y: number
  /** Ширина контейнера = wrapW (ось X строк, px). */
  w: number
  /** Высота контейнера = wrapH (ось Y строк, px). */
  h: number
}

/** Единый расчёт повёрнутого бокса строк (см. TextContainerBoxPx). */
export function getTextContainerBox(
  blockWPx: number,
  blockHPx: number,
  tp: TextRenderProps,
  rotation: TextRotation
): TextContainerBoxPx {
  const padL = mmToPx(tp.paddingLeft)
  const padR = mmToPx(tp.paddingRight)
  const padT = mmToPx(tp.paddingTop)
  const padB = mmToPx(tp.paddingBottom)
  const innerW = Math.max(1, blockWPx - padL - padR)
  const innerH = Math.max(1, blockHPx - padT - padB)
  const rotated = rotation === 90 || rotation === 270
  const w = rotated ? innerH : innerW
  const h = rotated ? innerW : innerH
  // Центрируем повёрнутый контейнер относительно внутренней области:
  // центр контейнера (x + w/2, y + h/2) = центр внутренней области (padL + innerW/2, padT + innerH/2).
  const x = padL + (rotated ? (innerW - innerH) / 2 : 0)
  const y = padT + (rotated ? (innerH - innerW) / 2 : 0)
  return { x, y, w, h }
}

/**
 * Вычисляет полную раскладку текстового блока.
 *
 * Порядок:
 *  1. Нормализует tp через normalizeTextProps.
 *  2. Применяет textCase к тексту до измерения.
 *  3. Повёрнутый контейнер строк (wrapW×wrapH) — из getTextContainerBox(): при 90/270
 *     оси свопаются (перенос по «высоте» повёрнутого текста) и контейнер центрируется.
 *  4. wrapText по словам (word) с char-fallback.
 *  5. lineHeightPx = fontSizePx * lineHeight; baselineY по verticalAlign и ascenderPx.
 *  6. xPx по align (left/center/right).
 *
 * Координаты строк возвращаются в системе «повёрнутого текста» (от 0,0 повёрнутого
 * контейнера wrapW×wrapH): текст всегда горизонтален в своём внутреннем пространстве.
 * Рендерер размещает контейнер по getTextContainerBox() и добавляет внешний transform
 * rotate(θ) вокруг ЦЕНТРА контейнера (= центр внутренней области) — единый способ
 * для HTML/SVG/канваса. Именно так текст при 90/270 остаётся внутри блока и центрируется.
 */
export function computeTextLayout(opts: TextLayoutOptions): TextLayoutResult {
  const tp = normalizeTextProps(opts.tp)
  const rotation: TextRotation = opts.textRotation ?? tp.textRotation ?? 0
  const wrapMode: WrapMode = opts.wrapMode ?? 'word'
  const fontSizePx = tp.fontSize

  const displayText = applyTextCase(opts.text, tp.textCase ?? 'none')

  // Повёрнутый контейнер строк (единый источник — используется рендерерами)
  const box = getTextContainerBox(mmToPx(opts.blockWmm), mmToPx(opts.blockHmm), tp, rotation)
  const wrapW = box.w
  const wrapH = box.h

  const wrapped = wrapText(
    opts.provider,
    displayText,
    fontSizePx,
    wrapW,
    tp.letterSpacing ?? 0,
    wrapMode
  )

  const lineHeightPx = fontSizePx * tp.lineHeight
  const totalHeightPx = wrapped.length * lineHeightPx
  const ascenderPx = opts.provider.ascenderPx(fontSizePx)

  // Вертикальное выравнивание блока строк внутри рабочей области (wrapH)
  let startY: number
  if (tp.verticalAlign === 'top') {
    startY = 0
  } else if (tp.verticalAlign === 'bottom') {
    startY = wrapH - totalHeightPx
  } else {
    // middle (по умолчанию)
    startY = (wrapH - totalHeightPx) / 2
  }
  if (startY < 0) startY = 0

  const lines: TextLine[] = wrapped.map((ln, i) => {
    let xPx = 0
    if (tp.align === 'center') xPx = (wrapW - ln.widthPx) / 2
    else if (tp.align === 'right') xPx = wrapW - ln.widthPx
    if (xPx < 0) xPx = 0

    return {
      text: ln.text,
      widthPx: ln.widthPx,
      xPx,
      baselineYPx: startY + i * lineHeightPx + ascenderPx
    }
  })

  return { lines, lineHeightPx, totalHeightPx }
}

// ── Хелперы ────────────────────────────────────────────────────────────────────

/** Применяет textCase к тексту до измерения/раскладки. */
function applyTextCase(text: string, textCase: TextCase): string {
  switch (textCase) {
    case 'uppercase':
      return text.toUpperCase()
    case 'lowercase':
      return text.toLowerCase()
    case 'capitalize':
      return text
        .split(/(\s+)/)
        .map((part) => (part.trim() === '' ? part : part.charAt(0).toUpperCase() + part.slice(1)))
        .join('')
    case 'none':
    default:
      return text
  }
}
