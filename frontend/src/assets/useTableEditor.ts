import { ref, computed } from 'vue'

export interface CellData {
  text: string
  fontSizeMm: number
  letterSpacing: number
  verticalAlignment: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
}

export function useTableEditor() {
  const rows = ref(5)
  const columns = ref(5)
  const cellWidthMm = ref(17)
  const cellHeightMm = ref(9)
  const globalFontSizeMm = ref(5)
  const tableData = ref<CellData[][]>([])

  const generateTable = () => {
    tableData.value = Array.from({ length: rows.value }, () =>
      Array.from({ length: columns.value }, () => ({
        text: '',
        fontSizeMm: globalFontSizeMm.value,
        letterSpacing: 1,
        verticalAlignment: 'center' as const
      }))
    )
  }

  const moveToNextCell = (rowIndex: number, colIndex: number) => {
    if (rowIndex === rows.value - 1 && colIndex === columns.value - 1) {
      return 'last'
    } else if (colIndex < columns.value - 1) {
      return { row: rowIndex, col: colIndex + 1 }
    } else {
      return { row: rowIndex + 1, col: 0 }
    }
  }

  const addRow = () => {
    const newRow: CellData[] = Array.from({ length: columns.value }, () => ({
      text: '',
      fontSizeMm: globalFontSizeMm.value,
      letterSpacing: 1,
      verticalAlignment: 'center' as const
    }))
    tableData.value.push(newRow)
    rows.value++
  }

  return {
    rows,
    columns,
    cellWidthMm,
    cellHeightMm,
    globalFontSizeMm,
    tableData,
    generateTable,
    moveToNextCell,
    addRow
  }
}
