// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт из 'vitest' ломается на этапе коллекции.
// labelDiff.ts — чистый модуль без Neutralino/DOM → моков не требует (FakeData).
//
// Тесты посимвольной сверки: computeCharPositions + diffRenderCharacters.
// Допуск: 0.1 мм = 0.378 px (единый MM_TO_PX = 3.78).
// Сдвиг 0.5 px → 0.13228 мм > 0.1 → FAIL.
// Сдвиг 0.3 px → 0.07937 мм < 0.1 → PASS.
import {
  CHAR_DIFF_LINES_MARKER,
  CHAR_DIFF_TEXT_MARKER,
  computeCharPositions,
  diffRenderCharacters
} from '../../assets/labelDiff'
import type { CharPos, DiffRotation, RenderLine } from '../../assets/labelDiff'
import { MM_TO_PX } from '../../assets/textLayout'
import type { TextMetricsProvider } from '../../assets/textLayout'

/**
 * Детерминированный фейк-провайдер метрик: каждый символ имеет ширину
 * `charW` px, а letterSpacing добавляется к каждому измеренному символу
 * (`charW + ls` на символ) — так letterSpacing явно влияет на кумулятивные
 * позиции, что позволяет проверить передачу аргумента.
 */
function fakeProvider(charW = 10, asc = 8, desc = 2): TextMetricsProvider {
  return {
    measureWidth(text: string, _fontSizePx: number, ls: number) {
      return Array.from(text).length * (charW + ls)
    },
    ascenderPx() {
      return asc
    },
    descenderPx() {
      return desc
    }
  }
}

function mk(
  elementId: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number | undefined = undefined,
  rotation: DiffRotation = 0
): RenderLine {
  return {
    elementId,
    text,
    xPx: x,
    yPx: y,
    widthPx: w,
    heightPx: h,
    rotation,
    layerId: undefined
  }
}

function charOpts(
  provider: TextMetricsProvider = fakeProvider(),
  fontSize = 12,
  thresholdMm = 0.1
): {
  providerFor: () => TextMetricsProvider
  fontSizeFor: () => number
  thresholdMm: number
} {
  return { providerFor: () => provider, fontSizeFor: () => fontSize, thresholdMm }
}

describe('computeCharPositions', () => {
  it('кумулятивные x: x0 = xStartPx, далее сумма advance предыдущих символов', () => {
    const provider = fakeProvider(10)
    const pos = computeCharPositions(provider, 'ABC', 100, 12)

    expect(pos).toHaveLength(3)
    expect(pos[0]).toEqual({ char: 'A', xPx: 100, index: 0 })
    expect(pos[1]).toEqual({ char: 'B', xPx: 110, index: 1 })
    expect(pos[2]).toEqual({ char: 'C', xPx: 120, index: 2 })
  })

  it('учёт letterSpacing: аргумент пробрасывается в measureWidth и влияет на позиции', () => {
    const provider = fakeProvider(10)
    // Без letterSpacing: шаг 10px
    const plain = computeCharPositions(provider, 'ABC', 0, 12)
    expect(plain[1].xPx).toBe(10)
    expect(plain[2].xPx).toBe(20)

    // С letterSpacing=2: каждый символ имеет ширину 10+2=12 → шаг 12px
    const spaced = computeCharPositions(provider, 'ABC', 0, 12, 2)
    expect(spaced[1].xPx).toBe(12)
    expect(spaced[2].xPx).toBe(24)
  })

  it('пустая строка → пустой массив', () => {
    expect(computeCharPositions(fakeProvider(), '', 0, 12)).toEqual([])
  })

  it('пробелы учитываются как обычные символы (свой advance)', () => {
    const pos = computeCharPositions(fakeProvider(10), 'A B', 0, 12)
    expect(pos).toEqual([
      { char: 'A', xPx: 0, index: 0 },
      { char: ' ', xPx: 10, index: 1 },
      { char: 'B', xPx: 20, index: 2 }
    ])
  })

  it('суррогатные пары (эмодзи) считаются одним символом', () => {
    const pos = computeCharPositions(fakeProvider(10), 'A😀B', 0, 12)
    expect(pos).toHaveLength(3)
    expect(pos[1].char).toBe('😀')
    expect(pos[1].xPx).toBe(10)
    expect(pos[2].xPx).toBe(20)
  })
})

