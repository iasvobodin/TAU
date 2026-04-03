import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import bwipjs from 'bwip-js'
import { os, filesystem } from '@neutralinojs/lib'
import { LabelPrinterMulty } from '@/assets/printLabelMultyСopy'
import type {
  ElementType,
  DataField,
  FieldCounters,
  LabelElement,
  LabelSize,
  LayoutItem,
  TemplateData
} from '@/types/label'

const MM_TO_PX = 3.78

export const useLabelEditorStore = defineStore('labelEditor', () => {
  // ===== State =====
  const layout = ref<LayoutItem[]>([])
  const elements = ref<Record<string, LabelElement>>({})
  const selectedId = ref<string | null>(null)
  const labelSize = ref<LabelSize>({ width: 100, height: 60, unit: 'mm' })
  const zoom = ref<number>(1)
  const gridStep = ref<number>(1) // шаг сетки в мм

  const fieldCounters = ref<FieldCounters>({
    serial: 0,
    partNumber: 0,
    description: 0,
    manufacturer: 0,
    custom: 0
  })

  // Групповая печать: общие данные (dataField → значение) и серийники
  const batchCommonData = ref<Record<string, string>>({})
  const batchSerialsText = ref('261200001-01\n261200002-01\n261200003-01')
  const batchPrintEnabled = ref(false)

  // Последний использованный путь — для удобного defaultPath в диалогах
  const lastSavedPath = ref<string>('')

  // ===== Computed =====
  const labelSizeInPx = computed(() => {
    const w =
      labelSize.value.unit === 'mm' ? labelSize.value.width * MM_TO_PX : labelSize.value.width
    const h =
      labelSize.value.unit === 'mm' ? labelSize.value.height * MM_TO_PX : labelSize.value.height
    return { width: w * zoom.value, height: h * zoom.value }
  })

  const realSizeInPx = computed(() => {
    if (labelSize.value.unit === 'mm') {
      return {
        width: labelSize.value.width * MM_TO_PX,
        height: labelSize.value.height * MM_TO_PX
      }
    }
    return { width: labelSize.value.width, height: labelSize.value.height }
  })

  // Количество колонок/строк = размер в мм / шаг
  // Для px-этикеток переводим в мм через MM_TO_PX
  const gridCols = computed(() => {
    const widthMM =
      labelSize.value.unit === 'mm' ? labelSize.value.width : labelSize.value.width / MM_TO_PX
    return Math.max(1, Math.round(widthMM / gridStep.value))
  })

  const gridRows = computed(() => {
    const heightMM =
      labelSize.value.unit === 'mm' ? labelSize.value.height : labelSize.value.height / MM_TO_PX
    return Math.max(1, Math.round(heightMM / gridStep.value))
  })

  const gridConfig = computed(() => ({
    rowHeight: labelSizeInPx.value.height / gridRows.value,
    colNum: gridCols.value
  }))

  // Текстовые поля шаблона (не серийники) — для формы групповой печати
  // Каждый элемент уникален по dataField
  const templateTextFields = computed(() => {
    const seen = new Set<string>()
    return Object.values(elements.value)
      .filter((el) => el.type === 'text' && !el.dataField.startsWith('serial'))
      .filter((el) => {
        if (seen.has(el.dataField)) return false
        seen.add(el.dataField)
        return true
      })
      .map((el) => ({ dataField: el.dataField, label: getFieldDisplayName(el.dataField) }))
  })

  // Есть ли в шаблоне серийник (текст или штрихкод)
  const hasSerialInTemplate = computed(() =>
    Object.values(elements.value).some((el) => el.dataField.startsWith('serial'))
  )

  // Синхронизируем batchCommonData при изменении элементов шаблона:
  // добавляем новые поля, убираем удалённые
  watch(
    templateTextFields,
    (fields) => {
      const currentKeys = new Set(fields.map((f) => f.dataField))
      // Удаляем поля которых больше нет в шаблоне
      for (const key of Object.keys(batchCommonData.value)) {
        if (!currentKeys.has(key)) delete batchCommonData.value[key]
      }
      // Добавляем новые поля с пустым значением
      for (const { dataField } of fields) {
        if (!(dataField in batchCommonData.value)) {
          batchCommonData.value[dataField] = ''
        }
      }
      // Если серийника нет в шаблоне — отключаем групповую печать
      if (!hasSerialInTemplate.value) {
        batchPrintEnabled.value = false
      }
    },
    { deep: false }
  )

  const serials = computed(() =>
    batchSerialsText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length)
  )

  const selectedElement = computed(() =>
    selectedId.value ? (elements.value[selectedId.value] ?? null) : null
  )

  // ===== Helpers =====
  function uid(): string {
    return Math.random().toString(36).substring(2, 9)
  }

  function getDefaultText(field?: string): string {
    const base = field?.split('_')[0]
    switch (base) {
      case 'serial':
        return 'SN:123456'
      case 'partNumber':
        return 'PN:AB123'
      case 'description':
        return 'Описание продукта'
      case 'manufacturer':
        return 'Производитель'
      default:
        return 'Текст'
    }
  }

  function getDisplayText(element: LabelElement): string {
    if (element.props.customText !== undefined && element.props.customText !== null) {
      return element.props.customText as string
    }
    return getDefaultText(element.dataField)
  }

  function getFieldDisplayName(dataField: string): string {
    const [base, index] = dataField.split('_')
    switch (base) {
      case 'serial':
        return `Serial ${index}`
      case 'partNumber':
        return `Part Number ${index}`
      case 'description':
        return `Description ${index}`
      case 'manufacturer':
        return `Manufacturer ${index}`
      case 'custom':
        return `Custom ${index}`
      default:
        return dataField
    }
  }

  function generateFieldName(baseField: keyof FieldCounters): DataField {
    fieldCounters.value[baseField]++
    return `${baseField}_${fieldCounters.value[baseField]}`
  }

  // ===== Barcode Generation =====
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
    } catch (error) {
      console.error('Error generating barcode:', error)
      element.props.customText = ''
    }
  }

  async function updateBarcode(elementId: string): Promise<void> {
    const element = elements.value[elementId]
    if (element?.type === 'barcode') {
      await generateBarcode(element)
    }
  }

  // ===== Element Management =====
  // Зажимает item в пределах сетки (gridCols × gridRows)
  function clampToGrid(item: { x: number; y: number; w: number; h: number }) {
    const cols = gridCols.value
    const rows = gridRows.value
    const w = Math.min(item.w, cols)
    const h = Math.min(item.h, rows)
    const x = Math.min(item.x, cols - w)
    const y = Math.min(item.y, rows - h)
    return { x, y, w, h }
  }

  function addElement(type: ElementType, baseField?: string): void {
    const id = uid()

    const dataField: DataField =
      type === 'barcode'
        ? `${baseField ?? 'serial'}_barcode`
        : generateFieldName((baseField ?? 'custom') as keyof FieldCounters)

    const rawItem = {
      x: 0,
      y: 0,
      w: Math.min(4, gridCols.value),
      h: Math.min(type === 'barcode' ? 4 : 2, gridRows.value)
    }
    layout.value.push({ ...clampToGrid(rawItem), i: id })

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
          fontSize: baseFontSize,
          align: 'left',
          bold: false,
          fontFamily: 'Arial',
          customText: getDefaultText(baseField)
        }),
        ...(type === 'barcode' && {
          barcodeType: 'code128',
          barcodeHeight: 6,
          barcodeWidth: 6,
          barcodeScale: 10,
          testValue: 'TEST123456'
        }),
        ...(type === 'image' && {
          src: '',
          imageWidth: 100,
          imageHeight: 'auto'
        })
      }
    }

    if (type === 'barcode') {
      generateBarcode(elements.value[id])
    }

    selectedId.value = id
  }

  // Вызывается из LabelCanvas через @item-resized — зажимаем в grid
  function onItemResized(id: string, h: number, w: number, _hpx: number, _wpx: number): void {
    const item = layout.value.find((l) => l.i === id)
    if (!item) return
    const clamped = clampToGrid({ x: item.x, y: item.y, w, h })
    item.w = clamped.w
    item.h = clamped.h
    // Если позиция вышла за пределы — тоже корректируем
    item.x = clamped.x
    item.y = clamped.y
  }

  // Вызывается из LabelCanvas через @item-moved
  function onItemMoved(id: string, newY: number, newX: number): void {
    const item = layout.value.find((l) => l.i === id)
    if (!item) return
    const clamped = clampToGrid({ x: newX, y: newY, w: item.w, h: item.h })
    item.x = clamped.x
    item.y = clamped.y
  }

  function removeElement(id: string): void {
    layout.value = layout.value.filter((l) => l.i !== id)
    delete elements.value[id]
    if (selectedId.value === id) selectedId.value = null
  }

  // ===== Size / Zoom =====
  function validateSize(): void {
    if (labelSize.value.width < 10) labelSize.value.width = 10
    if (labelSize.value.height < 10) labelSize.value.height = 10
    if (labelSize.value.width > 500) labelSize.value.width = 500
    if (labelSize.value.height > 500) labelSize.value.height = 500
  }

  // ===== Template helpers =====
  function buildTemplateData(): TemplateData {
    return {
      layout: layout.value,
      elements: Object.fromEntries(
        Object.entries(elements.value).map(([id, el]) => [
          id,
          {
            id: el.id,
            type: el.type,
            dataField: el.dataField,
            props: {
              ...(el.type === 'text' && {
                fontSize: el.props.fontSize,
                bold: el.props.bold,
                align: el.props.align,
                fontFamily: el.props.fontFamily
              }),
              ...(el.type === 'barcode' && {
                barcodeType: el.props.barcodeType,
                barcodeHeight: el.props.barcodeHeight,
                barcodeWidth: el.props.barcodeWidth,
                barcodeScale: el.props.barcodeScale
              }),
              ...(el.type === 'image' && {
                src: el.props.src,
                imageWidth: el.props.imageWidth,
                imageHeight: el.props.imageHeight
              })
            }
          }
        ])
      ),
      labelSize: labelSize.value,
      gridCols: gridCols.value,
      gridRows: gridRows.value,
      gridStep: gridStep.value
    }
  }

  async function applyTemplateData(parsed: any): Promise<void> {
    layout.value = (parsed.layout ?? []).map((l: any) => ({
      x: l.x ?? 0,
      y: l.y ?? 0,
      w: l.w ?? 4,
      h: l.h ?? 2,
      i: l.i
    }))

    elements.value = {}

    for (const [id, raw] of Object.entries(parsed.elements ?? {})) {
      const el = raw as any
      elements.value[id] = {
        id: el.id,
        type: el.type,
        dataField: el.dataField,
        props: {
          ...el.props,
          ...(el.type === 'text' && {
            customText: getDefaultText(el.dataField)
          }),
          ...(el.type === 'barcode' && {
            testValue: 'TEST123456',
            customText: null
          })
        }
      }

      if (el.type === 'barcode') {
        await generateBarcode(elements.value[id])
      }
    }

    if (parsed.labelSize) {
      labelSize.value = parsed.labelSize
    }
    if (parsed.gridStep != null) {
      gridStep.value = parsed.gridStep
    }

    selectedId.value = null
  }

  function resetCounters(): void {
    fieldCounters.value = {
      serial: 0,
      partNumber: 0,
      description: 0,
      manufacturer: 0,
      custom: 0
    }
  }

  // ===== Persistence =====
  // ===== Persistence (Neutralino native dialogs) =====

  // Сохранить в текущий файл (если уже сохраняли) или открыть диалог
  async function saveTemplate(): Promise<void> {
    if (lastSavedPath.value) {
      await _writeToPath(lastSavedPath.value)
    } else {
      await saveTemplateAs()
    }
  }

  // Всегда открывает диалог «Сохранить как»
  async function saveTemplateAs(): Promise<void> {
    try {
      const defaultPath = lastSavedPath.value || 'label-template.json'
      const path = await os.showSaveDialog('Сохранить шаблон', {
        defaultPath,
        filters: [{ name: 'JSON шаблон', extensions: ['json'] }]
      })
      if (!path) return
      await _writeToPath(path.endsWith('.json') ? path : path + '.json')
    } catch (error) {
      console.error('Error saving template:', error)
      alert('Ошибка при сохранении шаблона')
    }
  }

  async function _writeToPath(path: string): Promise<void> {
    const json = JSON.stringify(buildTemplateData(), null, 2)
    await filesystem.writeFile(path, json)
    lastSavedPath.value = path
    const name = path.split(/[\/]/).pop()
    alert(`Шаблон сохранён: ${name}`)
  }

  // Открыть шаблон через нативный диалог
  async function openTemplate(): Promise<void> {
    try {
      const defaultPath = lastSavedPath.value ? lastSavedPath.value.replace(/[^\/]+$/, '') : ''
      const entries = await os.showOpenDialog('Открыть шаблон', {
        ...(defaultPath ? { defaultPath } : {}),
        filters: [{ name: 'JSON шаблон', extensions: ['json'] }]
      })
      if (!entries?.length) return
      const path = entries[0]
      const text = await filesystem.readFile(path)
      await applyTemplateData(JSON.parse(text))
      lastSavedPath.value = path
      const name = path.split(/[\/]/).pop()
      alert(`Шаблон загружён: ${name}`)
    } catch (error) {
      console.error('Error opening template:', error)
      alert('Ошибка при открытии шаблона')
    }
  }

  function clearTemplate(): void {
    if (!confirm('Очистить все элементы?')) return
    layout.value = []
    elements.value = {}
    selectedId.value = null
    resetCounters()
  }

  // ===== Print =====

  // Собирает { items, common } из текущего состояния элементов редактора.
  // Контракт: ключи в common — полные dataField (description_1, partNumber_1 и т.д.),
  // серийник берётся из testValue штрихкода или текстового поля serial_*.
  function buildSinglePrintData(): { items: { serial: string }[]; common: Record<string, string> } {
    const common: Record<string, string> = {}
    let serial = ''

    for (const el of Object.values(elements.value)) {
      if (el.type === 'text') {
        common[el.dataField] = el.props.customText ?? getDefaultText(el.dataField)
        // Если это serial-текст — дублируем как serial для принтера
        if (el.dataField.startsWith('serial')) {
          serial = common[el.dataField]
        }
      } else if (el.type === 'barcode' && el.dataField.includes('serial')) {
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
      const templateData = buildTemplateData()
      await printer.printFromTemplate(items, common, templateData)
      return
    }

    // Групповая печать
    if (!serials.value.length) {
      alert('Нет серийных номеров для печати')
      return
    }

    const templateData = buildTemplateData()
    Object.values(templateData.elements).forEach((el: any) => {
      delete el.props.customText
      delete el.props.testValue
    })

    // common содержит все поля по dataField — принтер резолвит по dataField первым делом
    const common = { ...batchCommonData.value }
    const items = serials.value.map((s) => ({ serial: s }))

    await printer.printFromTemplate(items, common as any, templateData)
  }

  return {
    // State
    layout,
    elements,
    selectedId,
    labelSize,
    zoom,
    batchCommonData,
    batchSerialsText,
    batchPrintEnabled,
    templateTextFields,
    hasSerialInTemplate,

    // Computed
    gridCols,
    gridRows,
    gridStep,
    labelSizeInPx,
    realSizeInPx,
    gridConfig,
    serials,
    selectedElement,

    // Actions
    addElement,
    removeElement,
    onItemResized,
    onItemMoved,
    updateBarcode,
    validateSize,
    getDisplayText,
    getFieldDisplayName,
    lastSavedPath,
    saveTemplate,
    saveTemplateAs,
    openTemplate,
    clearTemplate,
    printLabels
  }
})
