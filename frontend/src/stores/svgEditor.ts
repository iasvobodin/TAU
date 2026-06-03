import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import opentype from 'opentype.js'
import { MM_TO_PX } from '../types/svg'
import type { CellData, TableSettings, SelectedCell } from '../types/svg'
import { filesystem, os, server, events, resources } from '@neutralinojs/lib'

export const useSvgEditorStore = defineStore('svgEditor', () => {
  // ─── Font ─────────────────────────────────────────────────────────────────
  const font = ref<opentype.Font | null>(null)
  const fontName = ref<string>('GOST (по умолчанию)')
  const fontLoaded = computed(() => font.value !== null)

  async function loadFontFromBuffer(buffer: ArrayBuffer, name: string) {
    font.value = await opentype.parse(buffer)
    const face = new FontFace('customFont', buffer)
    await face.load()
    // @ts-ignore
    document.fonts.add(face)
    fontName.value = name
    recalcAll()
    scheduleSvgUpdate()
  }

  // Загрузка шрифта по умолчанию через Neutralino + регистрация FontFace
  // чтобы шрифт применился и в HTML-редакторе
  async function loadDefaultFont() {
    try {
      // @ts-ignore
      const data: ArrayBuffer = await Neutralino.filesystem.readBinaryFile(
        'resources/assets/GOST.ttf'
      )
      await loadFontFromBuffer(data, 'GOST (по умолчанию)')
      fontName.value = 'GOST (по умолчанию)'
    } catch (e) {
      console.error('Не удалось загрузить шрифт по умолчанию:', e)
    }
  }

  // ─── Шрифтовые метрики ────────────────────────────────────────────────────
  // Кешируем метрики чтобы не пересчитывать при каждом символе
  const metricsCache = new Map<number, { ascender: number; descender: number }>()

  function getFontMetricsPx(fontSizePx: number) {
    const cached = metricsCache.get(fontSizePx)
    if (cached) return cached
    const f = font.value!
    const scale = fontSizePx / f.unitsPerEm
    const ascender = f.ascender * scale
    const descender = Math.abs(f.descender) * scale
    const result = { ascender, descender }
    metricsCache.set(fontSizePx, result)
    return result
  }

  // Сбрасываем кеш при смене шрифта
  watch(font, () => metricsCache.clear())

  // ─── Table settings ───────────────────────────────────────────────────────
  const settings = ref<TableSettings>({
    rows: 5,
    columns: 5,
    cellWidthMm: 17,
    cellHeightMm: 9,
    cellPaddingHorizontalMm: 0.4,
    cellPaddingVerticalMm: 0.4,
    globalFontSizeMm: 5,
    showBorders: false
  })

  // ─── Table data ───────────────────────────────────────────────────────────
  const tableData = ref<CellData[][]>([])
  const selectedCell = ref<SelectedCell | null>(null)

  const selectedCellData = computed<CellData | null>(() => {
    if (!selectedCell.value) return null
    return tableData.value[selectedCell.value.row]?.[selectedCell.value.col] ?? null
  })

  function makeCellData(): CellData {
    return {
      text: '',
      fontSizeMm: settings.value.globalFontSizeMm,
      letterSpacing: 0,
      lineHeightMultiplier: 1.2,
      verticalAlignment: 'center',
      horizontalAlignment: 'center'
    }
  }

  function generateTable() {
    tableData.value = Array.from({ length: settings.value.rows }, () =>
      Array.from({ length: settings.value.columns }, makeCellData)
    )
    selectedCell.value = null
  }

  function addRow() {
    tableData.value.push(Array.from({ length: settings.value.columns }, makeCellData))
    settings.value.rows = tableData.value.length
  }

  function applyGlobalFontSize() {
    tableData.value.forEach((row) =>
      row.forEach((cell) => {
        cell.fontSizeMm = settings.value.globalFontSizeMm
      })
    )
    recalcAll()
  }

  // ─── Метрики ячейки для SVG ───────────────────────────────────────────────
  // Считаем только то что нужно SVG: lineWidths для горизонтального
  // позиционирования и paddingTop (baseline первой строки от top ячейки).
  // HTML-редактор теперь использует flex — ему эти числа не нужны.
  function calcCellMetrics(cell: CellData) {
    if (!font.value) return

    const fsPx = cell.fontSizeMm * MM_TO_PX
    const { ascender, descender } = getFontMetricsPx(fsPx)
    const lineHeightPx = fsPx * cell.lineHeightMultiplier
    const lines = cell.text.split('\n')
    const n = lines.length

    // Ширина каждой строки — нужна для выравнивания в SVG
    const lineWidths = lines.map((line) => {
      let w = 0
      for (const char of line) {
        const g = font.value!.charToGlyph(char)
        w += ((g.advanceWidth ?? 0) * fsPx) / font.value!.unitsPerEm
      }
      if (line.length > 1) w += cell.letterSpacing * (line.length - 1)
      return w
    })

    // Вертикальное позиционирование в SVG через baseline первой строки
    const realTextHeight = lineHeightPx * (n - 1) + ascender + descender
    const cellH = settings.value.cellHeightMm * MM_TO_PX

    let paddingTop: number
    switch (cell.verticalAlignment) {
      case 'top':
        paddingTop = ascender
        break
      case 'bottom':
        paddingTop = cellH - realTextHeight + ascender
        break
      default:
        paddingTop = (cellH - realTextHeight) / 2 + ascender
    }

    cell.paddingTop = paddingTop
    cell.lineHeightPx = lineHeightPx
    cell.lineWidths = lineWidths
  }

  function recalcCell(row: number, col: number) {
    const cell = tableData.value[row]?.[col]
    if (cell) calcCellMetrics(cell)
    scheduleSvgUpdate()
  }

  function recalcAll() {
    tableData.value.forEach((row) => row.forEach(calcCellMetrics))
    scheduleSvgUpdate()
  }

  // ─── SVG generation с debounce ────────────────────────────────────────────
  // svgContent — ref, пересчитывается не чаще раза в 400мс
  const svgContent = ref<string>('')
  let svgTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSvgUpdate() {
    if (svgTimer) clearTimeout(svgTimer)
    svgTimer = setTimeout(buildSvg, 400)
  }

  const cellStepXPx = computed(
    () => (settings.value.cellWidthMm + settings.value.cellPaddingHorizontalMm) * MM_TO_PX
  )
  const cellStepYPx = computed(
    () => (settings.value.cellHeightMm + settings.value.cellPaddingVerticalMm) * MM_TO_PX
  )
  const svgWidthMm = computed(
    () =>
      settings.value.columns * settings.value.cellWidthMm +
      (settings.value.columns - 1) * settings.value.cellPaddingHorizontalMm
  )
  const svgHeightMm = computed(
    () =>
      settings.value.rows * settings.value.cellHeightMm +
      (settings.value.rows - 1) * settings.value.cellPaddingVerticalMm
  )

  function buildSvg() {
    if (!font.value || !tableData.value.length) {
      svgContent.value = ''
      return
    }

    const cellWpx = settings.value.cellWidthMm * MM_TO_PX
    const cellHpx = settings.value.cellHeightMm * MM_TO_PX
    const W = (
      settings.value.columns * cellStepXPx.value -
      settings.value.cellPaddingHorizontalMm * MM_TO_PX
    ).toFixed(2)
    const H = (
      settings.value.rows * cellStepYPx.value -
      settings.value.cellPaddingVerticalMm * MM_TO_PX
    ).toFixed(2)

    let result = `<rect width="${W}" height="${H}" fill="none" stroke="black" stroke-width="1"/>`

    if (settings.value.showBorders) {
      const cw = cellWpx.toFixed(2)
      const ch = cellHpx.toFixed(2)
      for (let ri = 0; ri < settings.value.rows; ri++) {
        for (let ci = 0; ci < settings.value.columns; ci++) {
          const x = (ci * cellStepXPx.value).toFixed(2)
          const y = (ri * cellStepYPx.value).toFixed(2)
          result += `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="black" stroke-width="0.5"/>`
        }
      }
    }

    tableData.value.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (!cell.text || cell.paddingTop === undefined || !cell.lineWidths || !cell.lineHeightPx)
          return

        const originX = ci * cellStepXPx.value
        const originY = ri * cellStepYPx.value
        const fsPx = cell.fontSizeMm * MM_TO_PX
        const lines = cell.text.split('\n')

        lines.forEach((line, li) => {
          if (!line) return
          const lineW = cell.lineWidths![li]

          let startX: number
          switch (cell.horizontalAlignment) {
            case 'left':
              startX = originX
              break
            case 'right':
              startX = originX + cellWpx - lineW
              break
            default:
              startX = originX + (cellWpx - lineW) / 2
          }

          const baselineY = originY + cell.paddingTop! + li * cell.lineHeightPx!

          let curX = startX
          for (const char of line) {
            const g = font.value!.charToGlyph(char)
            result += `<path d="${g.getPath(curX, baselineY, fsPx).toPathData(2)}" fill="black"/>`
            curX += ((g.advanceWidth ?? 0) * fsPx) / font.value!.unitsPerEm + cell.letterSpacing
          }
        })
      })
    })

    svgContent.value =
      `<svg xmlns="http://www.w3.org/2000/svg"` +
      ` width="${svgWidthMm.value.toFixed(2)}mm"` +
      ` height="${svgHeightMm.value.toFixed(2)}mm"` +
      ` viewBox="0 0 ${W} ${H}">` +
      result +
      `</svg>`
  }

  // Настройки таблицы (без текста) → пересчёт с debounce
  watch(
    settings,
    () => {
      recalcAll()
    },
    { deep: true }
  )

  async function downloadSVG() {
    // Принудительный рендер перед скачиванием (debounce мог не сработать)
    buildSvg()
    if (!svgContent.value) return
    const fileName = `label_${svgHeightMm.value.toFixed(1)}x${svgWidthMm.value.toFixed(1)}mm.svg`
    try {
      // @ts-ignore
      const path: string = await Neutralino.os.showSaveDialog('Сохранить SVG', {
        defaultPath: fileName,
        filters: [{ name: 'SVG файлы', extensions: ['svg'] }]
      })
      // @ts-ignore
      if (path) await Neutralino.filesystem.writeFile(path, svgContent.value)
    } catch {
      const blob = new Blob([svgContent.value], { type: 'image/svg+xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return {
    font,
    fontName,
    fontLoaded,
    loadFontFromBuffer,
    loadDefaultFont,
    settings,
    tableData,
    selectedCell,
    selectedCellData,
    generateTable,
    addRow,
    applyGlobalFontSize,
    recalcCell,
    recalcAll,
    svgContent,
    svgWidthMm,
    svgHeightMm,
    downloadSVG
  }
})
