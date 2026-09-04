// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт из 'vitest' ломается на этапе коллекции.
// labelDiff.ts — чистый модуль без Neutralino/DOM → моков не требует (FakeData).
import { DEFAULT_THRESHOLD_MM, diffRenderLines, lineMaxDeltaMm } from '../../assets/labelDiff'
import type { DiffRotation, RenderLine } from '../../assets/labelDiff'
import { MM_TO_PX } from '../../assets/textLayout'

// Допуск: 0.1 мм = 0.378 px (единый MM_TO_PX = 3.78).
// Сдвиг 0.5 px → 0.13228 мм > 0.1 → FAIL.
// Сдвиг 0.3 px → 0.07937 мм < 0.1 → PASS.

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

describe('labelDiff', () => {
  it('DEFAULT_THRESHOLD_MM = 0.1 (контракт плана)', () => {
    expect(DEFAULT_THRESHOLD_MM).toBe(0.1)
  })

  it('совпадающие строки → PASS, без расхождений, delta 0', () => {
    const html = [mk('t1', 'Привет', 10, 5, 40, 14.4), mk('t1', 'мир', 10, 19.4, 20, 14.4)]
    const svg = [mk('t1', 'Привет', 10, 5, 40, 14.4), mk('t1', 'мир', 10, 19.4, 20, 14.4)]

    const report = diffRenderLines(html, svg)

    expect(report.discrepancies).toHaveLength(0)
    expect(report.aggregate.maxDeltaMm).toBe(0)
    expect(report.aggregate.exceedsThreshold).toBe(false)
    expect(report.aggregate.totalLines).toBe(2)
    expect(report.aggregate.comparedLines).toBe(2)
  })

  it('расхождение по x > 0.1 мм → FAIL, deltaMm корректно', () => {
    const html = [mk('t1', 'Привет', 10, 5, 40, 14.4)]
    const svg = [mk('t1', 'Привет', 10.5, 5, 40, 14.4)]

    const report = diffRenderLines(html, svg)

    const dx = report.discrepancies.find((d) => d.axis === 'x')
    expect(dx).toBeDefined()
    expect(dx!.expected).toBe(10)
    expect(dx!.actual).toBe(10.5)
    expect(dx!.deltaPx).toBeCloseTo(0.5, 10)
    expect(dx!.deltaMm).toBeCloseTo(0.5 / MM_TO_PX, 10)
    expect(report.aggregate.maxDeltaMm).toBeCloseTo(0.5 / MM_TO_PX, 10)
    expect(report.aggregate.exceedsThreshold).toBe(true)
  })

  it('расхождение по x < 0.1 мм → PASS (в пределах допуска)', () => {
    const html = [mk('t1', 'Привет', 10, 5, 40, 14.4)]
    const svg = [mk('t1', 'Привет', 10.3, 5, 40, 14.4)]

    const report = diffRenderLines(html, svg)

    expect(report.aggregate.maxDeltaMm).toBeCloseTo(0.3 / MM_TO_PX, 10)
    expect(report.aggregate.exceedsThreshold).toBe(false)
  })

  it('несколько элементов и линий: совпадающий не даёт расхождений, расходящийся — даёт', () => {
    const html = [
      mk('a', 'x', 0, 0, 10, 10),
      mk('a', 'y', 0, 10, 10, 10),
      mk('b', 'z', 5, 0, 15, 10)
    ]
    const svg = [
      mk('a', 'x', 0, 0, 10, 10),
      mk('a', 'y', 0, 10, 10, 10),
      // строка b сдвинута по x на 0.4 px = 0.10582 мм > 0.1
      mk('b', 'z', 5.4, 0, 15, 10)
    ]

    const report = diffRenderLines(html, svg)

    expect(report.aggregate.totalLines).toBe(3)
    expect(report.aggregate.comparedLines).toBe(3)
    // расхождения только у элемента b
    const elIds = new Set(report.discrepancies.map((d) => d.elementId))
    expect([...elIds]).toEqual(['b'])
    expect(report.aggregate.exceedsThreshold).toBe(true)
  })

  it('порог параметризуем: один и тот же delta при пороге 0.2 мм → PASS', () => {
    const html = [mk('t1', 'x', 0, 0, 10, 10)]
    const svg = [mk('t1', 'x', 0.4, 0, 10, 10)] // 0.4 px = 0.10582 мм

    const rDefault = diffRenderLines(html, svg)
    const rLoose = diffRenderLines(html, svg, { thresholdMm: 0.2 })

    expect(rDefault.aggregate.exceedsThreshold).toBe(true) // 0.106 > 0.1
    expect(rLoose.aggregate.exceedsThreshold).toBe(false) // 0.106 < 0.2
    expect(rDefault.aggregate.maxDeltaMm).toBeCloseTo(rLoose.aggregate.maxDeltaMm, 10)
  })

  it('перенос: разное число строк → ось lines + FAIL', () => {
    const html = [mk('t1', 'a', 0, 0, 10, 12), mk('t1', 'b', 0, 12, 10, 12)]
    const svg = [mk('t1', 'a b', 0, 0, 20, 12)]

    const report = diffRenderLines(html, svg)

    const lines = report.discrepancies.find((d) => d.axis === 'lines')
    expect(lines).toBeDefined()
    expect(lines!.expected).toBe(2)
    expect(lines!.actual).toBe(1)
    expect(report.aggregate.exceedsThreshold).toBe(true)
    expect(report.aggregate.totalLines).toBe(2)
    expect(report.aggregate.comparedLines).toBe(1)
  })

  it('разный текст строки → ось text + FAIL', () => {
    const html = [mk('t1', 'abc', 0, 0, 30, 10)]
    const svg = [mk('t1', 'abd', 0, 0, 30, 10)]

    const report = diffRenderLines(html, svg)

    const text = report.discrepancies.find((d) => d.axis === 'text')
    expect(text).toBeDefined()
    expect(text!.expected).toBe('abc')
    expect(text!.actual).toBe('abd')
    expect(report.aggregate.exceedsThreshold).toBe(true)
  })

  it('height сравнивается когда задана на обеих сторонах', () => {
    const html = [mk('t1', 'x', 0, 0, 10, 14.4)]
    const svg = [mk('t1', 'x', 0, 0, 10, 14.6)] // Δheight 0.2 px = 0.053 мм < 0.1

    const report = diffRenderLines(html, svg)
    const height = report.discrepancies.find((d) => d.axis === 'height')
    expect(height).toBeDefined()
    expect(height!.deltaPx).toBeCloseTo(0.2, 10)
    expect(height!.deltaMm).toBeCloseTo(0.2 / MM_TO_PX, 10)
    expect(report.aggregate.exceedsThreshold).toBe(false)
  })

  it('height > 0.1 мм → FAIL', () => {
    const html = [mk('t1', 'x', 0, 0, 10, 14.4)]
    const svg = [mk('t1', 'x', 0, 0, 10, 15.0)] // Δheight 0.6 px = 0.159 мм > 0.1

    const report = diffRenderLines(html, svg)
    expect(report.discrepancies.some((d) => d.axis === 'height')).toBe(true)
    expect(report.aggregate.exceedsThreshold).toBe(true)
  })

  it('height пропускается, если не задана на одной из сторон', () => {
    const html = [mk('t1', 'x', 0, 0, 10)] // heightPx undefined
    const svg = [mk('t1', 'x', 0, 0, 10, 14.4)]

    const report = diffRenderLines(html, svg)
    expect(report.discrepancies.find((d) => d.axis === 'height')).toBeUndefined()
    expect(report.aggregate.exceedsThreshold).toBe(false)
  })

  it('lineMaxDeltaMm: отсутствие строки в слое → Infinity; совпадение → 0', () => {
    const h = mk('t1', 'x', 10, 5, 40, 14.4)
    const s = mk('t1', 'x', 10, 5, 40, 14.4)

    expect(lineMaxDeltaMm(h, s)).toBe(0)
    expect(lineMaxDeltaMm(h, undefined)).toBe(Number.POSITIVE_INFINITY)
  })
})
