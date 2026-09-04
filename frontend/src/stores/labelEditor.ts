import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import bwipjs from 'bwip-js'
import { os, filesystem } from '@neutralinojs/lib'
import { LabelPrinterMulty } from '@/assets/printLabelMultyСopy'
import { fontManager } from '@/assets/fontManager'
import { renderLabelToSVG } from '@/assets/renderToSVG'
import type { FontInfo } from '@/assets/renderToSVG'
import type {
  ElementType,
  ElementPosition,
  DataField,
  FieldCounters,
  LabelElement,
  LabelElementProps,
  LabelSize,
  LabelBorderSettings,
  TemplateData,
  LabelFileData,
  BatchItem,
  PrintLayoutConfig
} from '@/types/label'
import { LABEL_FILE_VERSION } from '@/types/label'
import {
  MM_TO_PX,
  TEXT_STYLE_KEYS,
  TEXT_STYLE_DEFAULTS,
  normalizeTextProps
} from '@/assets/textLayout'

export const useLabelEditorStore = defineStore('labelEditor', () => {
  // ===== State =====
  const positions = ref<Record<string, ElementPosition>>({})
  const elements = ref<Record<string, LabelElement>>({})
  const selectedId = ref<string | null>(null)
  const labelSize = ref<LabelSize>({ width: 100, height: 60, unit: 'mm' })
  const zoom = ref<number>(1)
  // gridStep зафиксирован на 0.1 мм — не экспортируется, канвас использует константу
  const gridStep = ref<number>(0.1)

  const fieldCounters = ref<FieldCounters>({ text: 0, barcode: 0, image: 0 })

  // Инкрементируется при каждой загрузке шаблона.
  // LabelCanvas подписывается на него и вызывает fitZoom.
  const templateKey = ref(0)

  // Сигнал для LabelCanvas: подогнать масштаб под рабочую область (кнопка «вписать»)
  const fitZoomTrigger = ref(0)

  // ── Отображение границ элементов с размерами (чертёжный режим) ────────────
  const showElementBorders = ref(false)

  // ── Рамка всей этикетки ──────────────────────────────────────────────────────
  const labelBorder = ref<LabelBorderSettings>({
    enabled: false,
    width: 1.0,
    color: '#000000'
  })

  // ── Copy Brush (кисточка) ──────────────────────────────────────────────────
  const copyBrushActive = ref(false)
  const copyBrushSourceId = ref<string | null>(null)

  // ── Link Brush (связь текста с barcode) ────────────────────────────────────
  const linkBrushActive = ref(false)
  const linkBrushSourceId = ref<string | null>(null)

  const batchCommonData = ref<Record<string, string>>({})
  const batchSerialsText = ref('261200001-01\n261200002-01\n261200003-01')
  const batchPrintEnabled = ref(false)
  const svgRenderEnabled = ref(false)
  const lastSavedPath = ref<string>('')
  const lastSavedLabelPath = ref<string>('')

  // ── Multi-label печать (несколько этикеток на одном листе) ──────────────────
  const printLayoutConfig = ref<PrintLayoutConfig>({
    enabled: false,
    sheetWidth: 0,
    sheetHeight: 0,
    gapX: 2,
    gapY: 2,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    autoArrange: true,
    cols: 1,
    rows: 1
  })

  // ── Multi-selection & clipboard ─────────────────────────────────────────────
  const selectedIds = ref<string[]>([])
  const selectionAnchor = ref<string | null>(null)
  const clipboardBuffer = ref<string | null>(null)

  const availableFonts = ref<FontInfo[]>([{ label: 'Arial', value: 'Arial', svgPreviewPath: '' }])
  const fontsLoading = ref(true)

  // ── Инициализация fontManager ─────────────────────────────────────────────
  ;(async () => {
    await fontManager.init()
    const fromCache = fontManager.getSupportedFonts()
    if (fromCache.length) {
      availableFonts.value = fromCache.map((e) => ({
        label: e.fullName,
        value: e.fullName,
        svgPreviewPath: e.svgPreviewPath
      }))
    }
    fontsLoading.value = false
    fontManager.scan().then(() => {
      // onlyScanned=true — только шрифты, реально найденные на этом компьютере
      const scanned = fontManager.getSupportedFonts(true)
      if (scanned.length) {
        availableFonts.value = scanned.map((e) => ({
          label: e.fullName,
          value: e.fullName,
          svgPreviewPath: e.svgPreviewPath
        }))
      }
    })
  })()

  // ===== Computed =====
  const labelSizeMM = computed(() => {
    if (labelSize.value.unit === 'mm')
      return { width: labelSize.value.width, height: labelSize.value.height }
    return { width: labelSize.value.width / MM_TO_PX, height: labelSize.value.height / MM_TO_PX }
  })

  const labelSizeInPx = computed(() => ({
    width: labelSizeMM.value.width * MM_TO_PX * zoom.value,
    height: labelSizeMM.value.height * MM_TO_PX * zoom.value
  }))

  const realSizeInPx = computed(() => ({
    width: labelSizeMM.value.width * MM_TO_PX,
    height: labelSizeMM.value.height * MM_TO_PX
  }))

  const selectedElement = computed(() =>
    selectedId.value ? (elements.value[selectedId.value] ?? null) : null
  )

  const selectedPosition = computed(() =>
    selectedId.value ? (positions.value[selectedId.value] ?? null) : null
  )

  const templateTextFields = computed(() => {
    const seen = new Set<string>()

    // Тексты без linkedBarcodeId (включая ячейки таблицы — они тоже text)
    const texts = Object.values(elements.value)
      .filter((el) => el.type === 'text' && !el.props.linkedBarcodeId)
      .filter((el) => {
        if (seen.has(el.dataField)) return false
        seen.add(el.dataField)
        return true
      })
      .map((el) => ({ dataField: el.dataField, label: el.dataField }))

    // Barcode без isSerial — каждый может иметь своё значение из common data
    const barcodes = Object.values(elements.value)
      .filter((el) => el.type === 'barcode' && !el.props.isSerial)
      .filter((el) => {
        if (seen.has(el.dataField)) return false
        seen.add(el.dataField)
        return true
      })
      .map((el) => ({ dataField: el.dataField, label: el.dataField }))

    return [...texts, ...barcodes]
  })

  // hasSerialInTemplate: только barcode (текст больше не имеет isSerial)
  const hasSerialInTemplate = computed(() =>
    Object.values(elements.value).some((el) => el.type === 'barcode' && el.props.isSerial === true)
  )

  // Итерируемые barcode: список их dataField-ов
  const iterableFields = computed(() =>
    Object.values(elements.value)
      .filter((el) => el.type === 'barcode' && el.props.isSerial)
      .map((el) => el.dataField)
  )

  // Многострочные тексты значений для каждого итерируемого barcode
  const batchIterableTexts = ref<Record<string, string>>({})

  // Количество строк для каждого итерируемого barcode
  const iterableCounts = computed(() => {
    const counts: Record<string, number> = {}
    for (const field of iterableFields.value) {
      const text = batchIterableTexts.value[field] ?? ''
      counts[field] = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean).length
    }
    return counts
  })

  // Флаг: несовпадение количества строк у итерируемых barcode
  const iterableCountMismatch = computed(() => {
    const counts = Object.values(iterableCounts.value).filter((c) => c > 0)
    return counts.length > 1 && new Set(counts).size > 1
  })

  const serials = computed(() =>
    batchSerialsText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  )

  watch(
    templateTextFields,
    (fields) => {
      const currentKeys = new Set(fields.map((f) => f.dataField))
      for (const key of Object.keys(batchCommonData.value)) {
        if (!currentKeys.has(key)) delete batchCommonData.value[key]
      }
      for (const { dataField } of fields) {
        if (!(dataField in batchCommonData.value)) {
          // Инициализируем из customText соответствующего элемента, если он есть
          const textEl = Object.values(elements.value).find(
            (el) => el.type === 'text' && !el.props.linkedBarcodeId && el.dataField === dataField
          )
          batchCommonData.value[dataField] = textEl?.props.customText ?? ''
        }
      }
      if (!hasSerialInTemplate.value) batchPrintEnabled.value = false
    },
    { deep: false }
  )

  // ===== Helpers =====
  function uid(): string {
    return Math.random().toString(36).substring(2, 9)
  }

  function getDefaultText(field?: string): string {
    return field ?? 'Текст'
  }

  function getDisplayText(element: LabelElement): string {
    if (element.props.customText != null) return element.props.customText as string
    return getDefaultText(element.dataField)
  }

  function splitDataField(dataField: string): { prefix: string; suffix: string } {
    const m = dataField.match(/^(.+)_(\d+)$/)
    if (m) return { prefix: m[1], suffix: `_${m[2]}` }
    return { prefix: dataField, suffix: '' }
  }

  /**
   * Выбирает из props только ключи текстового стиля из реестра TEXT_STYLE_KEYS.
   * Используется при сохранении (buildTemplateData) — единый источник списка ключей.
   */
  function pickTextStyleKeys(props: LabelElementProps): Partial<LabelElementProps> {
    const out: Partial<LabelElementProps> = {}
    const src = props as Record<string, unknown>
    for (const key of TEXT_STYLE_KEYS) {
      if (src[key] !== undefined) (out as Record<string, unknown>)[key] = src[key]
    }
    return out
  }

  // ===== Position management =====
  function clampToLabel(pos: ElementPosition): ElementPosition {
    const { width, height } = labelSizeMM.value
    const w = Math.min(pos.w, width)
    const h = Math.min(pos.h, height)
    const x = Math.max(0, Math.min(pos.x, width - w))
    const y = Math.max(0, Math.min(pos.y, height - h))
    return { x, y, w, h }
  }

  function updatePosition(id: string, pos: ElementPosition): void {
    // Запрет на изменение позиции для ячеек таблицы — позиция управляется таблицей
    const el = elements.value[id]
    if (el?.props.tableCellMeta) return

    // Округляем до 0.1 мм
    positions.value[id] = clampToLabel({
      x: Math.round(pos.x * 10) / 10,
      y: Math.round(pos.y * 10) / 10,
      w: Math.max(0.5, Math.round(pos.w * 10) / 10),
      h: Math.max(0.5, Math.round(pos.h * 10) / 10)
    })
  }

  // ===== Barcode =====
  async function generateBarcode(element: LabelElement): Promise<void> {
    if (element.type !== 'barcode') return
    const barcodeType = element.props.barcodeType ?? 'code128'
    const barcodeValue = element.props.testValue ?? 'TEST123456'
    try {
      let canvas = document.createElement('canvas')
      if (barcodeType === 'datamatrix') {
        canvas = await bwipjs.toCanvas(canvas, {
          bcid: 'datamatrix',
          text: barcodeValue,
          scale: element.props.barcodeScale ?? 2,
          height: 6,
          width: 6
        })
      } else {
        canvas = await bwipjs.toCanvas(canvas, {
          bcid: 'code128',
          text: barcodeValue,
          scale: element.props.barcodeScale ?? 2,
          height: element.props.barcodeHeight ?? 6
        })
      }
      element.props.customText = canvas.toDataURL('image/png')
    } catch (e) {
      console.error('Barcode generation error:', e)
      element.props.customText = ''
    }
  }

  async function updateBarcode(elementId: string): Promise<void> {
    const el = elements.value[elementId]
    if (el?.type === 'barcode') await generateBarcode(el)
  }

  // ===== Table helpers =====

  /**
   * Возвращает ID всех ячеек таблицы (плоский список).
   */
  function getTableCellIds(tableId: string): string[] {
    const el = elements.value[tableId]
    if (!el || el.type !== 'table') return []
    return (el.props.tableCellIds ?? []).flat().filter(Boolean)
  }

  /**
   * Применяет tableGlobalFontSize ко всем ячейкам таблицы.
   */
  function applyGlobalFont(tableId: string): void {
    const el = elements.value[tableId]
    if (!el || el.type !== 'table') return

    const fontSize = el.props.tableGlobalFontSize ?? 5
    const cellIds = el.props.tableCellIds ?? []

    for (const row of cellIds) {
      for (const cellId of row) {
        const cell = elements.value[cellId]
        if (cell) {
          cell.props.fontSize = fontSize
        }
      }
    }
  }

  /**
   * Копирует текстовые пропсы (fontSize, fontFamily, bold, align, verticalAlign)
   * из контейнера таблицы во все её ячейки.
   */
  const applyGlobalTextStyle = (tableId: string): void => {
    const el = elements.value[tableId]
    if (!el || el.type !== 'table') return

    const cellIds = el.props.tableCellIds ?? []
    const src = el.props as Record<string, unknown>
    for (const row of cellIds) {
      for (const cellId of row) {
        const cell = elements.value[cellId]
        if (!cell) continue
        // Копируем текстовые пропсы из таблицы в каждую ячейку
        // (только заданные ключи реестра TEXT_STYLE_KEYS — не затираем ячейку)
        const dst = cell.props as Record<string, unknown>
        for (const key of TEXT_STYLE_KEYS) {
          if (src[key] !== undefined) dst[key] = src[key]
        }
      }
    }
  }

  /**
   * Пересчитывает позиции всех ячеек таблицы на основе её параметров,
   * а также обновляет размер (w, h) самого контейнера.
   */
  function updateTableProps(tableId: string): void {
    const el = elements.value[tableId]
    if (!el || el.type !== 'table') return

    const {
      tableRows,
      tableCols,
      tableCellWidth,
      tableCellHeight,
      tableGapH,
      tableGapV,
      tableCellIds
    } = el.props
    const rows = tableRows ?? 5
    const cols = tableCols ?? 5
    const cw = tableCellWidth ?? 17
    const ch = tableCellHeight ?? 9
    const gapH = tableGapH ?? 0.4
    const gapV = tableGapV ?? 0.4

    // Позиция контейнера
    const containerPos = positions.value[tableId]
    if (!containerPos) return

    // Обновляем размер контейнера под размер всех ячеек
    const newW = cols * cw + (cols - 1) * gapH
    const newH = rows * ch + (rows - 1) * gapV
    positions.value[tableId] = {
      ...containerPos,
      w: newW,
      h: newH
    }

    // Пересчитываем позиции каждой ячейки
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cellId = tableCellIds?.[r]?.[c]
        if (!cellId || !positions.value[cellId]) continue

        const cell = elements.value[cellId]
        if (!cell) continue

        positions.value[cellId] = {
          x: containerPos.x + c * (cw + gapH),
          y: containerPos.y + r * (ch + gapV),
          w: cw,
          h: ch
        }
      }
    }
  }

  /**
   * Изменяет размер таблицы: добавляет/удаляет ячейки при изменении rows/cols.
   */
  const resizeTable = (tableId: string, newRows: number, newCols: number): void => {
    const el = elements.value[tableId]
    if (!el || el.type !== 'table') return

    const oldCellIds = el.props.tableCellIds ?? []
    const oldRows = oldCellIds.length
    const oldCols = oldRows > 0 ? oldCellIds[0].length : 0

    const cw = el.props.tableCellWidth ?? 17
    const ch = el.props.tableCellHeight ?? 9
    const gapH = el.props.tableGapH ?? 0.4
    const gapV = el.props.tableGapV ?? 0.4

    const newCellIds: string[][] = []

    for (let r = 0; r < newRows; r++) {
      const rowIds: string[] = []
      for (let c = 0; c < newCols; c++) {
        // Если ячейка уже существует — переиспользуем
        if (r < oldRows && c < oldCols && oldCellIds[r]?.[c]) {
          const existingId = oldCellIds[r][c]
          if (elements.value[existingId]) {
            rowIds.push(existingId)
            continue
          }
        }
        // Создаём новую ячейку
        const cellId = `${tableId}_cell_${r}_${c}`
        rowIds.push(cellId)
        elements.value[cellId] = {
          id: cellId,
          type: 'text',
          dataField: ``,
          props: {
            fontSize: el.props.tableGlobalFontSize ?? 5,
            align: 'center',
            verticalAlign: 'middle',
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            customText: '',
            tableCellMeta: { tableId, row: r, col: c }
          }
        }
        positions.value[cellId] = { x: 0, y: 0, w: cw, h: ch }
      }
      newCellIds.push(rowIds)
    }

    // Удаляем лишние ячейки (если таблица уменьшилась)
    for (let r = 0; r < oldRows; r++) {
      for (let c = 0; c < oldCols; c++) {
        const oldId = oldCellIds[r]?.[c]
        if (oldId && !newCellIds.flat().includes(oldId)) {
          delete elements.value[oldId]
          delete positions.value[oldId]
        }
      }
    }

    el.props.tableRows = newRows
    el.props.tableCols = newCols
    el.props.tableCellIds = newCellIds

    // Обновляем позиции
    updateTableProps(tableId)
  }

  // ===== Element management =====
  function addElement(type: ElementType): void {
    const id = uid()
    const counterKey = type as keyof FieldCounters
    fieldCounters.value[counterKey]++
    const dataField: DataField = `${type}_${fieldCounters.value[counterKey]}`

    const { width, height } = labelSizeMM.value
    positions.value[id] = clampToLabel({
      x: 0,
      y: 0,
      w: Math.round((width / 3) * 10) / 10,
      h: Math.round((height / (type === 'barcode' ? 4 : 6)) * 10) / 10
    })

    const baseFontSize = Math.max(
      8,
      Math.min(72, Math.round(12 * (realSizeInPx.value.height / 600)))
    )

    elements.value[id] = {
      id,
      type,
      dataField,
      props: {
        ...(type === 'text' && {
          // Дефолты текстовых свойств — из единого реестра TEXT_STYLE_DEFAULTS
          ...normalizeTextProps({ fontSize: baseFontSize }),
          // Исторические отступы слева/справа (мм) — сохраняем прежнее поведение
          paddingLeft: 1.0,
          paddingRight: 1.0,
          customText: dataField,
          // Контур
          outlineEnabled: false,
          outlineWidth: 0.5,
          outlineColor: '#333333'
        }),
        ...(type === 'barcode' && {
          barcodeType: 'code128',
          barcodeHeight: 6,
          barcodeWidth: 6,
          barcodeScale: 2,
          isSerial: false,
          testValue: 'TEST123456',
          // Контур
          outlineEnabled: false,
          outlineWidth: 0.5,
          outlineColor: '#333333'
        }),
        ...(type === 'image' && {
          src: '',
          imageWidth: 100,
          imageHeight: 'auto',
          // Контур
          outlineEnabled: false,
          outlineWidth: 0.5,
          outlineColor: '#333333'
        })
        // Таблица больше не создаётся через addElement — используйте addTable()
      }
    }

    if (type === 'barcode') generateBarcode(elements.value[id])
    selectedId.value = id
  }

  /**
   * Создаёт таблицу как композитный элемент-контейнер с N дочерними text-элементами (ячейками).
   */
  function addTable(
    rows: number = 5,
    cols: number = 5,
    cellWidth: number = 17,
    cellHeight: number = 9
  ): string {
    const id = uid()
    const cellIds: string[][] = []

    // Создаём text-элементы для каждой ячейки
    for (let r = 0; r < rows; r++) {
      const rowIds: string[] = []
      for (let c = 0; c < cols; c++) {
        const cellId = `${id}_cell_${r}_${c}`
        rowIds.push(cellId)

        const cellPos: ElementPosition = {
          x: 0,
          y: 0,
          w: cellWidth,
          h: cellHeight
        }

        elements.value[cellId] = {
          id: cellId,
          type: 'text',
          dataField: ``,
          props: {
            fontSize: 5,
            align: 'center',
            verticalAlign: 'middle',
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            customText: '',
            tableCellMeta: { tableId: id, row: r, col: c }
          }
        }
        positions.value[cellId] = cellPos
      }
      cellIds.push(rowIds)
    }

    // Создаём контейнер таблицы
    const containerPos: ElementPosition = {
      x: 10,
      y: 10,
      w: cols * cellWidth + (cols - 1) * 0.4,
      h: rows * cellHeight + (rows - 1) * 0.4
    }

    elements.value[id] = {
      id,
      type: 'table',
      dataField: '',
      props: {
        tableRows: rows,
        tableCols: cols,
        tableCellWidth: cellWidth,
        tableCellHeight: cellHeight,
        tableGapH: 0.4,
        tableGapV: 0.4,
        tableShowBorders: true,
        tableOutline: false,
        tableGlobalFontSize: 5,
        tableCellIds: cellIds,
        // ── Глобальные текстовые пропсы (применяются ко всем ячейкам) ──
        fontSize: 5,
        fontFamily: 'Arial',
        bold: false,
        align: 'center',
        verticalAlign: 'middle',
        lineHeight: 1.2
      }
    }
    positions.value[id] = containerPos

    // Обновляем позиции ячеек
    updateTableProps(id)

    selectedId.value = id
    return id
  }

  function removeElement(id: string): void {
    const el = elements.value[id]
    if (!el) return

    // Если это ячейка таблицы — очистить ссылку из матрицы tableCellIds
    if (el.props.tableCellMeta) {
      const { tableId, row, col } = el.props.tableCellMeta
      const tableEl = elements.value[tableId]
      if (tableEl?.props.tableCellIds?.[row]) {
        tableEl.props.tableCellIds[row][col] = ''
      }
    }

    // Если это таблица-контейнер — каскадно удалить все ячейки
    if (el.type === 'table') {
      const cellIds = el.props.tableCellIds ?? []
      for (const row of cellIds) {
        for (const cellId of row) {
          if (cellId) {
            delete positions.value[cellId]
            delete elements.value[cellId]
          }
        }
      }
    }

    delete positions.value[id]
    delete elements.value[id]
    if (selectedId.value === id) selectedId.value = null
  }

  function toggleBarcodeIterable(id: string): void {
    const el = elements.value[id]
    if (!el || el.type !== 'barcode') return
    // Просто переключаем, НЕ сбрасываем на других
    el.props.isSerial = !el.props.isSerial
  }

  function renameField(id: string, newPrefix: string): void {
    const el = elements.value[id]
    if (!el) return
    const sanitized = newPrefix.trim().replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, '_') || el.type
    const { suffix } = splitDataField(el.dataField)
    const newDataField = `${sanitized}${suffix}`
    if (newDataField === el.dataField) return

    if (el.dataField in batchCommonData.value) {
      batchCommonData.value[newDataField] = batchCommonData.value[el.dataField]
      delete batchCommonData.value[el.dataField]
    }
    el.dataField = newDataField
  }

  // ===== Label size =====
  function validateSize(): void {
    if (labelSize.value.width < 10) labelSize.value.width = 10
    if (labelSize.value.height < 10) labelSize.value.height = 10
    if (labelSize.value.width > 500) labelSize.value.width = 500
    if (labelSize.value.height > 500) labelSize.value.height = 500
  }

  // ===== Multi-selection & clipboard =====
  /**
   * Управление выделением ячеек таблицы.
   * Если shiftKey — расширяет диапазон от selectionAnchor до id (в пределах одной таблицы).
   * Если !shiftKey — сбрасывает multi-selection и выбирает только id.
   */
  function selectCell(id: string, shiftKey: boolean): void {
    const el = elements.value[id]
    if (!el || !el.props.tableCellMeta) {
      // Не ячейка таблицы — сбрасываем multi-selection
      selectedIds.value = []
      selectionAnchor.value = null
      return
    }
    if (!shiftKey || !selectionAnchor.value) {
      // Обычный клик или нет якоря — начинаем новое выделение
      selectedIds.value = [id]
      selectionAnchor.value = id
      return
    }
    // Shift+click: расширяем диапазон в пределах той же таблицы
    const anchorEl = elements.value[selectionAnchor.value]
    if (!anchorEl?.props.tableCellMeta) {
      selectedIds.value = [id]
      selectionAnchor.value = id
      return
    }
    const { tableId, row, col } = el.props.tableCellMeta
    const anchorMeta = anchorEl.props.tableCellMeta
    if (anchorMeta.tableId !== tableId) {
      // Разные таблицы — начинаем новое выделение
      selectedIds.value = [id]
      selectionAnchor.value = id
      return
    }
    const tableEl = elements.value[tableId]
    if (!tableEl?.props.tableCellIds) return
    const cellIds = tableEl.props.tableCellIds
    const r1 = Math.min(anchorMeta.row, row)
    const r2 = Math.max(anchorMeta.row, row)
    const c1 = Math.min(anchorMeta.col, col)
    const c2 = Math.max(anchorMeta.col, col)
    const range: string[] = []
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        const cellId = cellIds[r]?.[c]
        if (cellId) range.push(cellId)
      }
    }
    selectedIds.value = range
  }

  function clearMultiSelection(): void {
    selectedIds.value = []
    selectionAnchor.value = null
  }

  /**
   * Копирует текст указанного элемента в clipboardBuffer и системный буфер.
   * Не затирает буфер пустой строкой — чтобы клик по пустой ячейке
   * не уничтожал ранее скопированное.
   */
  function copyText(id: string): void {
    const el = elements.value[id]
    if (!el || el.type !== 'text') return
    const text = el.props.customText ?? ''
    if (!text) return
    clipboardBuffer.value = text
    navigator.clipboard.writeText(text).catch(() => {})
  }

  /**
   * Копирует содержимое выбранного элемента (selectedId или переданный id).
   */
  function copySelectedContent(id?: string): void {
    const targetId = id ?? selectedId.value
    if (!targetId) return
    copyText(targetId)
  }

  /**
   * Вырезает: копирует + очищает customText.
   */
  function cutSelectedContent(): void {
    if (!selectedId.value) return
    copyText(selectedId.value)
    const el = elements.value[selectedId.value]
    if (el?.type === 'text') el.props.customText = ''
  }

  /**
   * Вставляет clipboardBuffer в выбранный элемент.
   */
  function pasteToSelected(): void {
    if (clipboardBuffer.value == null || !selectedId.value) return
    const el = elements.value[selectedId.value]
    if (el?.type === 'text') el.props.customText = clipboardBuffer.value
  }

  /**
   * Очищает содержимое (customText) всех выбранных текстовых элементов.
   * Не удаляет сами элементы — только текст.
   */
  function deleteSelectedContent(): void {
    const ids = selectedIds.value.length
      ? selectedIds.value
      : selectedId.value
        ? [selectedId.value]
        : []
    for (const id of ids) {
      const el = elements.value[id]
      if (el?.type === 'text') {
        el.props.customText = ''
      }
    }
  }

  // ===== Template =====
  function buildTemplateData(): TemplateData {
    return {
      positions: { ...positions.value },
      elements: Object.fromEntries(
        Object.entries(elements.value).map(([id, el]) => [
          id,
          {
            id: el.id,
            type: el.type,
            dataField: el.dataField,
            props: {
              ...(el.type === 'text' && {
                // Текстовые ключи — из единого реестра TEXT_STYLE_KEYS
                ...pickTextStyleKeys(el.props),
                linkedBarcodeId: el.props.linkedBarcodeId,
                // Привязка к таблице (для ячеек)
                tableCellMeta: el.props.tableCellMeta,
                // Контур
                outlineEnabled: el.props.outlineEnabled,
                outlineWidth: el.props.outlineWidth,
                outlineColor: el.props.outlineColor
              }),
              ...(el.type === 'barcode' && {
                barcodeType: el.props.barcodeType,
                barcodeHeight: el.props.barcodeHeight,
                barcodeWidth: el.props.barcodeWidth,
                barcodeScale: el.props.barcodeScale,
                isSerial: el.props.isSerial,
                // Контур
                outlineEnabled: el.props.outlineEnabled,
                outlineWidth: el.props.outlineWidth,
                outlineColor: el.props.outlineColor
              }),
              ...(el.type === 'image' && {
                src: el.props.src,
                imageWidth: el.props.imageWidth,
                imageHeight: el.props.imageHeight,
                // Контур
                outlineEnabled: el.props.outlineEnabled,
                outlineWidth: el.props.outlineWidth,
                outlineColor: el.props.outlineColor
              }),
              ...(el.type === 'table' && {
                tableRows: el.props.tableRows,
                tableCols: el.props.tableCols,
                tableCellWidth: el.props.tableCellWidth,
                tableCellHeight: el.props.tableCellHeight,
                tableGapH: el.props.tableGapH,
                tableGapV: el.props.tableGapV,
                tableShowBorders: el.props.tableShowBorders,
                tableOutline: el.props.tableOutline,
                tableBorderStyle: el.props.tableBorderStyle,
                tableGlobalFontSize: el.props.tableGlobalFontSize,
                tableCellIds: el.props.tableCellIds,
                // Глобальные текстовые пропсы (применяются ко всем ячейкам)
                fontSize: el.props.fontSize,
                fontFamily: el.props.fontFamily,
                bold: el.props.bold,
                align: el.props.align,
                verticalAlign: el.props.verticalAlign,
                lineHeight: el.props.lineHeight
              })
            }
          }
        ])
      ),
      labelSize: labelSize.value,
      labelBorder: { ...labelBorder.value }
    }
  }

  /**
   * Извлекает префикс dataField до суффикса `_N`.
   * Пример: "serial_barcode" → "serial"
   */
  function dataFieldPrefix(dataField: string): string {
    const m = dataField.match(/^(.+?)(?:_\d+)?$/)
    return m ? m[1] : dataField
  }

  async function applyTemplateData(parsed: any): Promise<void> {
    if (parsed.labelSize) labelSize.value = parsed.labelSize

    // ── Рамка всей этикетки ──
    if (parsed.labelBorder) {
      labelBorder.value = {
        enabled: parsed.labelBorder.enabled ?? false,
        width: parsed.labelBorder.width ?? 1.0,
        color: parsed.labelBorder.color ?? '#000000'
      }
    } else {
      labelBorder.value = { enabled: false, width: 1.0, color: '#000000' }
    }

    if (parsed.positions) {
      // Шаг 4: округляем позиции до 0.1 мм при загрузке
      const rounded: Record<string, ElementPosition> = {}
      for (const [id, pos] of Object.entries(parsed.positions)) {
        const p = pos as ElementPosition
        rounded[id] = {
          x: Math.round(p.x * 10) / 10,
          y: Math.round(p.y * 10) / 10,
          w: Math.max(0.5, Math.round(p.w * 10) / 10),
          h: Math.max(0.5, Math.round(p.h * 10) / 10)
        }
      }
      positions.value = rounded
    } else if (parsed.layout) {
      // Миграция старого grid-формата
      const cols = parsed.gridCols ?? 12
      const rows = parsed.gridRows ?? 12
      const { width, height } = labelSizeMM.value
      positions.value = {}
      for (const item of parsed.layout) {
        positions.value[item.i] = clampToLabel({
          x: (item.x / cols) * width,
          y: (item.y / rows) * height,
          w: (item.w / cols) * width,
          h: (item.h / rows) * height
        })
      }
    }

    elements.value = {}
    for (const [id, raw] of Object.entries(parsed.elements ?? {})) {
      const el = raw as any
      elements.value[id] = {
        id: el.id,
        type: el.type,
        dataField: el.dataField,
        props: {
          ...el.props,
          ...(el.type === 'text' && { customText: el.dataField }),
          ...(el.type === 'barcode' && {
            testValue: el.props?.testValue ?? 'TEST123456',
            customText: null
          })
        }
      }
      if (el.type === 'barcode') await generateBarcode(elements.value[id])
    }

    // Шаг 5: нормализация отсутствующих полей у текстовых элементов дефолтами
    // из единого реестра TEXT_STYLE_DEFAULTS (обратная совместимость: старые
    // шаблоны без новых полей получают дефолты)
    for (const el of Object.values(elements.value)) {
      if (el.type === 'text') {
        const p = el.props as Record<string, unknown>
        for (const key of TEXT_STYLE_KEYS) {
          if (p[key] == null) p[key] = TEXT_STYLE_DEFAULTS[key]
        }
        // Удаляем isSerial из текста — он теперь только на barcode
        if ('isSerial' in p) delete p.isSerial
      }
    }

    // Шаг 2: миграция isSerial со старых текстовых элементов на barcode
    for (const el of Object.values(elements.value)) {
      if (el.type === 'text' && el.props.linkedBarcodeId == null) {
        // Ищем barcode с совпадающим префиксом dataField
        const textPrefix = dataFieldPrefix(el.dataField)
        const matchingBarcode = Object.values(elements.value).find(
          (other) =>
            other.type === 'barcode' &&
            !other.props.isSerial &&
            dataFieldPrefix(other.dataField) === textPrefix
        )
        if (matchingBarcode) {
          matchingBarcode.props.isSerial = true
          el.props.linkedBarcodeId = matchingBarcode.id
          console.log(
            `[migration] isSerial перенесён с текста "${el.dataField}" на barcode "${matchingBarcode.dataField}" (${matchingBarcode.id})`
          )
        }
      }
    }

    // Миграция: если есть старый tableData, создаём text-элементы для таблиц
    // (обратная совместимость)
    if (parsed.tableData) {
      for (const tableId of Object.keys(parsed.tableData)) {
        const tableEl = elements.value[tableId]
        if (!tableEl || tableEl.type !== 'table') continue
        // Если у таблицы уже есть tableCellIds — пропускаем (новая версия)
        if (tableEl.props.tableCellIds?.length) continue

        const oldTableData = parsed.tableData[tableId]
        if (!oldTableData?.length) continue

        const oldRows = tableEl.props.tableRows ?? oldTableData.length
        const oldCols = tableEl.props.tableCols ?? oldTableData[0]?.length ?? 1

        // Преобразуем старый формат в новый
        const cellIds: string[][] = []
        for (let r = 0; r < oldRows; r++) {
          const rowIds: string[] = []
          for (let c = 0; c < oldCols; c++) {
            const cellId = uid()
            const oldCell = oldTableData[r]?.[c]
            const cellW = tableEl.props.tableCellWidth ?? 17
            const cellH = tableEl.props.tableCellHeight ?? 9
            const gapH = tableEl.props.tableGapH ?? 0.4
            const gapV = tableEl.props.tableGapV ?? 0.4
            const x = c * (cellW + gapH)
            const y = r * (cellH + gapV)

            positions.value[cellId] = {
              x: Math.round(x * 10) / 10,
              y: Math.round(y * 10) / 10,
              w: Math.round(cellW * 10) / 10,
              h: Math.round(cellH * 10) / 10
            }

            const fontSizePx = oldCell?.fontSizeMm
              ? Math.round(oldCell.fontSizeMm * MM_TO_PX)
              : (tableEl.props.tableGlobalFontSize ?? 12)

            elements.value[cellId] = {
              id: cellId,
              type: 'text',
              dataField: `cell_${r}_${c}`,
              props: {
                fontSize: fontSizePx,
                fontFamily: 'Arial',
                align: 'center',
                verticalAlign:
                  oldCell?.verticalAlignment === 'top'
                    ? 'top'
                    : oldCell?.verticalAlignment === 'bottom'
                      ? 'bottom'
                      : 'middle',
                bold: false,
                lineHeight: 1.2,
                paddingTop: 0,
                paddingRight: 1.0,
                paddingBottom: 0,
                paddingLeft: 1.0,
                customText: oldCell?.text ?? '',
                tableCellMeta: { tableId, row: r, col: c }
              }
            }

            rowIds.push(cellId)
          }
          cellIds.push(rowIds)
        }

        // Обновляем пропсы контейнера
        tableEl.props.tableCellIds = cellIds
        // Очищаем старые пропсы если есть
        delete (tableEl.props as any).rows
        delete (tableEl.props as any).columns
        delete (tableEl.props as any).cellWidth
        delete (tableEl.props as any).cellHeight
        delete (tableEl.props as any).cellPaddingHorizontal
        delete (tableEl.props as any).cellPaddingVertical
        delete (tableEl.props as any).showBorders
        delete (tableEl.props as any).globalFontSizeMm
      }
    }

    resetCounters()
    for (const el of Object.values(elements.value)) {
      const m = el.dataField.match(/_(\d+)$/)
      const num = m ? parseInt(m[1]) : 0
      const key = el.type as keyof FieldCounters
      if (key in fieldCounters.value && num > fieldCounters.value[key]) {
        fieldCounters.value[key] = num
      }
    }

    selectedId.value = null
    templateKey.value++ // сигнал для LabelCanvas → fitZoom
  }

  // ===== Label File (полный файл этикетки) =====
  function buildLabelFileData(): LabelFileData {
    const editorData: Record<string, { customText?: string | null; testValue?: string }> = {}
    for (const [id, el] of Object.entries(elements.value)) {
      if (el.type === 'text') {
        // Сохраняем customText для ВСЕХ текстовых элементов (включая пустые)
        editorData[id] = { customText: el.props.customText ?? null }
      } else if (el.type === 'barcode' && el.props.testValue != null) {
        editorData[id] = { testValue: el.props.testValue }
      }
    }
    return {
      formatVersion: LABEL_FILE_VERSION,
      positions: { ...positions.value },
      elements: buildTemplateData().elements,
      labelSize: { ...labelSize.value },
      labelBorder: { ...labelBorder.value },
      editorData,
      batchCommonData: { ...batchCommonData.value },
      batchSerialsText: batchSerialsText.value,
      batchIterableTexts: { ...batchIterableTexts.value },
      batchPrintEnabled: batchPrintEnabled.value,
      svgRenderEnabled: svgRenderEnabled.value,
      printLayoutConfig: { ...printLayoutConfig.value }
    }
  }

  async function applyLabelFileData(parsed: any): Promise<void> {
    // 1. Применяем template-часть (позиции, элементы, размер)
    await applyTemplateData(parsed)

    // 2. Восстанавливаем editor-only данные (customText / testValue)
    // ВАЖНО: восстанавливаем customText для ВСЕХ текстовых элементов,
    // включая пустые строки и null, чтобы перетереть значение по умолчанию
    // из applyTemplateData (customText = dataField).
    if (parsed.editorData) {
      for (const [id, data] of Object.entries(parsed.editorData)) {
        const el = elements.value[id]
        if (!el) continue
        const d = data as { customText?: string | null; testValue?: string }
        if (el.type === 'text' && 'customText' in d) {
          el.props.customText = d.customText
        }
        if (el.type === 'barcode' && d.testValue != null) {
          el.props.testValue = d.testValue
        }
      }
    }

    // 3. Восстанавливаем состояние групповой печати
    batchCommonData.value = parsed.batchCommonData ?? {}
    batchSerialsText.value = parsed.batchSerialsText ?? batchSerialsText.value
    batchIterableTexts.value = parsed.batchIterableTexts ?? {}
    batchPrintEnabled.value = parsed.batchPrintEnabled ?? false
    svgRenderEnabled.value = parsed.svgRenderEnabled ?? false

    // 4. Восстанавливаем настройки multi-label печати
    if (parsed.printLayoutConfig) {
      printLayoutConfig.value = { ...printLayoutConfig.value, ...parsed.printLayoutConfig }
    }
  }

  function resetCounters(): void {
    fieldCounters.value = { text: 0, barcode: 0, image: 0 }
  }

  // ===== Persistence =====
  async function saveTemplate(): Promise<void> {
    if (lastSavedPath.value) await _writeToPath(lastSavedPath.value)
    else await saveTemplateAs()
  }

  async function saveTemplateAs(): Promise<void> {
    try {
      const path = await os.showSaveDialog('Сохранить шаблон', {
        defaultPath: lastSavedPath.value || 'label-template.json',
        filters: [{ name: 'JSON шаблон', extensions: ['json'] }]
      })
      if (!path) return
      await _writeToPath(path.endsWith('.json') ? path : path + '.json')
    } catch (e) {
      console.error(e)
      alert('Ошибка при сохранении шаблона')
    }
  }

  async function _writeToPath(path: string): Promise<void> {
    await filesystem.writeFile(path, JSON.stringify(buildTemplateData(), null, 2))
    lastSavedPath.value = path
    alert(`Шаблон сохранён: ${path.split(/[/\\]/).pop()}`)
  }

  async function openTemplate(): Promise<void> {
    try {
      const defaultPath = lastSavedPath.value ? lastSavedPath.value.replace(/[^/\\]+$/, '') : ''
      const entries = await os.showOpenDialog('Открыть шаблон', {
        ...(defaultPath ? { defaultPath } : {}),
        filters: [{ name: 'JSON шаблон', extensions: ['json'] }]
      })
      if (!entries?.length) return
      const path = entries[0]
      await applyTemplateData(JSON.parse(await filesystem.readFile(path)))
      lastSavedPath.value = path
      alert(`Шаблон загружён: ${path.split(/[/\\]/).pop()}`)
    } catch (e) {
      console.error(e)
      alert('Ошибка при открытии шаблона')
    }
  }

  function clearTemplate(): void {
    if (!confirm('Очистить все элементы?')) return
    positions.value = {}
    elements.value = {}
    selectedId.value = null
    resetCounters()
  }

  // ===== Label File Persistence =====
  async function _writeLabelToPath(path: string): Promise<void> {
    await filesystem.writeFile(path, JSON.stringify(buildLabelFileData(), null, 2))
    lastSavedLabelPath.value = path
    alert(`Этикетка сохранена: ${path.split(/[/\\]/).pop()}`)
  }

  async function saveLabel(): Promise<void> {
    if (lastSavedLabelPath.value) await _writeLabelToPath(lastSavedLabelPath.value)
    else await saveLabelAs()
  }

  async function saveLabelAs(): Promise<void> {
    try {
      const path = await os.showSaveDialog('Сохранить этикетку', {
        defaultPath: lastSavedLabelPath.value || 'label.label.json',
        filters: [{ name: 'Файл этикетки', extensions: ['label.json'] }]
      })
      if (!path) return
      await _writeLabelToPath(
        path.endsWith('.label.json') ? path : path.replace(/\.json$/, '') + '.label.json'
      )
    } catch (e) {
      console.error(e)
      alert('Ошибка при сохранении этикетки')
    }
  }

  async function openLabel(): Promise<void> {
    try {
      const defaultPath = lastSavedLabelPath.value
        ? lastSavedLabelPath.value.replace(/[^/\\]+$/, '')
        : ''
      const entries = await os.showOpenDialog('Открыть этикетку', {
        ...(defaultPath ? { defaultPath } : {}),
        filters: [{ name: 'Файл этикетки', extensions: ['label.json'] }]
      })
      if (!entries?.length) return
      const path = entries[0]
      await applyLabelFileData(JSON.parse(await filesystem.readFile(path)))
      lastSavedLabelPath.value = path
      alert(`Этикетка загружена: ${path.split(/[/\\]/).pop()}`)
    } catch (e) {
      console.error(e)
      alert('Ошибка при открытии этикетки')
    }
  }

  function clearLabel(): void {
    if (!confirm('Очистить все элементы и данные этикетки?')) return
    positions.value = {}
    elements.value = {}
    selectedId.value = null
    resetCounters()
    batchCommonData.value = {}
    batchSerialsText.value = '261200001-01\n261200002-01\n261200003-01'
    batchIterableTexts.value = {}
    batchPrintEnabled.value = false
    svgRenderEnabled.value = false
    labelBorder.value = { enabled: false, width: 1.0, color: '#000000' }
    lastSavedLabelPath.value = ''
  }

  // ===== Print =====
  function buildSinglePrintData(): { items: { serial: string }[]; common: Record<string, string> } {
    const common: Record<string, string> = {}
    let serial = ''
    for (const el of Object.values(elements.value)) {
      if (el.type === 'table') continue // контейнер пропускаем
      if (el.type === 'text' && !el.props.linkedBarcodeId) {
        const val = el.props.customText ?? getDefaultText(el.dataField)
        // Ячейки таблицы: все имеют dataField='', поэтому используем ID как уникальный ключ
        const key = el.props.tableCellMeta ? el.id : el.dataField
        common[key] = val
      } else if (el.type === 'barcode' && el.props.isSerial) {
        serial = el.props.testValue ?? ''
      }
    }
    if (serial) common['serial'] = serial
    return { items: [{ serial }], common }
  }

  async function printLabels(): Promise<void> {
    const printer = new LabelPrinterMulty(window.NL_PATH ?? '')

    if (!batchPrintEnabled.value) {
      const { items, common } = buildSinglePrintData()
      const td = buildTemplateData()

      // Если включён multi-label режим — печатаем листы с копиями
      if (
        printLayoutConfig.value.enabled &&
        printLayoutConfig.value.cols > 0 &&
        printLayoutConfig.value.rows > 0
      ) {
        const perSheet = printLayoutConfig.value.cols * printLayoutConfig.value.rows
        // Заполняем лист копиями единственного элемента
        const sheetItems: BatchItem[] = []
        for (let i = 0; i < perSheet; i++) {
          sheetItems.push({ ...items[0] })
        }
        const sheets = [sheetItems]
        if (svgRenderEnabled.value) {
          await printer.printSheetsSVG(sheets, common as any, td, printLayoutConfig.value)
        } else {
          await printer.printSheets(sheets, common as any, td, printLayoutConfig.value)
        }
      } else {
        if (svgRenderEnabled.value) await printer.printFromTemplateSVG(items, common, td)
        else await printer.printFromTemplate(items, common, td)
      }
      return
    }

    // Batch: собираем items из итерируемых barcode
    const iterableData: Record<string, string[]> = {}
    for (const el of Object.values(elements.value)) {
      if (el.type === 'barcode' && el.props.isSerial) {
        const text = batchIterableTexts.value[el.dataField] ?? ''
        iterableData[el.dataField] = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      }
    }

    const lengths = Object.values(iterableData).map((arr) => arr.length)
    if (!lengths.length) {
      alert('Нет итерируемых barcode для пакетной печати')
      return
    }

    // Валидация: все списки должны быть одинаковой длины
    if (new Set(lengths).size > 1) {
      alert(
        `Ошибка: несовпадение количества значений у итерируемых barcode.\n${Object.entries(
          iterableData
        )
          .map(([k, v]) => `${k}: ${v.length} шт.`)
          .join('\n')}`
      )
      return
    }

    const count = lengths[0]
    if (!count) {
      alert('Нет значений для пакетной печати')
      return
    }

    // Строим items — по одному на каждую этикетку
    const items: BatchItem[] = []
    for (let i = 0; i < count; i++) {
      const item: Record<string, string> = {}
      for (const [field, values] of Object.entries(iterableData)) {
        item[field] = values[i] ?? ''
      }
      items.push(item as BatchItem)
    }

    const templateData = buildTemplateData()

    // Если включён multi-label режим — группируем items в sheets
    if (
      printLayoutConfig.value.enabled &&
      printLayoutConfig.value.cols > 0 &&
      printLayoutConfig.value.rows > 0
    ) {
      const perSheet = printLayoutConfig.value.cols * printLayoutConfig.value.rows
      const sheets: BatchItem[][] = []
      for (let i = 0; i < items.length; i += perSheet) {
        sheets.push(items.slice(i, i + perSheet))
      }

      if (svgRenderEnabled.value) {
        await printer.printSheetsSVG(
          sheets,
          { ...batchCommonData.value } as any,
          templateData,
          printLayoutConfig.value
        )
      } else {
        await printer.printSheets(
          sheets,
          { ...batchCommonData.value } as any,
          templateData,
          printLayoutConfig.value
        )
      }
      return
    }

    // Старый путь: 1 этикетка = 1 лист
    const printFn = svgRenderEnabled.value
      ? printer.printFromTemplateSVG.bind(printer)
      : printer.printFromTemplate.bind(printer)
    await printFn(items, { ...batchCommonData.value } as any, templateData)
  }

  // ===== Save SVG =====
  async function saveSVG(): Promise<void> {
    const td = buildTemplateData()

    if (!batchPrintEnabled.value) {
      // ── Одиночный режим ─────────────────────────────────────────────
      const { items, common } = buildSinglePrintData()
      try {
        const svg = await renderLabelToSVG(
          td,
          common,
          items[0]?.serial ?? '',
          showElementBorders.value
        )
        const defaultPath = (lastSavedPath.value || 'label').replace(/\.[^.]+$/, '') + '.svg'
        const path = await os.showSaveDialog('Сохранить SVG', {
          defaultPath,
          filters: [{ name: 'SVG файл', extensions: ['svg'] }]
        })
        if (!path) return
        await filesystem.writeFile(path, svg)
        alert(`SVG сохранён: ${path.split(/[/\\]/).pop()}`)
      } catch (e) {
        console.error('[saveSVG]', e)
        alert('Ошибка при сохранении SVG')
      }
      return
    }

    // ── Пакетный режим ────────────────────────────────────────────────
    const iterableData: Record<string, string[]> = {}
    for (const el of Object.values(elements.value)) {
      if (el.type === 'barcode' && el.props.isSerial) {
        const text = batchIterableTexts.value[el.dataField] ?? ''
        iterableData[el.dataField] = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean)
      }
    }

    const lengths = Object.values(iterableData).map((arr) => arr.length)
    if (!lengths.length) {
      alert('Нет итерируемых barcode для пакетного сохранения')
      return
    }

    if (new Set(lengths).size > 1) {
      alert(
        `Ошибка: несовпадение количества значений у итерируемых barcode.\n${Object.entries(
          iterableData
        )
          .map(([k, v]) => `${k}: ${v.length} шт.`)
          .join('\n')}`
      )
      return
    }

    const count = lengths[0]
    if (!count) {
      alert('Нет значений для пакетного сохранения')
      return
    }

    // Строим items
    const items: BatchItem[] = []
    for (let i = 0; i < count; i++) {
      const item: Record<string, string> = {}
      for (const [field, values] of Object.entries(iterableData)) {
        item[field] = values[i] ?? ''
      }
      items.push(item as BatchItem)
    }

    const firstField = Object.keys(iterableData)[0]

    // Выбор папки
    let folderPath: string
    try {
      folderPath = await os.showFolderDialog('Выберите папку для сохранения SVG')
      if (!folderPath) return
    } catch (e) {
      console.error('[saveSVG] showFolderDialog error:', e)
      alert('Ошибка при выборе папки')
      return
    }

    let savedCount = 0
    for (let i = 0; i < items.length; i++) {
      try {
        const itemData = { ...batchCommonData.value, ...items[i] } as any
        const svg = await renderLabelToSVG(
          td,
          itemData,
          items[i].serial ?? '',
          showElementBorders.value
        )

        // Имя файла: из первого итерируемого поля, или label_N
        let baseName = items[i][firstField]?.trim() ?? ''
        if (!baseName) baseName = `label_${i + 1}`
        baseName = baseName.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_')
        const filePath = `${folderPath}/${baseName}.svg`

        await filesystem.writeFile(filePath, svg)
        savedCount++
      } catch (e) {
        console.error(`[saveSVG] ошибка при сохранении этикетки #${i + 1}:`, e)
      }
    }

    alert(
      `Сохранено ${savedCount} из ${items.length} SVG файлов в папке "${folderPath.split(/[/\\]/).pop()}"`
    )
  }

  // ===== Copy Brush (кисточка) =====
  function activateCopyBrush(id: string): void {
    copyBrushActive.value = true
    copyBrushSourceId.value = id
  }

  function deactivateCopyBrush(): void {
    copyBrushActive.value = false
    copyBrushSourceId.value = null
  }

  function applyCopyBrush(targetId: string): void {
    const srcId = copyBrushSourceId.value
    if (!srcId || srcId === targetId) {
      deactivateCopyBrush()
      return
    }
    const src = elements.value[srcId]
    const tgt = elements.value[targetId]
    if (!src || !tgt || src.type !== 'text' || tgt.type !== 'text') {
      deactivateCopyBrush()
      return
    }

    // Копируем текстовые props из единого реестра TEXT_STYLE_KEYS
    // (isSerial, dataField, customText в реестр не входят — не копируются)
    const propsToCopy: Array<keyof LabelElementProps> = [...TEXT_STYLE_KEYS]
    for (const key of propsToCopy) {
      ;(tgt.props as any)[key] = (src.props as any)[key]
    }

    // Копируем размеры w, h (но не x, y)
    const srcPos = positions.value[srcId]
    if (srcPos) {
      const tgtPos = positions.value[targetId]
      if (tgtPos) {
        updatePosition(targetId, {
          x: tgtPos.x,
          y: tgtPos.y,
          w: srcPos.w,
          h: srcPos.h
        })
      }
    }

    deactivateCopyBrush()
    selectedId.value = targetId
  }

  // ── Link Brush (связь текста с barcode) ──────────────────────────────────────
  function activateLinkBrush(id: string): void {
    linkBrushActive.value = true
    linkBrushSourceId.value = id
  }
  function deactivateLinkBrush(): void {
    linkBrushActive.value = false
    linkBrushSourceId.value = null
  }
  function applyLinkBrush(targetId: string): void {
    const srcId = linkBrushSourceId.value
    if (!srcId || srcId === targetId) {
      deactivateLinkBrush()
      return
    }
    const src = elements.value[srcId]
    const tgt = elements.value[targetId]
    if (!src || !tgt || src.type !== 'text' || tgt.type !== 'barcode') {
      deactivateLinkBrush()
      return
    }
    // Связываем текст с barcode — текст будет показывать значение barcode
    src.props.linkedBarcodeId = targetId
    deactivateLinkBrush()
    selectedId.value = targetId
  }

  function triggerFitZoom() {
    fitZoomTrigger.value++
  }

  return {
    // State
    positions,
    elements,
    selectedId,
    copyBrushActive,
    copyBrushSourceId,
    linkBrushActive,
    linkBrushSourceId,
    labelSize,
    zoom,
    templateKey,
    fitZoomTrigger,
    showElementBorders,
    labelBorder,
    printLayoutConfig,
    batchCommonData,
    batchSerialsText,
    batchPrintEnabled,
    svgRenderEnabled,
    lastSavedPath,
    lastSavedLabelPath,
    selectedIds,
    selectionAnchor,
    clipboardBuffer,
    availableFonts,
    fontsLoading,
    // Computed
    labelSizeMM,
    labelSizeInPx,
    realSizeInPx,
    selectedElement,
    selectedPosition,
    templateTextFields,
    hasSerialInTemplate,
    serials,
    iterableFields,
    iterableCounts,
    iterableCountMismatch,
    batchIterableTexts,
    // Actions — position
    updatePosition,
    // Actions — elements
    addElement,
    addTable,
    removeElement,
    updateBarcode,
    toggleBarcodeIterable,
    renameField,
    splitDataField,
    // Actions — multi-selection & clipboard
    selectCell,
    clearMultiSelection,
    copySelectedContent,
    cutSelectedContent,
    pasteToSelected,
    deleteSelectedContent,
    // Actions — table
    getTableCellIds,
    updateTableProps,
    resizeTable,
    applyGlobalFont,
    applyGlobalTextStyle,
    // Actions — editor
    validateSize,
    getDisplayText,
    // Actions — template
    saveTemplate,
    saveTemplateAs,
    openTemplate,
    clearTemplate,
    // Actions — label file
    saveLabel,
    saveLabelAs,
    openLabel,
    clearLabel,
    // Actions — copy brush
    activateCopyBrush,
    deactivateCopyBrush,
    applyCopyBrush,
    // Actions — link brush
    activateLinkBrush,
    deactivateLinkBrush,
    applyLinkBrush,
    // Actions — view
    triggerFitZoom,
    // Actions — print
    printLabels,
    // Actions — save
    saveSVG
  }
})
