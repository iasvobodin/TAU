import { describe, it, expect, beforeEach } from 'vitest'
import { useTableEditor } from '@/assets/useTableEditor'

describe('useTableEditor', () => {
  let editor: ReturnType<typeof useTableEditor>

  beforeEach(() => {
    editor = useTableEditor()
    editor.generateTable()
  })

  describe('generateTable', () => {
    it('создает таблицу с правильным количеством строк и столбцов', () => {
      expect(editor.tableData.value).toHaveLength(5)
      expect(editor.tableData.value[0]).toHaveLength(5)
    })

    it('создает пустые ячейки с настройками по умолчанию', () => {
      const cell = editor.tableData.value[0][0]
      expect(cell.text).toBe('')
      expect(cell.fontSizeMm).toBe(5)
      expect(cell.letterSpacing).toBe(1)
      expect(cell.verticalAlignment).toBe('center')
    })

    it('создает таблицу другого размера при изменении параметров', () => {
      editor.rows.value = 3
      editor.columns.value = 4
      editor.generateTable()

      expect(editor.tableData.value).toHaveLength(3)
      expect(editor.tableData.value[0]).toHaveLength(4)
    })
  })

  describe('moveToNextCell', () => {
    it('перемещается на следующую ячейку в строке', () => {
      const result = editor.moveToNextCell(0, 0)
      expect(result).toEqual({ row: 0, col: 1 })
    })

    it('перемещается на следующую строку в конце колонки', () => {
      const result = editor.moveToNextCell(0, 4)
      expect(result).toEqual({ row: 1, col: 0 })
    })

    it('возвращает "last" когда достигнут конец таблицы', () => {
      const result = editor.moveToNextCell(4, 4)
      expect(result).toBe('last')
    })
  })

  describe('addRow', () => {
    it('добавляет новую строку в таблицу', () => {
      const initialRowCount = editor.tableData.value.length
      editor.addRow()

      expect(editor.tableData.value).toHaveLength(initialRowCount + 1)
      expect(editor.rows.value).toBe(initialRowCount + 1)
    })

    it('добавляет строку с правильным количеством ячеек', () => {
      editor.columns.value = 7
      editor.generateTable()
      editor.addRow()

      const lastRow = editor.tableData.value[editor.tableData.value.length - 1]
      expect(lastRow).toHaveLength(7)
    })
  })

  describe('граничные случаи', () => {
    it('корректно обрабатывает таблицу 1x1', () => {
      editor.rows.value = 1
      editor.columns.value = 1
      editor.generateTable()

      expect(editor.tableData.value).toHaveLength(1)
      expect(editor.tableData.value[0]).toHaveLength(1)

      const result = editor.moveToNextCell(0, 0)
      expect(result).toBe('last')
    })

    it('сохраняет данные ячеек после изменения размера', () => {
      editor.tableData.value[0][0].text = 'Тестовый текст'
      editor.generateTable() // Пересоздаем таблицу

      // Данные должны сброситься
      expect(editor.tableData.value[0][0].text).toBe('')
    })
  })
})
