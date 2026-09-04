// generateDimensionDrawing.test.ts — чертёжный режим (границы элементов).
//
// Модуль чистый: импортирует только types/label и textLayout (без Neutralino),
// поэтому моки не требуются. Проверяем:
//   - контур этикетки (mm и px-конверсия через единый MM_TO_PX);
//   - рамки нетable-элементов;
//   - пропуск table-контейнеров и ячеек таблицы (tableCellMeta).

import { generateDimensionDrawing } from '@/assets/generateDimensionDrawing'
import type { TemplateData } from '@/types/label'

function makeTemplate(overrides: Partial<TemplateData> = {}): TemplateData {
  return {
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
    labelSize: { width: 60, height: 40, unit: 'mm' },
    ...overrides
  }
}

describe('generateDimensionDrawing — чертёжный режим', () => {
  it('mm-этикетка: контур и рамка элемента с масштабом SCALE=10', () => {
    const svg = generateDimensionDrawing(makeTemplate())

    // Этикетка 60x40мм → viewBox 600 x 400
    expect(svg).toContain('viewBox="0 0 600.0 400.0"')
    // Контур этикетки
    expect(svg).toContain('width="600.0" height="400.0" fill="none" stroke="#999"')
    // Рамка элемента: 10,20,30,40 мм → 100,200,300,400
    expect(svg).toContain('x="100.0" y="200.0" width="300.0" height="400.0"')
  })

  it('px-этикетка: конвертация px→mm через единый MM_TO_PX', () => {
    const svg = generateDimensionDrawing(
      makeTemplate({ labelSize: { width: 60, height: 40, unit: 'px' } })
    )
    // 60px → 60/3.78 мм = 15.873 → *10 = 158.7; 40px → 105.8
    expect(svg).toContain('viewBox="0 0 158.7 105.8"')
  })

  it('table-контейнеры и ячейки таблицы (tableCellMeta) пропускаются', () => {
    const t = makeTemplate({
      positions: {
        t1: { x: 10, y: 20, w: 30, h: 40 },
        tbl: { x: 0, y: 0, w: 50, h: 50 },
        cell: { x: 1, y: 1, w: 10, h: 10 }
      },
      elements: {
        t1: {
          id: 't1',
          type: 'text',
          dataField: 'F1',
          props: { fontSize: 12, fontFamily: 'Arial' }
        },
        tbl: { id: 'tbl', type: 'table', dataField: '', props: {} },
        cell: {
          id: 'cell',
          type: 'text',
          dataField: '',
          props: { tableCellMeta: { tableId: 'tbl', row: 0, col: 0 } }
        }
      }
    })

    const svg = generateDimensionDrawing(t)
    // Рамка текстового элемента есть
    expect(svg).toContain('x="100.0" y="200.0" width="300.0" height="400.0"')
    // Table-контейнер (0,0,500,500) не должен рисоваться
    expect(svg).not.toContain('x="0.0" y="0.0" width="500.0" height="500.0"')
    // Ячейка таблицы (1,1,10,10 → 10,10,100,100) не должна рисоваться
    expect(svg).not.toContain('x="10.0" y="10.0" width="100.0" height="100.0"')
  })
})
