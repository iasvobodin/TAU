<template>
  <v-app>
    <v-navigation-drawer width="380" permanent location="left" elevation="2">
      <div class="pa-4">
        <div class="text-h6 mb-4">Настройки таблицы</div>

        <v-row dense>
          <v-col cols="6">
            <v-text-field
              v-model.number="rows"
              label="Строк"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="columns"
              label="Столбцов"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="cellWidthMm"
              label="Ширина ячейки (мм)"
              type="number"
              step="0.1"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="cellHeightMm"
              label="Высота ячейки (мм)"
              type="number"
              step="0.1"
              density="compact"
              variant="outlined"
              hide-details
              class="mb-2"
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="cellPaddingHorizontalMm"
              label="Отступ H (мм)"
              type="number"
              step="0.1"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="6">
            <v-text-field
              v-model.number="cellPaddingVerticalMm"
              label="Отступ V (мм)"
              type="number"
              step="0.1"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
        </v-row>

        <v-divider class="my-4"></v-divider>

        <v-text-field
          v-model.number="globalFontSizeMm"
          label="Общий шрифт (мм)"
          type="number"
          step="0.1"
          density="compact"
          variant="outlined"
          @update:model-value="updateGlobalFontSize"
        />

        <v-checkbox
          v-model="showBorders"
          label="Показать границы"
          density="compact"
          hide-details
          color="primary"
        />

        <v-btn
          block
          color="secondary"
          variant="tonal"
          prepend-icon="mdi-file-find"
          @click="chooseFont"
          class="mt-2 mb-4 text-none"
        >
          {{ fontName || 'Выбрать .TTF шрифт' }}
        </v-btn>

        <v-btn block color="primary" elevation="2" @click="generateTable" class="mb-2"
          >Создать / Сбросить таблицу</v-btn
        >

        <div class="d-flex gap-2">
          <v-btn
            flex-grow-1
            color="surface-variant"
            variant="flat"
            size="small"
            @click="saveTemplate"
            >Сохранить шаблон</v-btn
          >
          <v-btn
            flex-grow-1
            color="surface-variant"
            variant="flat"
            size="small"
            @click="loadTemplate"
            class="ml-2"
            >Загрузить</v-btn
          >
        </div>

        <v-expand-transition>
          <v-card v-if="selectedCell" variant="flat" border class="mt-6 pa-3 bg-grey-lighten-4">
            <div class="text-caption font-weight-bold mb-2 text-uppercase">
              Ячейка [{{ selectedCell.row + 1 }}:{{ selectedCell.col + 1 }}]
            </div>
            <v-text-field
              v-model.number="tableData[selectedCell.row][selectedCell.col].fontSizeMm"
              label="Шрифт ячейки (мм)"
              type="number"
              step="0.1"
              variant="underlined"
              density="compact"
              @update:model-value="updateCellText(selectedCell.row, selectedCell.col)"
            />
            <v-slider
              v-model="tableData[selectedCell.row][selectedCell.col].letterSpacing"
              label="Кернинг"
              min="-2"
              max="10"
              step="0.1"
              thumb-label
              density="compact"
              hide-details
              @update:model-value="updateCellText(selectedCell.row, selectedCell.col)"
            />

            <v-select
              v-model="tableData[selectedCell.row][selectedCell.col].verticalAlignment"
              label="Выравнивание V"
              :items="[
                { title: 'Верх', value: 'top' },
                { title: 'Центр', value: 'center' },
                { title: 'Низ', value: 'bottom' }
              ]"
              variant="underlined"
              density="compact"
              @update:model-value="updateCellText(selectedCell.row, selectedCell.col)"
            />
          </v-card>
        </v-expand-transition>
      </div>
    </v-navigation-drawer>

    <v-main class="bg-grey-lighten-2">
      <v-container fluid class="fill-height d-flex flex-column align-center justify-start pt-10">
        <div class="table-scroll-container elevation-10">
          <table class="marking-table" :style="{ backgroundColor: 'white' }">
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
                  :style="getInputStyle(cell)"
                  class="cell-textarea"
                  spellcheck="false"
                ></textarea>
              </td>
            </tr>
          </table>
        </div>

        <div v-if="svgContent" class="mt-8 text-center pb-10">
          <div class="text-subtitle-1 mb-2 font-weight-bold">SVG PREVIEW</div>
          <div class="svg-preview-box mb-4" v-html="svgContent"></div>
          <v-btn color="success" size="large" prepend-icon="mdi-download" @click="downloadSVG">
            Скачать SVG ({{ svgWidthMm.toFixed(1) }}x{{ svgHeightMm.toFixed(1) }} мм)
          </v-btn>
        </div>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import opentype from 'opentype.js'

