<template>
  <div>
    <h2>Редактор таблицы для маркировки</h2>

    <!-- Настройки таблицы -->
    <div class="settings">
      <label>Количество строк:</label>
      <input type="number" v-model.number="rows" min="1" class="number-input" /><br />

      <label>Количество столбцов:</label>
      <input type="number" v-model.number="columns" min="1" class="number-input" /><br />

      <label>Ширина ячейки (мм):</label>
      <input type="number" v-model.number="cellWidthMm" min="10" class="number-input" /><br />

      <label>Высота ячейки (мм):</label>
      <input type="number" v-model.number="cellHeightMm" min="10" class="number-input" /><br />

      <label>Горизонтальный отступ между ячейками (мм):</label>
      <input
        type="number"
        v-model.number="cellPaddingHorizontalMm"
        step="0.1"
        min="0"
        class="number-input"
      /><br />

      <label>Вертикальный отступ между ячейками (мм):</label>
      <input
        type="number"
        v-model.number="cellPaddingVerticalMm"
        step="0.1"
        min="0"
        class="number-input"
      /><br />

      <label>Размер шрифта для всех ячеек (мм):</label>
      <input
        type="number"
        v-model.number="globalFontSizeMm"
        step="0.1"
        @input="updateGlobalFontSize"
        class="number-input"
      /><br />

      <label>Отображать границы таблицы:</label>
      <input type="checkbox" v-model="showBorders" /><br />

      <label>Загрузить шрифт:</label>
      <input type="file" accept=".ttf, .otf, .woff, .woff2" @change="onFontChange" />
      <br />
      <button @click="generateTable">Создать таблицу</button>
    </div>

    <!-- Таблица с возможностью редактирования -->
    <div class="table">
      <table>
        <tr v-for="(row, rowIndex) in tableData" :key="rowIndex">
          <td
            v-for="(cell, colIndex) in row"
            :key="colIndex"
            @click="selectedCell = { row: rowIndex, col: colIndex }"
            :style="cellStyle"
          >
            <textarea
              v-model="tableData[rowIndex][colIndex].text"
              @input="updateCellText(rowIndex, colIndex)"
              @keydown="handleKeyDown($event, rowIndex, colIndex)"
              :style="getInputStyle(cell) as CSSProperties"
              class="cell-textarea"
              spellcheck="false"
            ></textarea>
          </td>
        </tr>
      </table>
    </div>

    <!-- Настройки ячеек -->
    <div v-if="selectedCell" class="cell-settings">
      <h3>Настройки ячейки</h3>
      <label>Размер шрифта (мм):</label>
      <input
        type="number"
        step="0.1"
        v-model.number="tableData[selectedCell.row][selectedCell.col].fontSizeMm"
        @input="updateCellText(selectedCell.row, selectedCell.col)"
        class="number-input"
      />

      <label>Отступ между символами:</label>
      <input
        type="number"
        step="0.1"
        min="-3"
        v-model.number="tableData[selectedCell.row][selectedCell.col].letterSpacing"
        @input="updateCellText(selectedCell.row, selectedCell.col)"
        class="number-input"
      />

      <label>Выравнивание по вертикали:</label>
      <select
        v-model="tableData[selectedCell.row][selectedCell.col].verticalAlignment"
        @change="updateCellText(selectedCell.row, selectedCell.col)"
        class="alignment-select"
      >
        <option value="top">По верхнему краю</option>
        <option value="center">По центру</option>
        <option value="bottom">По нижнему краю</option>
      </select>
    </div>

    <!-- SVG-генерация -->
    <div v-if="svgContent" class="svg-preview">
      <h3>SVG</h3>
      <div v-html="svgContent"></div>
      <button @click="downloadSVG">Скачать SVG</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, type CSSProperties } from 'vue'
import opentype from 'opentype.js'

const MM_TO_PX = 3.779528

const rows = ref<number>(5)
const columns = ref<number>(5)
const cellWidthMm = ref<number>(17)
const cellHeightMm = ref<number>(9)
const cellPaddingHorizontalMm = ref<number>(0.4)
const cellPaddingVerticalMm = ref<number>(0.4)
const showBorders = ref<boolean>(false)
const globalFontSizeMm = ref<number>(5)
const selectedCell = ref<{ row: number; col: number } | null>(null)
const font = ref<opentype.Font | null>(null)

interface CellData {
  text: string
  fontSizeMm: number
  letterSpacing: number
  verticalAlignment: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
}

