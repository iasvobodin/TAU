// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт `import { describe } from 'vitest'`
// приводит к ошибке "Cannot read properties of undefined (reading 'config')".
//
// Моки Neutralino: renderToSVG.ts импортирует @neutralinojs/lib (filesystem) и
// fontManager. В тестах подменяем оба, чтобы генерация SVG работала без реального
// рантайма Neutralino (loadFont уходит в fallback-ветку без шрифта).

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

import {
  renderLabelToSVG,
  renderLabelSheetToSVG,
  renderLabelsToHTML,
  renderLabelSheetsToHTML
} from '@/assets/renderToSVG'
import { resolveValue } from '@/assets/resolveValue'
import type { PrintTemplateData, PrintLayoutConfig, BatchItem } from '@/types/label'

describe('SVG генерация — многострочный текст', () => {
  it('placeholder: проверка что vitest работает', () => {
    expect('hello').toBe('hello')
  })
})

describe('resolveValue (общий модуль resolveValue.ts)', () => {
  it('barcode: берёт dataField, при отсутствии — serial', () => {
    const el = { id: 'b1', type: 'barcode', dataField: 'SN', props: {} } as const
    expect(resolveValue(el as never, { SN: '123' })).toBe('123')
    expect(resolveValue({ ...el, dataField: 'MISSING' } as never, {}, 'ABC')).toBe('ABC')
  })

  it('text: dataField; при linkedBarcodeId — рекурсивно значение barcode', () => {
    const barcode = { id: 'b1', type: 'barcode', dataField: 'SN', props: {} } as const
    const text = {
      id: 't1',
      type: 'text',
      dataField: '',
      props: { linkedBarcodeId: 'b1' }
    } as const
    const elements = { b1: barcode, t1: text } as never
    expect(resolveValue(text as never, { SN: '777' }, '', elements)).toBe('777')
  })

  it('text: ячейка таблицы (tableCellMeta) — ключ по id элемента', () => {
    const cell = {
      id: 'cell_0_0',
      type: 'text',
      dataField: '',
      props: { tableCellMeta: { tableId: 'tbl1', row: 0, col: 0 } }
    } as const
    expect(resolveValue(cell as never, { cell_0_0: 'Value' })).toBe('Value')
  })

  it('прочие типы — пустая строка', () => {
    expect(resolveValue({ id: 'i1', type: 'image', dataField: '', props: {} } as never, {})).toBe(
      ''
    )
  })
})

describe('SVG генерация — границы элементов (чертёжный режим)', () => {
  it('renderElementBorderSVG попадает в parts (баг из плана 3.2.1)', async () => {
    const templateData: PrintTemplateData = {
      positions: {
        t1: { x: 10, y: 20, w: 30, h: 40 }
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
            lineHeight: 1.2
          }
        }
      },
      labelSize: { width: 60, height: 80, unit: 'mm' },
      labelBorder: { enabled: false, width: 1, color: '#000' }
    }

    const svg = await renderLabelToSVG(templateData, { F1: 'Hello' }, '', true)

    // Граница элемента: 10*3.78=37.80, 20*3.78=75.60, 30*3.78=113.40, 40*3.78=151.20
    expect(svg).toContain('x="37.80" y="75.60" width="113.40" height="151.20"')
    // Fallback-текст тоже присутствует (единая раскладка)
    expect(svg).toContain('Hello')
  })

  it('без showBorders границы элементов не добавляются', async () => {
    const templateData: PrintTemplateData = {
      positions: {
        t1: { x: 10, y: 20, w: 30, h: 40 }
      },
      elements: {
        t1: {
          id: 't1',
          type: 'text',
          dataField: 'F1',
          props: { fontSize: 12, fontFamily: 'Arial' }
        }
      },
      labelSize: { width: 60, height: 80, unit: 'mm' }
    }

    const svg = await renderLabelToSVG(templateData, { F1: 'Hello' })
    expect(svg).not.toContain('x="37.80" y="75.60" width="113.40" height="151.20"')
  })
})

// ── Фикстура multi-label листа (аналог htmlRenderer.test.ts) ──────────────────