// Типизация Neutralino
declare const Neutralino: any

const MM_TO_PX = 3.779528

const rows = ref<number>(5)
const columns = ref<number>(5)
const cellWidthMm = ref<number>(17)
const cellHeightMm = ref<number>(9)
const cellPaddingHorizontalMm = ref<number>(0.4)
const cellPaddingVerticalMm = ref<number>(0.4)
const showBorders = ref<boolean>(true)
const globalFontSizeMm = ref<number>(5)
const selectedCell = ref<{ row: number; col: number } | null>(null)
const font = ref<opentype.Font | null>(null)
const fontName = ref('')

interface CellData {
  text: string
  fontSizeMm: number
  letterSpacing: number
  verticalAlignment: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
}

const tableData = ref<CellData[][]>([])

// Вычисляемые размеры итогового SVG
const svgWidthMm = computed(
  () => columns.value * cellWidthMm.value + (columns.value - 1) * cellPaddingHorizontalMm.value
)
const svgHeightMm = computed(
  () => rows.value * cellHeightMm.value + (rows.value - 1) * cellPaddingVerticalMm.value
)

// Стили ячейки (как в оригинале, для точности)
const cellStyle = computed(() => ({
  width: `${cellWidthMm.value}mm`,
  height: `${cellHeightMm.value}mm`,
  padding: `${cellPaddingVerticalMm.value / 2}mm ${cellPaddingHorizontalMm.value / 2}mm`,
  border: showBorders.value ? '0.2mm solid #000' : '0.2mm solid transparent',
  position: 'relative' as const,
  boxSizing: 'border-box' as const
}))

// --- ЛОГИКА NEUTRALINO ---

const chooseFont = async () => {
  try {
    let entries = await Neutralino.os.showOpenDialog('Выберите .ttf шрифт', {
      filters: [{ name: 'Fonts', extensions: ['ttf'] }]
    })
    if (entries.length > 0) {
      const data = await Neutralino.filesystem.readBinaryFile(entries[0])
      font.value = opentype.parse(data)
      fontName.value = entries[0].split(/[\\/]/).pop()
      const fontFace = new FontFace('customFont', data)
      await fontFace.load()
      document.fonts.add(fontFace)
      // Принудительно пересчитываем все ячейки с новым шрифтом
      tableData.value.forEach((r, ri) => r.forEach((c, ci) => updateCellText(ri, ci)))
    }
  } catch (e) {
    console.error(e)
  }
}

const saveTemplate = async () => {
  const data = {
    rows: rows.value,
    columns: columns.value,
    cellWidthMm: cellWidthMm.value,
    cellHeightMm: cellHeightMm.value,
    cellPaddingHorizontalMm: cellPaddingHorizontalMm.value,
    cellPaddingVerticalMm: cellPaddingVerticalMm.value,
    globalFontSizeMm: globalFontSizeMm.value,
    tableData: tableData.value
  }
  await Neutralino.filesystem.writeFile('./marking_template.json', JSON.stringify(data, null, 2))
}

const loadTemplate = async () => {
  try {
    const content = await Neutralino.filesystem.readFile('./marking_template.json')
    const config = JSON.parse(content)
    Object.assign(this, config) // Синхронизируем реактивные переменные
    tableData.value = config.tableData
  } catch (e) {
    alert('Шаблон не найден')
  }
}

const downloadSVG = async () => {
  const name = `label_${svgWidthMm.value.toFixed(1)}x${svgHeightMm.value.toFixed(1)}mm.svg`
  await Neutralino.filesystem.writeFile(`./${name}`, svgContent.value)
  alert(`Файл ${name} сохранен рядом с .exe`)
}

// --- ОРИГИНАЛЬНАЯ ЛОГИКА РАСЧЕТОВ ---

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
      lineWidth += glyphWidth + cell.letterSpacing * (fontSizePx / 20) // коэффициент кернинга
    }
    maxLineWidth = Math.max(maxLineWidth, lineWidth)
    totalHeight += fontSizePx * 1.2
  })

  const cellWidthPx = cellWidthMm.value * MM_TO_PX
  const cellHeightPx = cellHeightMm.value * MM_TO_PX

  cell.offsetX = (cellWidthPx - maxLineWidth) / 2
  switch (cell.verticalAlignment) {
    case 'top':
      cell.offsetY = fontSizePx
      break
    case 'bottom':
      cell.offsetY = cellHeightPx - totalHeight + fontSizePx
      break
    default:
      cell.offsetY = (cellHeightPx - totalHeight) / 2 + fontSizePx
  }
}

