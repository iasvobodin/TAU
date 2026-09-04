// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт `import { describe } from 'vitest'`
// приводит к ошибке "Cannot read properties of undefined (reading 'config')".
import {
  MM_TO_PX,
  mmToPx,
  pxToMm,
  normalizeTextProps,
  wrapText,
  computeTextLayout,
  getTextContainerBox
} from '../../assets/textLayout'
import type { TextMetricsProvider } from '../../assets/textLayout'
import type { TextRenderProps } from '../../types/label'
import { resolveTextProps } from '../../types/label'

// ─── FakeMetricsProvider ──────────────────────────────────────────────────────
// Детерминированные метрики: каждая буква 10px, пробел 4px, letterSpacing
// добавляется между соседними символами; ascender = 8, descender = 2.
function createFakeProvider(
  opts: {
    charWidth?: number
    spaceWidth?: number
    ascender?: number
    descender?: number
  } = {}
): TextMetricsProvider {
  const charWidth = opts.charWidth ?? 10
  const spaceWidth = opts.spaceWidth ?? 4
  const ascender = opts.ascender ?? 8
  const descender = opts.descender ?? 2
  return {
    measureWidth(text, _fontSizePx, letterSpacingPx = 0) {
      const chars = Array.from(text)
      let w = 0
      for (const ch of chars) w += ch === ' ' ? spaceWidth : charWidth
      if (chars.length > 1) w += letterSpacingPx * (chars.length - 1)
      return w
    },
    ascenderPx: () => ascender,
    descenderPx: () => descender
  }
}

function baseTp(over: Partial<TextRenderProps> = {}): TextRenderProps {
  return {
    fontSize: 12,
    fontFamily: 'Arial',
    bold: false,
    align: 'left',
    verticalAlign: 'top',
    lineHeight: 1.2,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    textRotation: 0,
    ...over
  }
}

// ─── Константы ────────────────────────────────────────────────────────────────
describe('mmToPx / pxToMm', () => {
  it('uses the single unified constant', () => {
    expect(MM_TO_PX).toBe(3.78)
    expect(mmToPx(1)).toBeCloseTo(3.78, 6)
    expect(mmToPx(10)).toBeCloseTo(37.8, 6)
    expect(pxToMm(3.78)).toBeCloseTo(1, 6)
    expect(pxToMm(37.8)).toBeCloseTo(10, 6)
    expect(mmToPx(pxToMm(123.456))).toBeCloseTo(123.456, 6)
  })
})

// ─── normalizeTextProps ───────────────────────────────────────────────────────
describe('normalizeTextProps', () => {
  it('fills all defaults for empty props', () => {
    const r = normalizeTextProps({})
    expect(r.fontSize).toBe(12)
    expect(r.fontFamily).toBe('Arial')
    expect(r.bold).toBe(false)
    expect(r.italic).toBe(false)
    expect(r.align).toBe('left')
    expect(r.verticalAlign).toBe('middle')
    expect(r.lineHeight).toBe(1.2)
    expect(r.letterSpacing).toBe(0)
    expect(r.wordSpacing).toBe(0)
    expect(r.textCase).toBe('none')
    expect(r.underline).toBe(false)
    expect(r.strikethrough).toBe(false)
    expect(r.textColor).toBe('#000000')
    expect(r.paddingTop).toBe(0)
    expect(r.paddingRight).toBe(0)
    expect(r.paddingBottom).toBe(0)
    expect(r.paddingLeft).toBe(0)
    expect(r.textRotation).toBe(0)
  })

  it('keeps provided values and does not overwrite them with defaults', () => {
    const r = normalizeTextProps({
      fontSize: 16,
      fontFamily: 'Roboto',
      bold: true,
      italic: true,
      align: 'center',
      verticalAlign: 'bottom',
      lineHeight: 1.5,
      letterSpacing: 2,
      wordSpacing: 3,
      textCase: 'uppercase',
      underline: true,
      strikethrough: true,
      textColor: '#ff0000',
      paddingTop: 1,
      paddingRight: 2,
      paddingBottom: 3,
      paddingLeft: 4,
      textRotation: 90
    })
    expect(r).toEqual({
      fontSize: 16,
      fontFamily: 'Roboto',
      bold: true,
      italic: true,
      align: 'center',
      verticalAlign: 'bottom',
      lineHeight: 1.5,
      letterSpacing: 2,
      wordSpacing: 3,
      textCase: 'uppercase',
      underline: true,
      strikethrough: true,
      textColor: '#ff0000',
      paddingTop: 1,
      paddingRight: 2,
      paddingBottom: 3,
      paddingLeft: 4,
      textRotation: 90
    })
  })

  it('normalizes partial raw props', () => {
    const r = normalizeTextProps({ fontSize: 20, align: 'right' })
    expect(r.fontSize).toBe(20)
    expect(r.align).toBe('right')
    expect(r.verticalAlign).toBe('middle')
    expect(r.textRotation).toBe(0)
  })
})

