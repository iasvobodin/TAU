import { normalizeTextProps, MM_TO_PX } from '../assets/textLayout'

export type ElementType = 'text' | 'barcode' | 'image' | 'table'
export type TableBorderStyle = 'none' | 'solid' | 'dashed'
export type BarcodeType = 'code128' | 'datamatrix'
export type DataField = string
export type Unit = 'mm' | 'px'

// ─── Настройки рамки всей этикетки ──────────────────────────────────────────────
export interface LabelBorderSettings {
  enabled: boolean
  width: number // мм
  color: string // hex, e.g. '#000000'
}

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
  textRotation: 0 | 90 | 180 | 270

  // ── Новые текстовые свойства (Фаза 1) ──
  // Опциональные до нормализации; всегда заполнены дефолтами после
  // normalizeTextProps() из assets/textLayout.ts (единый источник дефолтов).
  italic?: boolean
  letterSpacing?: number // px
  wordSpacing?: number // px
  textCase?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  underline?: boolean
  strikethrough?: boolean
  textColor?: string
  // Резерв для будущего: fontStyle?, fontWeight?, wrapMode?, maxLines?, lineClampEllipsis?
}

/**
 * Преобразует сырые props элемента в нормализованный TextRenderProps.
 * Поддерживает миграцию со старых полей paddingX/paddingY (px → мм).
 * Дефолты НЕ дублируются здесь — единый источник TEXT_STYLE_DEFAULTS
 * в assets/textLayout.ts (normalizeTextProps).
 */
export function resolveTextProps(props: LabelElementProps): TextRenderProps {
  // paddingX/paddingY — старый формат (значения в пикселях).
  // Если paddingX/paddingY НЕ заданы — missing индивидуальные отступы = 0.
  // Если заданы — применяем миграцию px → мм.
  const hasLegacyPadding = props.paddingX != null || props.paddingY != null

  let legacyPX = 0
  let legacyPY = 0
  if (hasLegacyPadding) {
    legacyPX = props.paddingX != null ? props.paddingX / MM_TO_PX : 0
    legacyPY = props.paddingY != null ? props.paddingY / MM_TO_PX : 0
  }

  return normalizeTextProps({
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    bold: props.bold,
    italic: props.italic,
    align: props.align,
    verticalAlign: props.verticalAlign,
    lineHeight: props.lineHeight,
    letterSpacing: props.letterSpacing,
    wordSpacing: props.wordSpacing,
    textCase: props.textCase,
    underline: props.underline,
    strikethrough: props.strikethrough,
    textColor: props.textColor,
    paddingTop: props.paddingTop ?? legacyPY,
    paddingRight: props.paddingRight ?? legacyPX,
    paddingBottom: props.paddingBottom ?? legacyPY,
    paddingLeft: props.paddingLeft ?? legacyPX,
    textRotation: props.textRotation
  })
}

// ─── Мета-информация ячейки таблицы ──────────────────────────────────────────
// Добавляется в props text-элемента, который является ячейкой таблицы.
export interface TableCellMeta {
  tableId: string // ID родительского table-элемента
  row: number // Индекс строки
  col: number // Индекс столбца
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

  // ── Новые текстовые свойства (Фаза 1) ──
  italic?: boolean
  letterSpacing?: number // px
  wordSpacing?: number // px
  textCase?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  underline?: boolean
  strikethrough?: boolean
  textColor?: string

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

  // ── Ячейка таблицы ──
  tableCellMeta?: TableCellMeta // метка, указывающая что этот text — ячейка таблицы

  // ── Таблица (контейнер) ──
  tableRows?: number
  tableCols?: number
  tableCellWidth?: number // мм
  tableCellHeight?: number // мм
  tableGapH?: number // мм, горизонтальный отступ между ячейками
  tableGapV?: number // мм, вертикальный отступ между ячейками
  tableShowBorders?: boolean
  tableOutline?: boolean // контур (рамка) вокруг всей таблицы
  tableBorderStyle?: TableBorderStyle
  tableGlobalFontSize?: number // мм, глобальный размер шрифта для всех ячеек
  tableCellIds?: string[][] // матрица ID дочерних text-элементов [row][col]

  // ── Поворот текста (градусы) ──────────────────────────────────────────────
  textRotation?: 0 | 90 | 180 | 270

  // ── Контур (outline) для любого элемента: текст, barcode, изображение ──
  outlineEnabled?: boolean // показывать контур
  outlineWidth?: number // толщина линии в мм (по умолчанию 0.5)
  outlineColor?: string // цвет линии (по умолчанию '#333')

  // ── Editor-only (не сохраняется в шаблон) ──────────────────────────────────
  customText?: string | null
}

export interface TableExport {
  /** @deprecated Больше не используется. Ячейки — обычные text-элементы */
  cellData?: never
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

/** @deprecated Используется только для обратной совместимости со старыми шаблонами */
export interface CellData {
  text: string
  fontSizeMm: number
  letterSpacing: number
  verticalAlignment: 'top' | 'center' | 'bottom'
  offsetX?: number
  offsetY?: number
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
  /** @deprecated Используется только для обратной совместимости */
  tableData?: Record<string, CellData[][]>
}

export interface TemplateData {
  positions: Record<string, ElementPosition>
  elements: Record<string, Omit<LabelElement, 'props'> & { props: SavedElementProps }>
  labelSize: LabelSize
  /** @deprecated Используется только для обратной совместимости */
  tableData?: Record<string, CellData[][]>
  // ── Рамка всей этикетки ──
  labelBorder?: LabelBorderSettings
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
  /** @deprecated Ячейки таблицы теперь хранятся как обычные text-элементы */
  tableData?: Record<string, CellData[][]>
  // ── Рамка всей этикетки ──
  labelBorder?: LabelBorderSettings
}

/** @deprecated Используйте CommonData */
export type BatchItem = Record<string, string | undefined> & { serial?: string }

export interface CommonData {
  [key: string]: string
}

// ─── Настройки multi-label печати (несколько этикеток на одном листе) ──────
export interface PrintLayoutConfig {
  /** Включена ли multi-label печать */
  enabled: boolean
  /** Физический размер листа (этикетки в принтере) — мм */
  sheetWidth: number
  sheetHeight: number
  /** Зазоры между этикетками — мм */
  gapX: number
  gapY: number
  /** Отступы от краёв листа — мм */
  marginTop: number
  marginBottom: number
  marginLeft: number
  marginRight: number
  /** Авторасчёт: если true, cols/rows вычисляются из размеров */
  autoArrange: boolean
  /** Количество колонок и строк (если autoArrange = false) */
  cols: number
  rows: number
}

export const LABEL_FILE_VERSION = 1

// ─── Формат полного файла этикетки (сохраняется в JSON) ─────────────────────
// Включает всё: template-данные + editor-only данные + состояние групповой печати.
export interface LabelFileData {
  formatVersion: number
  // ── Template-часть (как в TemplateData) ──
  positions: Record<string, ElementPosition>
  elements: Record<string, Omit<LabelElement, 'props'> & { props: SavedElementProps }>
  labelSize: LabelSize
  labelBorder?: LabelBorderSettings

  // ── Editor-only данные (customText для text, testValue для barcode) ──
  editorData: Record<string, { customText?: string | null; testValue?: string }>

  // ── Состояние групповой печати ──
  batchCommonData: Record<string, string>
  batchSerialsText: string
  batchIterableTexts: Record<string, string>
  batchPrintEnabled: boolean
  svgRenderEnabled: boolean
  /** Настройки multi-label печати */
  printLayoutConfig?: PrintLayoutConfig
}
