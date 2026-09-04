// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт `import { describe } from 'vitest'`
// приводит к ошибке "Cannot read properties of undefined (reading 'config')".
//
// Моки Neutralino: htmlRenderer.ts импортирует renderToSVG.ts (filesystem +
// fontManager), поэтому в тестах подменяем оба — loadFont уходит в fallback-ветку
// без шрифта (FALLBACK_TEXT_METRICS_PROVIDER, детерминированные метрики:
// width ≈ 0.6em/символ, ascender = 0.8em, descender = 0.2em). Это позволяет
// проверить HTML-раскладку через computeTextLayout без реального шрифта.

vi.mock('@neutralinojs/lib', () => ({
  filesystem: {
    readBinaryFile: vi.fn(() => Promise.reject(new Error('mock: шрифт не найден'))),
    readFile: vi.fn(() => Promise.reject(new Error('mock: нет БД'))),
    createDirectory: vi.fn(() => Promise.resolve())
  },
  computer: {},
  os: {}
}))

vi.mock('@/assets/fontManager', () => ({
  fontManager: {
    getPathByFullName: vi.fn(() => undefined)
  }
}))

import { renderLabelToHTML, renderLabelSheetToHTML } from '@/assets/htmlRenderer'
import { MM_TO_PX } from '@/assets/textLayout'
import type { PrintTemplateData, PrintLayoutConfig, BatchItem } from '@/types/label'

// Сущности собираются конкатенацией, чтобы в исходнике теста не было
// литеральных HTML-сущностей (инструмент записи декодирует их в символы).
// На рантайме: AMP = '&' + 'amp;' === '&', LT = '&' + 'lt;' === '<'.
const AMP = '&' + 'amp;'
const LT = '&' + 'lt;'

// ── Фикстура: одна этикетка 60x40мм, один text-элемент 40x20мм ──────────────

function makeTemplate(overrides: Partial<PrintTemplateData> = {}): PrintTemplateData {
  return {
    positions: {
      t1: { x: 10, y: 10, w: 40, h: 20 }
    },
    elements: {
      t1: {
        id: 't1',
        type: 'text',
        dataField: 'F1',
        props: {
          fontSize: 12,
          fontFamily: 'Arial',
          align: 'left',
          verticalAlign: 'top',
          lineHeight: 1.2,
          textRotation: 0
        }
      }
    },
    labelSize: { width: 60, height: 40, unit: 'mm' },
    labelBorder: { enabled: false, width: 1, color: '#000' },
    ...overrides
  }
}

function makeTextRotationTemplate(rotation: 0 | 90 | 180 | 270): PrintTemplateData {
  const t = makeTemplate()
  const el = t.elements.t1 as {
    props: {
      fontSize: number
      fontFamily: string
      align: string
      verticalAlign: string
      lineHeight: number
      textRotation: 0 | 90 | 180 | 270
    }
  }
  el.props.textRotation = rotation
  return t
}

// ── Хелперы разбора HTML-вывода ──────────────────────────────────────────────

// Числовое значение CSS-свойства в px из style-строки (без units-разбора %).
function pxValue(style: string, prop: string): number {
  const m = style.match(new RegExp(prop + ':(-?[\\d.]+)px'))
  if (!m) throw new Error(`px-свойство ${prop} не найдено в: ${style}`)
  return parseFloat(m[1])
}

