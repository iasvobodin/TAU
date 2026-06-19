export type ElementType = 'text' | 'barcode' | 'image'
export type BarcodeType = 'code128' | 'datamatrix'
export type DataField = string
export type Unit = 'mm' | 'px'

// ─── Позиция элемента в мм ────────────────────────────────────────────────────
export interface ElementPosition {
  x: number // мм от левого края поля печати
  y: number // мм от верхнего края поля печати
  w: number // ширина в мм
  h: number // высота в мм
}

// ─── Текстовые параметры для рендерера ───────────────────────────────────────
// Единый объект, который принимают ОБА рендерера (HTML и SVG).
// Все отступы — в мм; рендерер сам конвертирует в px/units.
export interface TextRenderProps {
  fontSize: number
  fontFamily: string
  bold: boolean
  align: 'left' | 'center' | 'right'
  verticalAlign: 'top' | 'middle' | 'bottom'
  lineHeight: number
  paddingTop: number // мм
  paddingRight: number // мм
  paddingBottom: number // мм
  paddingLeft: number // мм
}

const _MM_TO_PX = 3.78

/**
 * Преобразует сырые props элемента в нормализованный TextRenderProps.
 * Поддерживает миграцию со старых полей paddingX/paddingY (px → мм).
 */
export function resolveTextProps(props: LabelElementProps): TextRenderProps {
  // paddingX/paddingY — старый формат (значения в пикселях).
  // Если paddingX/paddingY НЕ заданы — missing индивидуальные отступы = 0.
  // Если заданы — применяем миграцию px → мм.
  const hasLegacyPadding = props.paddingX != null || props.paddingY != null

  let legacyPX = 0
  let legacyPY = 0
  if (hasLegacyPadding) {
    legacyPX = props.paddingX != null ? props.paddingX / _MM_TO_PX : 0
    legacyPY = props.paddingY != null ? props.paddingY / _MM_TO_PX : 0
  }

  return {
    fontSize: props.fontSize ?? 12,
    fontFamily: props.fontFamily ?? 'Arial',
    bold: props.bold ?? false,
    align: props.align ?? 'left',
    verticalAlign: props.verticalAlign ?? 'middle',
    lineHeight: props.lineHeight ?? 1.2,
    paddingTop: props.paddingTop ?? legacyPY,
    paddingRight: props.paddingRight ?? legacyPX,
    paddingBottom: props.paddingBottom ?? legacyPY,
    paddingLeft: props.paddingLeft ?? legacyPX
  }
}

// ─── Свойства элемента ────────────────────────────────────────────────────────
export interface LabelElementProps {
  // ── Текст ──────────────────────────────────────────────────────────────────
  fontSize?: number
  bold?: boolean
  align?: 'left' | 'center' | 'right'
  verticalAlign?: 'top' | 'middle' | 'bottom'
  fontFamily?: string
  lineHeight?: number // множитель межстрочного интервала

  // Отступы внутри блока в мм, все 4 стороны
  paddingTop?: number
  paddingRight?: number
  paddingBottom?: number
  paddingLeft?: number

  /**
   * @deprecated Только для миграции старых шаблонов (значение в px).
   * Используйте paddingLeft / paddingRight.
   */
  paddingX?: number
  /**
   * @deprecated Только для миграции старых шаблонов (значение в px).
   * Используйте paddingTop / paddingBottom.
   */
  paddingY?: number

  // isSerial: ровно один элемент (text или barcode) используется как
  // серийный номер при пакетной печати.
  isSerial?: boolean

  // linkedBarcodeId: ID barcode-элемента, с которым связан этот текст.
  // При рендеринге текст будет показывать то же значение, что и связанный barcode.
  // Устанавливается через Link Brush (кнопка «Связать» → клик на barcode на макете).
  linkedBarcodeId?: string | null

  // ── Штрихкод ───────────────────────────────────────────────────────────────
  barcodeType?: BarcodeType
  barcodeHeight?: number
  barcodeWidth?: number
  barcodeScale?: number
  testValue?: string

  // ── Изображение ────────────────────────────────────────────────────────────
  src?: string
  imageWidth?: number
  imageHeight?: string

  // ── Editor-only (не сохраняется в шаблон) ──────────────────────────────────
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
  text: number
  barcode: number
  image: number
}

// ─── Формат шаблона (сохраняется в JSON) ─────────────────────────────────────
// Исключаем editor-only поля и устаревшие paddingX/paddingY.
type SavedElementProps = Omit<
  LabelElementProps,
  'customText' | 'testValue' | 'paddingX' | 'paddingY'
>

export interface TemplateData {
  positions: Record<string, ElementPosition>
  elements: Record<string, Omit<LabelElement, 'props'> & { props: SavedElementProps }>
  labelSize: LabelSize
}

// ─── Формат для рендереров (печать) ──────────────────────────────────────────
// Включает paddingX/paddingY для обратной совместимости при загрузке старых шаблонов.
export interface PrintLabelElement {
  id: string
  type: ElementType
  dataField: DataField
  props: SavedElementProps & { paddingX?: number; paddingY?: number }
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
  serial?: string
  [key: string]: string | undefined
}
