export type ElementType = 'text' | 'barcode' | 'image'
export type BarcodeType = 'code128' | 'datamatrix'
export type DataField = string // e.g. 'serial_1', 'partNumber_1', 'serial_barcode', etc.
export type Unit = 'mm' | 'px'

export interface LayoutItem {
  x: number
  y: number
  w: number
  h: number
  i: string
  moved?: boolean
}

export interface LabelElementProps {
  // Text
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  fontFamily?: string

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

  // Editor-only visual state
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

export interface TemplateData {
  layout: LayoutItem[]
  elements: Record<
    string,
    Omit<LabelElement, 'props'> & { props: Omit<LabelElementProps, 'customText' | 'testValue'> }
  >
  labelSize: LabelSize
  gridCols?: number // сохраняем в шаблоне для точного воспроизведения в принтере
  gridRows?: number
  gridStep?: number // шаг в мм (0.5 | 1 | 2 ...)
}

// Используется принтером — props без editor-only полей
export interface PrintLabelElement {
  id: string
  type: ElementType
  dataField: DataField
  props: Omit<LabelElementProps, 'customText' | 'testValue'>
}

export interface PrintTemplateData {
  layout: LayoutItem[]
  elements: Record<string, PrintLabelElement>
  labelSize: LabelSize
  gridCols?: number
  gridRows?: number
}

export interface CommonData {
  [key: string]: string
}

export interface BatchItem {
  serial: string
}