// ─── resolveTextProps: миграция legacy padding ────────────────────────────────
describe('resolveTextProps (legacy padding migration)', () => {
  it('migrates paddingX/paddingY from px to mm', () => {
    const r = resolveTextProps({ fontSize: 14, paddingX: 3.78, paddingY: 7.56 })
    expect(r.paddingLeft).toBeCloseTo(1, 6)
    expect(r.paddingRight).toBeCloseTo(1, 6)
    expect(r.paddingTop).toBeCloseTo(2, 6)
    expect(r.paddingBottom).toBeCloseTo(2, 6)
    expect(r.fontSize).toBe(14)
    expect(r.fontFamily).toBe('Arial')
    expect(r.textRotation).toBe(0)
  })

  it('individual paddings take precedence over legacy', () => {
    const r = resolveTextProps({ paddingX: 3.78, paddingLeft: 5 })
    expect(r.paddingLeft).toBe(5)
    expect(r.paddingRight).toBeCloseTo(1, 6)
    expect(r.paddingTop).toBe(0)
    expect(r.paddingBottom).toBe(0)
  })

  it('passes new text fields through', () => {
    const r = resolveTextProps({
      textCase: 'uppercase',
      letterSpacing: 2,
      italic: true,
      textRotation: 90
    })
    expect(r.textCase).toBe('uppercase')
    expect(r.letterSpacing).toBe(2)
    expect(r.italic).toBe(true)
    expect(r.textRotation).toBe(90)
    expect(r.underline).toBe(false)
  })
})

// ─── wrapText ─────────────────────────────────────────────────────────────────
describe('wrapText', () => {
  const p = createFakeProvider()

  it('keeps a single line when it fits', () => {
    const lines = wrapText(p, 'hello world', 12, 1000)
    expect(lines.map((l) => l.text)).toEqual(['hello world'])
    expect(lines[0].widthPx).toBe(104) // 50 + 4 + 50
  })

  it('wraps by words', () => {
    const lines = wrapText(p, 'hello world foo', 12, 100)
    expect(lines.map((l) => l.text)).toEqual(['hello', 'world foo'])
    expect(lines[0].widthPx).toBe(50)
    expect(lines[1].widthPx).toBe(84) // 50 + 4 + 30
  })

  it('falls back to char wrapping for an overlong word', () => {
    const lines = wrapText(p, 'abcdefgh', 12, 45)
    expect(lines.map((l) => l.text)).toEqual(['abcd', 'efgh'])
    expect(lines[0].widthPx).toBe(40)
    expect(lines[1].widthPx).toBe(40)
  })

  it('char-wraps an overlong word and continues with following words', () => {
    const lines = wrapText(p, 'abcdefgh ij', 12, 40)
    // 'abcdefgh'(80) > 40 → 'abcd' + 'efgh'; 'ij' на новую строку
    expect(lines.map((l) => l.text)).toEqual(['abcd', 'efgh', 'ij'])
  })

  it('preserves hard line breaks and empty lines', () => {
    const lines = wrapText(p, 'a\n\nb c', 12, 1000)
    expect(lines.map((l) => l.text)).toEqual(['a', '', 'b c'])
    expect(lines[0].widthPx).toBe(10)
    expect(lines[1].widthPx).toBe(0)
    expect(lines[2].widthPx).toBe(24) // 10 + 4 + 10
  })

  it('char wrap mode breaks by character', () => {
    const lines = wrapText(p, 'abcdef', 12, 25, 0, 'char')
    expect(lines.map((l) => l.text)).toEqual(['ab', 'cd', 'ef'])
  })

  it('nowrap mode does not wrap', () => {
    const lines = wrapText(p, 'hello world', 12, 20, 0, 'nowrap')
    expect(lines.map((l) => l.text)).toEqual(['hello world'])
    expect(lines[0].widthPx).toBe(104)
  })

  it('letterSpacing increases measured width and affects wrapping', () => {
    // 'aa' с letterSpacing 2 → 10 + 2 + 10 = 22 > 21 → две строки по одному символу
    const lines = wrapText(p, 'aa', 12, 21, 2)
    expect(lines.map((l) => l.text)).toEqual(['a', 'a'])
    expect(lines[0].widthPx).toBe(10)
  })
})