function makeLayout(): PrintLayoutConfig {
  return {
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
}

function makeSheetTemplate(): PrintTemplateData {
  return {
    positions: { t1: { x: 10, y: 10, w: 40, h: 20 } },
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
    labelBorder: { enabled: false, width: 1, color: '#000' }
  }
}

describe('SVG multi-label лист (renderLabelSheetToSVG)', () => {
  it('раскладывает этикетки по сетке cols×rows на листе', async () => {
    const sheetItems: BatchItem[] = [
      { F1: 'SN-001', serial: 'SN-001' },
      { F1: 'SN-002', serial: 'SN-002' },
      { F1: 'SN-003', serial: 'SN-003' }
    ]
    const svg = await renderLabelSheetToSVG(sheetItems, {}, makeSheetTemplate(), makeLayout())

    // Лист 100x60мм → viewBox 378.00 x 226.80
    expect(svg).toContain('viewBox="0 0 378.00 226.80"')
    // Первая этикетка: marginLeft 5мм, marginTop 5мм → translate(18.90, 18.90)
    expect(svg).toContain('translate(18.90, 18.90)')
    // Вторая этикетка: col=1 → 5 + (60 + 2) = 67мм → translate(253.26, 18.90)
    expect(svg).toContain('translate(253.26, 18.90)')
    // Третья этикетка: row=1 → 5 + (40 + 2) = 47мм → translate(18.90, 177.66)
    expect(svg).toContain('translate(18.90, 177.66)')
    // Значения подставлены (fallback-текст)
    expect(svg).toContain('SN-001')
    expect(svg).toContain('SN-002')
    expect(svg).toContain('SN-003')
  })

  it('не выходит за пределы rows (лишние этикетки обрезаются)', async () => {
    const sheetItems: BatchItem[] = [
      { F1: 'SN-001', serial: 'SN-001' },
      { F1: 'SN-002', serial: 'SN-002' },
      { F1: 'SN-003', serial: 'SN-003' },
      { F1: 'SN-004', serial: 'SN-004' },
      { F1: 'SN-005', serial: 'SN-005' }
    ]
    const svg = await renderLabelSheetToSVG(sheetItems, {}, makeSheetTemplate(), makeLayout())
    // cols*rows = 4 → только первые 4 этикетки, 5-я не должна попасть
    expect(svg).toContain('SN-004')
    expect(svg).not.toContain('SN-005')
  })
})

describe('SVG пакетная печать (renderLabelsToHTML)', () => {
  it('одна страница-этикетка на каждый item (page-break)', async () => {
    const items: BatchItem[] = [
      { F1: 'SN-001', serial: 'SN-001' },
      { F1: 'SN-002', serial: 'SN-002' }
    ]
    const html = await renderLabelsToHTML(items, {}, makeSheetTemplate())

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('class="page"')
    expect(html).toContain('SN-001')
    expect(html).toContain('SN-002')
    // Этикетка 60x40мм → страница .page width/height в мм
    expect(html).toContain('width:60mm;height:40mm')
  })
})

describe('SVG multi-label HTML-страница (renderLabelSheetsToHTML)', () => {
  it('собирает несколько листов в страницы', async () => {
    const sheets: BatchItem[][] = [
      [{ F1: 'SN-001', serial: 'SN-001' }],
      [{ F1: 'SN-002', serial: 'SN-002' }]
    ]
    const html = await renderLabelSheetsToHTML(sheets, {}, makeSheetTemplate(), makeLayout())

    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('SN-001')
    expect(html).toContain('SN-002')
    // Лист 100x60мм → .page в мм
    expect(html).toContain('width:100mm;height:60mm')
  })
})

describe('SVG рендер штрихкодов (code128/datamatrix)', () => {
  function makeBarcodeTemplate(type: 'code128' | 'datamatrix'): PrintTemplateData {
    return {
      positions: { b1: { x: 10, y: 10, w: 40, h: 20 } },
      elements: {
        b1: {
          id: 'b1',
          type: 'barcode',
          dataField: 'serial',
          props: { barcodeType: type, barcodeHeight: 8, barcodeScale: 2 }
        }
      },
      labelSize: { width: 60, height: 40, unit: 'mm' },
      labelBorder: { enabled: false, width: 1, color: '#000' }
    }
  }

  it('code128: генерирует векторный штрихкод через bwip-js (без fallback-прямоугольника)', async () => {
    const svg = await renderLabelToSVG(makeBarcodeTemplate('code128'), {}, 'SN-001')
    // Если bwip-js сработал — присутствует translate-группа штрихкода и path
    expect(svg).toContain('<g transform="translate(')
    // Fallback при ошибке bwip — пунктирный прямоугольник; в норме его быть не должно
    expect(svg).not.toContain('stroke-dasharray="4"')
    expect(svg).toMatch(/<path[\s>]/)
  })

  it('datamatrix: генерирует векторный штрихкод через bwip-js', async () => {
    const svg = await renderLabelToSVG(makeBarcodeTemplate('datamatrix'), {}, 'SN-002')
    expect(svg).toContain('<g transform="translate(')
    expect(svg).not.toContain('stroke-dasharray="4"')
    expect(svg).toMatch(/<path[\s>]/)
  })
})