const svgContent = computed(() => {
  if (!font.value) return ''
  let paths = ''

  tableData.value.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell.text && cell.offsetX !== undefined && cell.offsetY !== undefined) {
        const xBase =
          colIndex * (cellWidthMm.value * MM_TO_PX + cellPaddingHorizontalMm.value * MM_TO_PX)
        const yBase =
          rowIndex * (cellHeightMm.value * MM_TO_PX + cellPaddingVerticalMm.value * MM_TO_PX)
        const fontSizePx = cell.fontSizeMm * MM_TO_PX
        const lines = cell.text.split('\n')
        let currentY = yBase + cell.offsetY

        lines.forEach((line) => {
          let lineW = 0
          for (const char of line) {
            const glyph = font.value!.charToGlyph(char)
            lineW +=
              ((glyph.advanceWidth ?? 0) * fontSizePx) / font.value!.unitsPerEm +
              cell.letterSpacing * (fontSizePx / 20)
          }

          let currentX = xBase + (cellWidthMm.value * MM_TO_PX - lineW) / 2

          for (const char of line) {
            const glyph = font.value!.charToGlyph(char)
            const path = glyph.getPath(currentX, currentY, fontSizePx)
            paths += `<path d="${path.toPathData(2)}" fill="black" />`
            currentX +=
              ((glyph.advanceWidth ?? 0) * fontSizePx) / font.value!.unitsPerEm +
              cell.letterSpacing * (fontSizePx / 20)
          }
          currentY += fontSizePx * 1.2
        })
      }
    })
  })

  const w = svgWidthMm.value * MM_TO_PX
  const h = svgHeightMm.value * MM_TO_PX
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
            <rect width="${w}" height="${h}" fill="none" stroke="${showBorders.value ? 'black' : 'none'}" stroke-width="0.5" />
            ${paths}
          </svg>`
})

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

const updateGlobalFontSize = () => {
  tableData.value.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      cell.fontSizeMm = globalFontSizeMm.value
      updateCellText(ri, ci)
    })
  )
}

const generateTable = () => {
  tableData.value = Array.from({ length: rows.value }, () =>
    Array.from({ length: columns.value }, () => ({
      text: '',
      fontSizeMm: globalFontSizeMm.value,
      letterSpacing: 0,
      verticalAlignment: 'center'
    }))
  )
}

const getInputStyle = (cell: CellData) => ({
  fontSize: `${cell.fontSizeMm * MM_TO_PX}px`,
  fontFamily: font.value ? 'customFont' : 'sans-serif',
  letterSpacing: `${cell.letterSpacing}px`,
  width: '100%',
  height: '100%',
  resize: 'none' as const,
  overflow: 'hidden',
  background: 'transparent',
  border: 'none',
  outline: 'none',
  textAlign: 'center' as const,
  display: 'flex',
  alignItems: 'center'
})

const handleKeyDown = (event: KeyboardEvent, rowIndex: number, colIndex: number) => {
  if (event.key === 'Enter' && !event.altKey) {
    event.preventDefault()
    moveToNextCell(rowIndex, colIndex)
  }
}

const moveToNextCell = (rowIndex: number, colIndex: number) => {
  let nextR = rowIndex,
    nextC = colIndex + 1
  if (nextC >= columns.value) {
    nextR++
    nextC = 0
  }
  if (nextR < rows.value) {
    selectedCell.value = { row: nextR, col: nextC }
    nextTick(() => {
      const el = document.querySelectorAll('.cell-textarea')[
        nextR * columns.value + nextC
      ] as HTMLElement
      el?.focus()
    })
  }
}

onMounted(() => {
  generateTable()
  if (typeof Neutralino !== 'undefined') Neutralino.init()
})
</script>

<style scoped>
.marking-table {
  border-collapse: collapse;
  table-layout: fixed;
}
.marking-table td {
  padding: 0;
  vertical-align: middle;
}
.cell-textarea {
  display: block;
  padding: 0;
  margin: 0;
  line-height: 1.2;
}
.table-scroll-container {
  max-width: 90vw;
  max-height: 70vh;
  overflow: auto;
  border: 1px solid #999;
}
.svg-preview-box {
  background: white;
  padding: 10px;
  display: inline-block;
  border: 1px dashed #666;
}
</style>