// ─── computeTextLayout ────────────────────────────────────────────────────────
describe('computeTextLayout', () => {
  const p = createFakeProvider()
  // Блок 100x20 мм → 378 x 75.6 px (без паддингов)

  it('align left / verticalAlign top places baseline at ascender', () => {
    const r = computeTextLayout({
      text: 'hello',
      tp: baseTp(),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0].text).toBe('hello')
    expect(r.lines[0].xPx).toBe(0)
    expect(r.lines[0].baselineYPx).toBe(8) // ascender
    expect(r.lineHeightPx).toBeCloseTo(14.4, 6)
    expect(r.totalHeightPx).toBeCloseTo(14.4, 6)
  })

  it('verticalAlign middle and bottom shift baseline within innerH', () => {
    const middle = computeTextLayout({
      text: 'hello',
      tp: baseTp({ verticalAlign: 'middle' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    // startY = (75.6 - 14.4) / 2 = 30.6; baseline = 30.6 + 8 = 38.6
    expect(middle.lines[0].baselineYPx).toBeCloseTo(38.6, 6)

    const bottom = computeTextLayout({
      text: 'hello',
      tp: baseTp({ verticalAlign: 'bottom' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    // startY = 75.6 - 14.4 = 61.2; baseline = 61.2 + 8 = 69.2
    expect(bottom.lines[0].baselineYPx).toBeCloseTo(69.2, 6)
  })

  it('align center and right set xPx within wrap width', () => {
    const text = 'hello' // width 50, wrapW = 378
    const center = computeTextLayout({
      text,
      tp: baseTp({ align: 'center' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(center.lines[0].xPx).toBeCloseTo((378 - 50) / 2, 6)

    const right = computeTextLayout({
      text,
      tp: baseTp({ align: 'right' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(right.lines[0].xPx).toBeCloseTo(378 - 50, 6)
  })

  it('lineHeight multiplies line spacing for 0.9 / 1.2 / 1.5', () => {
    for (const lh of [0.9, 1.2, 1.5]) {
      const r = computeTextLayout({
        text: 'a\nb',
        tp: baseTp({ lineHeight: lh }),
        blockWmm: 100,
        blockHmm: 20,
        provider: p
      })
      expect(r.lineHeightPx).toBeCloseTo(12 * lh, 6)
      expect(r.totalHeightPx).toBeCloseTo(2 * 12 * lh, 6)
      expect(r.lines[1].baselineYPx - r.lines[0].baselineYPx).toBeCloseTo(12 * lh, 6)
    }
  })

  it('padding shrinks the inner area', () => {
    // паддинг 1 мм со всех сторон: innerW = (100-2)*3.78 = 370.44
    const r = computeTextLayout({
      text: 'hello',
      tp: baseTp({
        paddingTop: 1,
        paddingRight: 1,
        paddingBottom: 1,
        paddingLeft: 1,
        verticalAlign: 'top'
      }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(r.lines[0].xPx).toBe(0)
    expect(r.lines[0].baselineYPx).toBe(8)

    const center = computeTextLayout({
      text: 'hello',
      tp: baseTp({ paddingLeft: 1, paddingRight: 1, align: 'center' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(center.lines[0].xPx).toBeCloseTo((370.44 - 50) / 2, 6)
  })

  it('applies textCase before measurement', () => {
    const upper = computeTextLayout({
      text: 'hello world',
      tp: baseTp({ textCase: 'uppercase' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(upper.lines[0].text).toBe('HELLO WORLD')

    const lower = computeTextLayout({
      text: 'HELLO WORLD',
      tp: baseTp({ textCase: 'lowercase' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(lower.lines[0].text).toBe('hello world')

    const cap = computeTextLayout({
      text: 'hello world',
      tp: baseTp({ textCase: 'capitalize' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(cap.lines[0].text).toBe('Hello World')
  })

  it('clamps startY to 0 when text overflows the area', () => {
    const r = computeTextLayout({
      text: 'a\nb\nc\nd\ne',
      tp: baseTp({ verticalAlign: 'middle' }),
      blockWmm: 20,
      blockHmm: 10,
      provider: p
    })
    // innerH = 37.8, totalHeight = 5*14.4 = 72 > 37.8 → startY = 0
    expect(r.lines[0].baselineYPx).toBeCloseTo(8, 6)
  })

  // ── Повороты ──
  it('rotation 0 and 180 use innerW as wrap width (no swap)', () => {
    const text = 'hello world foo'
    const r0 = computeTextLayout({
      text,
      tp: baseTp(),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 0
    })
    expect(r0.lines.map((l) => l.text)).toEqual(['hello world foo'])

    const r180 = computeTextLayout({
      text,
      tp: baseTp(),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 180
    })
    expect(r180.lines.map((l) => l.text)).toEqual(['hello world foo'])
    // 180° — без swap: те же wrapW/wrapH и координаты в системе повёрнутого текста
    expect(r180.lines[0].baselineYPx).toBe(r0.lines[0].baselineYPx)
    expect(r180.lines[0].xPx).toBe(r0.lines[0].xPx)
  })

  it('rotation 90/270 swap wrapW to innerH and wrap by words', () => {
    const text = 'hello world foo'
    // wrapW = innerH = 75.6 → 'hello', 'world', 'foo'
    const r90 = computeTextLayout({
      text,
      tp: baseTp(),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 90
    })
    expect(r90.lines.map((l) => l.text)).toEqual(['hello', 'world', 'foo'])
    // verticalAlign top → baselines 8, 22.4, 36.8; wrapH = innerW = 378
    expect(r90.lines[0].baselineYPx).toBeCloseTo(8, 6)
    expect(r90.lines[1].baselineYPx).toBeCloseTo(22.4, 6)
    expect(r90.lines[2].baselineYPx).toBeCloseTo(36.8, 6)
    expect(r90.totalHeightPx).toBeCloseTo(43.2, 6)

    const r270 = computeTextLayout({
      text,
      tp: baseTp(),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 270
    })
    expect(r270.lines.map((l) => l.text)).toEqual(['hello', 'world', 'foo'])
  })

  it('uses tp.textRotation when options omit textRotation', () => {
    const r = computeTextLayout({
      text: 'hello world foo',
      tp: baseTp({ textRotation: 90 }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p
    })
    expect(r.lines.map((l) => l.text)).toEqual(['hello', 'world', 'foo'])
  })

  it('coordinates are returned in rotated-text space for 90°', () => {
    // wrapH = innerW = 378; totalHeight = 14.4 → startY = (378-14.4)/2 = 181.8
    const r = computeTextLayout({
      text: 'hello',
      tp: baseTp({ verticalAlign: 'middle' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 90
    })
    expect(r.lines[0].baselineYPx).toBeCloseTo(181.8 + 8, 6)
    expect(r.lines[0].xPx).toBe(0)
  })

  it('длинный текст: при 90/270 перенос пересчитывается под НОВУЮ ширину (wrapW=innerH) и центрируется относительно повёрнутого поля', () => {
    // Блок 100x20 мм → innerW=378, innerH=75.6; слова по 20px, пробел 4px
    const text = 'AA BB CC DD EE FF GG HH' // 8 слов
    // Без поворота весь текст влезает в одну строку (wrapW=378)
    const r0 = computeTextLayout({
      text,
      tp: baseTp({ verticalAlign: 'middle', align: 'center' }),
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 0
    })
    expect(r0.lines.map((l) => l.text)).toEqual(['AA BB CC DD EE FF GG HH'])

    // При 90/270 wrapW = innerH = 75.6 → текст переносится на 3 строки
    for (const rot of [90, 270] as const) {
      const r = computeTextLayout({
        text,
        tp: baseTp({ verticalAlign: 'middle', align: 'center' }),
        blockWmm: 100,
        blockHmm: 20,
        provider: p,
        textRotation: rot
      })
      expect(r.lines.map((l) => l.text)).toEqual(['AA BB CC', 'DD EE FF', 'GG HH'])
      // verticalAlign middle — блок строк центрируется по wrapH = innerW = 378
      const totalHeightPx = 3 * 14.4 // 43.2
      const startY = (378 - totalHeightPx) / 2 // 167.4
      expect(r.lines[0].baselineYPx).toBeCloseTo(startY + 8, 6)
      expect(r.lines[2].baselineYPx - r.lines[0].baselineYPx).toBeCloseTo(2 * 14.4, 6)
      // align center — строки центрируются по wrapW = innerH = 75.6
      expect(r.lines[0].xPx).toBeCloseTo((75.6 - 68) / 2, 6) // 'AA BB CC' ширина 68
      expect(r.lines[2].xPx).toBeCloseTo((75.6 - 44) / 2, 6) // 'GG HH' ширина 44
    }
  })
})

// ─── getTextContainerBox (повёрнутый контейнер строк) ─────────────────────────
describe('getTextContainerBox', () => {
  const p = createFakeProvider()
  it('для 0/180 возвращает внутреннюю область без свопа и сдвига', () => {
    const b0 = getTextContainerBox(378, 75.6, baseTp(), 0)
    expect(b0).toEqual({ x: 0, y: 0, w: 378, h: 75.6 })
    const b180 = getTextContainerBox(378, 75.6, baseTp(), 180)
    expect(b180).toEqual({ x: 0, y: 0, w: 378, h: 75.6 })
  })

  it('для 90/270 свопает оси и ЦЕНТРИРУЕТ контейнер относительно внутренней области', () => {
    // Блок 100x20 мм → 378x75.6; повёрнутый контейнер 75.6x378, центр в (189, 37.8)
    const b90 = getTextContainerBox(378, 75.6, baseTp(), 90)
    expect(b90.w).toBeCloseTo(75.6, 6)
    expect(b90.h).toBeCloseTo(378, 6)
    expect(b90.x).toBeCloseTo((378 - 75.6) / 2, 6) // 151.2
    expect(b90.y).toBeCloseTo((75.6 - 378) / 2, 6) // -151.2
    // Центр контейнера = центр блока (и центр внутренней области)
    expect(b90.x + b90.w / 2).toBeCloseTo(378 / 2, 6)
    expect(b90.y + b90.h / 2).toBeCloseTo(75.6 / 2, 6)

    const b270 = getTextContainerBox(378, 75.6, baseTp(), 270)
    expect(b270).toEqual(b90)
  })

  it('учитывает паддинги: контейнер центрируется относительно внутренней области, а не блока', () => {
    // Паддинг 1 мм со всех сторон: pad=3.78; innerW=370.44, innerH=68.04
    const tp = baseTp({ paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 1 })
    const b = getTextContainerBox(378, 75.6, tp, 90)
    expect(b.w).toBeCloseTo(68.04, 6)
    expect(b.h).toBeCloseTo(370.44, 6)
    // Центр контейнера = центр внутренней области (симметричные паддинги → центр блока)
    expect(b.x + b.w / 2).toBeCloseTo(378 / 2, 6)
    expect(b.y + b.h / 2).toBeCloseTo(75.6 / 2, 6)
    // Сдвиг от внутренней области: ((370.44-68.04)/2, (68.04-370.44)/2)
    expect(b.x).toBeCloseTo(3.78 + (370.44 - 68.04) / 2, 6)
    expect(b.y).toBeCloseTo(3.78 + (68.04 - 370.44) / 2, 6)
  })

  it('computeTextLayout и getTextContainerBox согласованы (единый источник wrapW/wrapH)', () => {
    const tp = baseTp({ paddingTop: 1, paddingRight: 1, paddingBottom: 1, paddingLeft: 1 })
    const layout = computeTextLayout({
      text: 'AA BB CC DD EE',
      tp,
      blockWmm: 100,
      blockHmm: 20,
      provider: p,
      textRotation: 90
    })
    const box = getTextContainerBox(mmToPx(100), mmToPx(20), tp, 90)
    // wrapW = box.w = innerH = 75.6 - 7.56 = 68.04 → 'AA BB CC' (68) влезает, 'DD EE' — вторая строка
    expect(box.w).toBeCloseTo(mmToPx(20) - mmToPx(2), 6)
    expect(layout.lines.map((l) => l.text)).toEqual(['AA BB CC', 'DD EE'])
  })
})