// CSS rotate(θdeg) (ось y вниз): x' = x·cos − y·sin; y' = x·sin + y·cos.
// Поворот точки вокруг центра (cx, cy).
function rotatePoint(
  px: number,
  py: number,
  cx: number,
  cy: number,
  theta: number
): [number, number] {
  const rad = (theta * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = px - cx
  const dy = py - cy
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
}

describe('HTML-рендер текста — единая раскладка из computeTextLayout', () => {
  it('однострочный текст: ЯВНЫЕ строки на вычисленных координатах (top = baselineY - ascender, left = xPx)', async () => {
    const html = await renderLabelToHTML(makeTemplate(), { F1: 'AB CD' })

    // Fallback-метрики: 'AB CD' = 5 символов → ширина 5 * 12 * 0.6 = 36.00px;
    // ascender = 0.8 * 12 = 9.6 → top = baseline(9.6) - ascender(9.6) = 0.00px
    expect(html).toContain('position:absolute;left:0.00px;top:0.00px;width:36.00px')
    // Внутренняя область блока (без паддингов): 40x20мм → 151.2 x 75.6 px
    expect(html).toContain('left:0.00px;top:0.00px;width:151.20px;height:75.60px')
    // Никакого браузерного переноса и flex-выравнивания для текста
    expect(html).not.toContain('word-break')
    expect(html).not.toContain('align-items')
    expect(html).not.toContain('justify-content')
    expect(html).not.toContain('display:flex')
  })

  it('многострочный текст: несколько ЯВНЫХ строк с разными top', async () => {
    const html = await renderLabelToHTML(makeTemplate(), { F1: 'Line1\nLine2' })

    // lineHeightPx = 12 * 1.2 = 14.4; baseline строк 9.6 и 24.0 → top 0.00 и 14.40
    expect(html).toContain('top:0.00px;width:36.00px')
    expect(html).toContain('top:14.40px;width:36.00px')
  })

  it('поворот 90°: content-контейнер свопается и ЦЕНТРИРУЕТСЯ (текст остаётся внутри блока)', async () => {
    const html = await renderLabelToHTML(makeTextRotationTemplate(90), { F1: 'AB CD' })

    expect(html).toContain('transform:rotate(90deg)')
    expect(html).toContain('transform-origin:center center')
    // Блок 40x20мм = 151.2x75.6 px; при 90 контейнер строк = innerH x innerW = 75.6 x 151.2,
    // сдвинут на ((151.2-75.6)/2, (75.6-151.2)/2) = (37.80, -37.80), чтобы внешний rotate
    // вокруг его центра держал текст внутри блока (баг «перенос по исходной ширине»).
    expect(html).toContain('left:37.80px;top:-37.80px;width:75.60px;height:151.20px')
    // Строка остаётся горизонтальной во внутренней системе координат
    expect(html).toContain('width:36.00px')
  })

  it('поворот 270°: content-контейнер свопается и центрируется так же, как 90°', async () => {
    const html = await renderLabelToHTML(makeTextRotationTemplate(270), { F1: 'AB CD' })
    expect(html).toContain('transform:rotate(270deg)')
    expect(html).toContain('transform-origin:center center')
    expect(html).toContain('left:37.80px;top:-37.80px;width:75.60px;height:151.20px')
  })

  it('поворот 90/270: НЕ обрезается — overflow:hidden и rotate на РАЗНЫХ элементах (красный до фикса)', async () => {
    // Длинный многострочный текст при verticalAlign:top — строки заведомо выступают
    // за локальные габариты блока по вертикали (до поворота): content-контейнер
    // 90/270 имеет высоту innerW (> блока) и сдвинут по Y так, что выступает сверху
    // и снизу, чтобы внешний rotate(θ) вернул его на место. Если rotate висит на том
    // же элементе, что и overflow:hidden, обрезка происходит в НЕПОВЁРНУТОЙ локальной
    // системе и срезает верх/низ контейнера строк — «невидимые рамки сверху и снизу».
    const longText = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ ab cd ef gh ij kl mn op qr st uv wx yz'
    for (const rotation of [90, 270] as const) {
      const html = await renderLabelToHTML(makeTextRotationTemplate(rotation), { F1: longText })

      // Каждый элемент с overflow:hidden НЕ должен одновременно нести transform:rotate.
      const clippedEls = html.match(/<div style="([^"]*overflow:hidden[^"]*)">/g) ?? []
      expect(clippedEls.length).toBeGreaterThan(0)
      for (const el of clippedEls) {
        expect(el).not.toContain(`transform:rotate(${rotation}deg)`)
      }

      // Поворот присутствует на отдельном rotator-элементе (полный размер блока).
      expect(html).toContain(`transform:rotate(${rotation}deg)`)
      expect(html).toContain('transform-origin:center center')
    }
  })

  it('поворот 90/270: все строки внутри content-контейнера (x∈[0..w], y∈[0..h]) и внутри блока после поворота', async () => {
    const longText = 'AB CD EF GH IJ KL MN OP QR ST UV WX YZ ab cd ef gh ij kl mn op qr st uv wx yz'
    // Блок 40x20мм = 151.2 x 75.6 px; fontSize 12, lineHeight 1.2 → 14.4px/строка.
    const blockW = 40 * MM_TO_PX
    const blockH = 20 * MM_TO_PX
    const lineHeightPx = 12 * 1.2

    for (const rotation of [90, 270] as const) {
      const html = await renderLabelToHTML(makeTextRotationTemplate(rotation), { F1: longText })

      // content-контейнер — единственный div с left/top/width/height в px.
      const contentMatch = html.match(
        /<div style="([^"]*left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px;height:([\d.]+)px[^"]*)">/
      )
      if (!contentMatch) throw new Error('content-контейнер не найден в HTML')
      const box = {
        x: pxValue(contentMatch[1], 'left'),
        y: pxValue(contentMatch[1], 'top'),
        w: pxValue(contentMatch[1], 'width'),
        h: pxValue(contentMatch[1], 'height')
      }
      // 90/270: своп innerH × innerW; центр контейнера = центр блока.
      expect(box.w).toBeCloseTo(blockH, 1)
      expect(box.h).toBeCloseTo(blockW, 1)
      const cx = box.x + box.w / 2
      const cy = box.y + box.h / 2
      expect(cx).toBeCloseTo(blockW / 2, 1)
      expect(cy).toBeCloseTo(blockH / 2, 1)

      const lineRe =
        /<div style="position:absolute;left:(-?[\d.]+)px;top:(-?[\d.]+)px;width:([\d.]+)px;white-space:pre[^"]*">/g
      let m: RegExpExecArray | null
      let count = 0
      while ((m = lineRe.exec(html)) !== null) {
        const l = parseFloat(m[1])
        const t = parseFloat(m[2])
        const lw = parseFloat(m[3])
        // В системе повёрнутого контейнера: x ∈ [0..w], y ∈ [0..h].
        expect(l).toBeGreaterThanOrEqual(-0.01)
        expect(t).toBeGreaterThanOrEqual(-0.01)
        expect(l + lw).toBeLessThanOrEqual(box.w + 0.01)
        expect(t + lineHeightPx).toBeLessThanOrEqual(box.h + 0.01)
        // После внешнего поворота вокруг центра контейнера — строка внутри блока
        // (габариты достаточны → overflow:hidden внешнего блока ничего не срезает).
        const corners = [
          rotatePoint(box.x + l, box.y + t, cx, cy, rotation),
          rotatePoint(box.x + l + lw, box.y + t, cx, cy, rotation),
          rotatePoint(box.x + l, box.y + t + lineHeightPx, cx, cy, rotation),
          rotatePoint(box.x + l + lw, box.y + t + lineHeightPx, cx, cy, rotation)
        ]
        for (const [rx, ry] of corners) {
          expect(rx).toBeGreaterThanOrEqual(-0.01)
          expect(ry).toBeGreaterThanOrEqual(-0.01)
          expect(rx).toBeLessThanOrEqual(blockW + 0.01)
          expect(ry).toBeLessThanOrEqual(blockH + 0.01)
        }
        count++
      }
      expect(count).toBeGreaterThan(1)
    }
  })

  it('поворот 180°: внешний rotate(180deg)', async () => {
    const html = await renderLabelToHTML(makeTextRotationTemplate(180), { F1: 'AB CD' })
    expect(html).toContain('transform:rotate(180deg)')
    expect(html).toContain('transform-origin:center center')
    // 180° — без свопа: content = внутренняя область блока
    expect(html).toContain('left:0.00px;top:0.00px;width:151.20px;height:75.60px')
  })

  it('эскейпинг: амперсанд и знак меньше (порядок: сначала амперсанд, без двойного экранирования)', async () => {
    const html = await renderLabelToHTML(makeTemplate(), { F1: 'A & B < C' })
    expect(html).toContain('A ' + AMP + ' B ' + LT + ' C')

    // Строка с реальным '<' не должна экранироваться повторно (двойной эскейпинг)
    const html2 = await renderLabelToHTML(makeTemplate(), { F1: 'x < y' })
    expect(html2).toContain('x ' + LT + ' y')
    expect(html2).not.toContain(AMP + LT)
  })
})

describe('HTML-рендер multi-label листа (renderLabelSheetToHTML)', () => {
  it('страница листа сохраняет работоспособность', async () => {
    const layout: PrintLayoutConfig = {
      enabled: true,
      sheetWidth: 100,
      sheetHeight: 60,
      gapX: 2,
      gapY: 2,
      marginTop: 5,
      marginBottom: 5,
      marginLeft: 5,
      marginRight: 5,
      autoArrange: false,
      cols: 2,
      rows: 2
    }
    const sheetItems: BatchItem[] = [{ F1: 'SN-001', serial: 'SN-001' }]
    const html = await renderLabelSheetToHTML(sheetItems, {}, makeTemplate(), layout)

    expect(html).toContain('class="page"')
    expect(html).toContain('SN-001')
    // Лист 100x60мм → 378 x 226.8 px
    expect(html).toContain('width:378.00px;height:226.80px')
  })
})
