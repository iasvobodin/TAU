export type ElementType = 'text' | 'barcode' | 'image'
export type BarcodeType = 'code128' | 'datamatrix'
export type DataField = string
export type Unit = 'mm' | 'px'

// ─── Абстрактная позиция элемента в мм ───────────────────────────────────────
// Единственный формат позиции во всём приложении.
// Канвас-компонент конвертирует мм↔px сам, store и принтер про px не знают.
export interface ElementPosition {
  x: number // мм от левого края этикетки
  y: number // мм от верхнего края
  w: number // ширина в мм
  h: number // высота в мм
}

export interface LabelElementProps {
  // Text
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fontFamily?: string
  lineHeight?: number // множитель межстрочного интервала, напр. 1.2
  paddingX?: number // горизонтальный отступ в px
  paddingY?: number // вертикальный отступ в px

  // Barcode
  barcodeType?: BarcodeType
  barcodeHeight?: number
  barcodeWidth?: number
  barcodeScale?: number
  testValue?: string

  // Image
  src?: string
  imageWidth?: number
  imageHeight?: string

  // Editor-only visual state (не сохраняется в шаблон)
  customText?: string | null
}

export interface LabelElement {
  id: string
  type: ElementType
  dataField: DataField
  props: LabelElementProps
}

export interface LabelSize {
  width: number
  height: number
  unit: Unit
}

export interface FieldCounters {
  serial: number
  partNumber: number
  description: number
  manufacturer: number
  custom: number
}

// ─── Формат шаблона (сохраняется в JSON) ─────────────────────────────────────
type SavedElementProps = Omit<LabelElementProps, 'customText' | 'testValue'>

export interface TemplateData {
  positions: Record<string, ElementPosition>
  elements: Record<string, Omit<LabelElement, 'props'> & { props: SavedElementProps }>
  labelSize: LabelSize
}

// ─── Формат для принтера ──────────────────────────────────────────────────────
export interface PrintLabelElement {
  id: string
  type: ElementType
  dataField: DataField
  props: SavedElementProps
}

export interface PrintTemplateData {
  positions: Record<string, ElementPosition>
  elements: Record<string, PrintLabelElement>
  labelSize: LabelSize
}

export interface CommonData {
  [key: string]: string
}

export interface BatchItem {
  serial: string
}
