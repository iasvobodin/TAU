export const MM_TO_PX = 3.779528

export type VerticalAlignment = 'top' | 'center' | 'bottom'
export type HorizontalAlignment = 'left' | 'center' | 'right'

export interface CellData {
  text: string
  fontSizeMm: number
  letterSpacing: number
  lineHeightMultiplier: number
  verticalAlignment: VerticalAlignment
  horizontalAlignment: HorizontalAlignment
  // Вычисляемые — только для SVG-рендеринга
  paddingTop?: number // px: от top ячейки до baseline первой строки
  lineHeightPx?: number // px: шаг между baseline строк
  lineWidths?: number[] // px: ширина каждой строки
}

export interface TableSettings {
  rows: number
  columns: number
  cellWidthMm: number
  cellHeightMm: number
  cellPaddingHorizontalMm: number
  cellPaddingVerticalMm: number
  globalFontSizeMm: number
  showBorders: boolean
}

export interface SelectedCell {
  row: number
  col: number
}