const tableData = ref<CellData[][]>([])

const svgWidthMm = computed(
  () => columns.value * cellWidthMm.value + (columns.value - 1) * cellPaddingHorizontalMm.value
)
const svgHeightMm = computed(
  () => rows.value * cellHeightMm.value + (rows.value - 1) * cellPaddingVerticalMm.value
)

const handleKeyDown = (event: KeyboardEvent, rowIndex: number, colIndex: number) => {
  if (event.key === 'Enter' && event.altKey) {
    event.preventDefault()
    const textarea = event.target as HTMLTextAreaElement
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const newText = text.slice(0, start) + '\n' + text.slice(end)
    tableData.value[rowIndex][colIndex].text = newText
    nextTick(() => {
      textarea.selectionStart = textarea.selectionEnd = start + 1
    })
  } else if (event.key === 'Enter') {
    event.preventDefault()
    moveToNextCell(rowIndex, colIndex)
  }
}

const onFontChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        font.value = await opentype.parse(reader.result as ArrayBuffer)
        const fontFace = new FontFace('customFont', reader.result as ArrayBuffer)
        // @ts-ignore - FontFaceSet.add существует в браузерах
        document.fonts.add(fontFace)
      } catch (error) {
        console.error('Ошибка при загрузке шрифта', error)
      }
    }
    reader.readAsArrayBuffer(file)
  }
}

const updateGlobalFontSize = () => {
  tableData.value.forEach((row) => {
    row.forEach((cell) => {
      cell.fontSizeMm = globalFontSizeMm.value
      if (selectedCell.value) {
        updateCellText(selectedCell.value.row, selectedCell.value.col)
      }
    })
  })
}

const getInputStyle = (cell: CellData) => ({
  fontSize: `${cell.fontSizeMm * MM_TO_PX}px`,
  fontFamily: font.value ? 'customFont' : 'sans-serif',
  letterSpacing: `${cell.letterSpacing}px`,
  width: `${cellWidthMm.value * MM_TO_PX}px`,
  height: `${cellHeightMm.value * MM_TO_PX}px`,
  resize: 'none',
  overflow: 'hidden',
  border: '1px solid #ccc',
  padding: '4px',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  verticalAlign: 'middle',
  lineHeight: '1.2',
  backgroundColor: 'white'
})

const generateTable = () => {
  tableData.value = Array.from({ length: rows.value }, () =>
    Array.from({ length: columns.value }, () => ({
      text: '',
      fontSizeMm: globalFontSizeMm.value,
      letterSpacing: 1,
      verticalAlignment: 'center' // Default vertical alignment
    }))
  )
}

const updateCellText = (rowIndex: number, colIndex: number) => {
  if (!font.value) return
  const cell = tableData.value[rowIndex][colIndex]
  const fontSizePx = cell.fontSizeMm * MM_TO_PX

  const lines = cell.text.split('\n')
  let maxLineWidth = 0
  let totalHeight = 0

  lines.forEach((line) => {
    let lineWidth = 0
    for (const char of line) {
      const glyph = font.value!.charToGlyph(char)
      const glyphWidth = ((glyph.advanceWidth ?? 0) * fontSizePx) / font.value!.unitsPerEm
      lineWidth += glyphWidth + cell.letterSpacing
    }
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
    totalHeight += fontSizePx * 1.2 // 1.2 - line height
  })

  const cellWidthPx = cellWidthMm.value * MM_TO_PX
  const cellHeightPx = cellHeightMm.value * MM_TO_PX

  const offsetX = (cellWidthPx - maxLineWidth) / 2
  let offsetY

  // Calculate vertical offset based on alignment
  switch (cell.verticalAlignment) {
    case 'top':
      offsetY = fontSizePx // Align to top
      break
    case 'bottom':
      offsetY = cellHeightPx - totalHeight + fontSizePx // Align to bottom
      break
    default: // center
      offsetY = (cellHeightPx - totalHeight) / 2 + fontSizePx // Center vertically
  }

  cell.offsetX = offsetX
  cell.offsetY = offsetY
}