describe('diffRenderCharacters', () => {
  it('совпадающие строки (тот же текст и x) → 0 расхождений, все символы сравнены', () => {
    const html = [mk('t1', 'ABC', 0, 0, 30, 14.4)]
    const svg = [mk('t1', 'ABC', 0, 0, 30, 14.4)]

    const report = diffRenderCharacters(html, svg, charOpts())

    expect(report.discrepancies).toHaveLength(0)
    expect(report.comparedChars).toBe(3)
    expect(report.maxDeltaMm).toBe(0)
    expect(report.exceedsThreshold).toBe(false)
  })

  it('разный текст строки → структурное расхождение <text> + FAIL', () => {
    const html = [mk('t1', 'ABC', 0, 0, 30)]
    const svg = [mk('t1', 'ABX', 0, 0, 30)]

    const report = diffRenderCharacters(html, svg, charOpts())

    const d = report.discrepancies.find((x) => x.char === CHAR_DIFF_TEXT_MARKER)
    expect(d).toBeDefined()
    expect(d!.charIndex).toBe(-1)
    expect(d!.lineIndex).toBe(0)
    expect(report.comparedChars).toBe(0)
    expect(report.exceedsThreshold).toBe(true)
  })

  it('разное число строк (перенос) → структурное расхождение <lines> + FAIL', () => {
    const html = [mk('t1', 'A', 0, 0, 10), mk('t1', 'B', 0, 12, 10)]
    const svg = [mk('t1', 'AB', 0, 0, 20)]

    const report = diffRenderCharacters(html, svg, charOpts())

    const d = report.discrepancies.find((x) => x.char === CHAR_DIFF_LINES_MARKER)
    expect(d).toBeDefined()
    expect(d!.expectedX).toBe(2) // число строк HTML
    expect(d!.actualX).toBe(1) // число строк SVG
    expect(report.exceedsThreshold).toBe(true)
  })

  it('смещение строки по x: расхождение каждого символа, deltaMm корректно (0.132 мм > 0.1 → FAIL)', () => {
    const html = [mk('t1', 'ABC', 0, 0, 30)]
    const svg = [mk('t1', 'ABC', 0.5, 0, 30)] // 0.5 px = 0.13228 мм

    const report = diffRenderCharacters(html, svg, charOpts())

    expect(report.discrepancies).toHaveLength(3) // A, B, C — все сдвинуты на 0.5 px
    const d0 = report.discrepancies[0]
    expect(d0.char).toBe('A')
    expect(d0.expectedX).toBe(0)
    expect(d0.actualX).toBe(0.5)
    expect(d0.deltaPx).toBeCloseTo(0.5, 10)
    expect(d0.deltaMm).toBeCloseTo(0.5 / MM_TO_PX, 10)
    expect(report.maxDeltaMm).toBeCloseTo(0.5 / MM_TO_PX, 10)
    expect(report.exceedsThreshold).toBe(true)
  })

  it('смещение 0.3 px (0.079 мм < 0.1) → PASS (в пределах допуска)', () => {
    const html = [mk('t1', 'ABC', 0, 0, 30)]
    const svg = [mk('t1', 'ABC', 0.3, 0, 30)]

    const report = diffRenderCharacters(html, svg, charOpts())

    expect(report.maxDeltaMm).toBeCloseTo(0.3 / MM_TO_PX, 10)
    expect(report.exceedsThreshold).toBe(false)
  })

  it('порог параметризуем: один и тот же delta при пороге 0.2 мм → PASS', () => {
    const html = [mk('t1', 'ABC', 0, 0, 30)]
    const svg = [mk('t1', 'ABC', 0.5, 0, 30)] // 0.132 мм

    const rDefault = diffRenderCharacters(html, svg, charOpts(fakeProvider(), 12, 0.1))
    const rLoose = diffRenderCharacters(html, svg, charOpts(fakeProvider(), 12, 0.2))

    expect(rDefault.exceedsThreshold).toBe(true) // 0.132 > 0.1
    expect(rLoose.exceedsThreshold).toBe(false) // 0.132 < 0.2
    expect(rLoose.maxDeltaMm).toBeCloseTo(rDefault.maxDeltaMm, 10)
  })

  it('htmlCharPositionsFor: реальные браузерные позиции HTML-слоя используются вместо численных', () => {
    const html = [mk('t1', 'AB', 0, 0, 20)]
    const svg = [mk('t1', 'AB', 0, 0, 20)]
    // Реальное измерение дало «B» на x=11 вместо численных 10 (метрики провайдера
    // отличаются от фактического рендера) — расхождение появляется у символа B.
    const measured: CharPos[] = [
      { char: 'A', xPx: 0, index: 0 },
      { char: 'B', xPx: 11, index: 1 }
    ]

    const report = diffRenderCharacters(html, svg, {
      ...charOpts(),
      htmlCharPositionsFor: (id, li) => (id === 't1' && li === 0 ? measured : undefined)
    })

    expect(report.discrepancies).toHaveLength(1)
    const d = report.discrepancies[0]
    expect(d.char).toBe('B')
    expect(d.expectedX).toBe(11)
    expect(d.actualX).toBe(10)
    expect(d.deltaPx).toBeCloseTo(1, 10)
    expect(d.deltaMm).toBeCloseTo(1 / MM_TO_PX, 10)
    expect(report.comparedChars).toBe(2)
    expect(report.exceedsThreshold).toBe(true) // 1 px = 0.265 мм > 0.1
  })

  it('без провайдера/размера шрифта посимвольное сравнение пропускается (0 сравненных)', () => {
    const html = [mk('t1', 'AB', 0, 0, 20)]
    const svg = [mk('t1', 'AB', 0.5, 0, 20)]

    const report = diffRenderCharacters(html, svg, {
      providerFor: () => undefined,
      fontSizeFor: () => 12
    })

    expect(report.comparedChars).toBe(0)
    expect(report.discrepancies).toHaveLength(0)
    expect(report.maxDeltaMm).toBe(0)
    expect(report.exceedsThreshold).toBe(false)
  })
})