const svgContent = computed(() => {
  if (!font.value) return ''

  let paths = ''

  tableData.value.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.text && cell.offsetX !== undefined && cell.offsetY !== undefined) {
        const x =
          colIndex * (cellWidthMm.value * MM_TO_PX + cellPaddingHorizontalMm.value * MM_TO_PX)
        const y =
          rowIndex * (cellHeightMm.value * MM_TO_PX + cellPaddingVerticalMm.value * MM_TO_PX)
        const fontSizePx = cell.fontSizeMm * MM_TO_PX

        const lines = cell.text.split('\n')
        let currentY = y + cell.offsetY

        lines.forEach((line) => {
          let currentX = x + (cell.offsetX ?? 0)
          let lineWidth = 0

          // Calculate line width
          for (const char of line) {
            const glyph = font.value!.charToGlyph(char)
            const glyphWidth = ((glyph.advanceWidth ?? 0) * fontSizePx) / font.value!.unitsPerEm
            lineWidth += glyphWidth + cell.letterSpacing
          }

          // Center the line horizontally
          currentX = x + (cellWidthMm.value * MM_TO_PX - lineWidth) / 2

          for (const char of line) {
            const glyph = font.value!.charToGlyph(char)
            const path = glyph.getPath(currentX, currentY, fontSizePx)
            paths += `<path d="${path.toPathData(2)}" fill="black" />`
            currentX +=
              (glyph.advanceWidth
                ? (glyph.advanceWidth * fontSizePx) / font.value!.unitsPerEm
                : 0) + cell.letterSpacing
          }

          currentY += fontSizePx * 1.2 // Move to next line
        })
      }
    })
  })

  const width =
    columns.value * (cellWidthMm.value * MM_TO_PX + cellPaddingHorizontalMm.value * MM_TO_PX) -
    cellPaddingHorizontalMm.value * MM_TO_PX
  const height =
    rows.value * (cellHeightMm.value * MM_TO_PX + cellPaddingVerticalMm.value * MM_TO_PX) -
    cellPaddingVerticalMm.value * MM_TO_PX

  return paths
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="none" stroke="black" stroke-width="1" />
        ${paths}
      </svg>`
    : ''
})

const downloadSVG = () => {
  const fileName = `h${svgHeightMm.value.toFixed(1)}w${svgWidthMm.value.toFixed(1)}mm.svg`
  const blob = new Blob([svgContent.value], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

const moveToNextCell = (rowIndex: number, colIndex: number) => {
  if (rowIndex === rows.value - 1 && colIndex === columns.value - 1) {
    addRow()
  } else if (colIndex < columns.value - 1) {
    selectedCell.value = { row: rowIndex, col: colIndex + 1 }
  } else if (rowIndex < rows.value - 1) {
    selectedCell.value = { row: rowIndex + 1, col: 0 }
  }

  nextTick(() => {
    const nextTextarea = document.querySelector<HTMLTextAreaElement>(
      `tr:nth-child(${selectedCell.value!.row + 1}) td:nth-child(${
        selectedCell.value!.col + 1
      }) textarea`
    )
    nextTextarea?.focus()
  })
}

const addRow = () => {
  const newRow: CellData[] = Array.from({ length: columns.value }, () => ({
    text: '',
    fontSizeMm: globalFontSizeMm.value,
    letterSpacing: 1,
    verticalAlignment: 'center' as 'top' | 'center' | 'bottom'
  }))
  tableData.value.push(newRow)
  rows.value++
}

const cellStyle = computed(() => ({
  width: `${cellWidthMm.value}mm`,
  height: `${cellHeightMm.value}mm`,
  padding: `${cellPaddingVerticalMm.value / 2}mm ${cellPaddingHorizontalMm.value / 2}mm`,
  border: showBorders.value ? '1px solid #ccc' : 'none'
}))

onMounted(async () => {
  try {
    font.value = await opentype.load('/assets/GOST.ttf')
  } catch (error) {
    console.error('Ошибка при загрузке шрифта по умолчанию:', error)
  }
})
</script>

<style>
table {
  border-collapse: collapse;
}
td {
  padding: 4px;
  position: relative;
}

table {
  border-collapse: collapse;
  align-self: center;
  justify-self: center;
}

.cell-textarea {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  margin: 0;
  outline: none;
  white-space: pre;
}

.table {
  display: grid;
}

.settings {
  text-align: end;
  margin-bottom: 20px;
}

.number-input {
  width: 60px;
}

.cell-settings {
  margin-top: 20px;
}

.svg-preview {
  margin-top: 20px;
}

.alignment-select {
  margin: 5px;
  padding: 4px;
  border-radius: 4px;
  border: 1px solid #ccc;
}
</style>
