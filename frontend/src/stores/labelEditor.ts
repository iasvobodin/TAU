import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import bwipjs from 'bwip-js'
import { os, filesystem } from '@neutralinojs/lib'
import { LabelPrinterMulty } from '@/assets/printLabelMultyСopy'
import { fontManager } from '@/assets/fontManager'
import type { FontInfo } from '@/assets/renderToSVG'
import type {
  ElementType,
  ElementPosition,
  DataField,
  FieldCounters,
  LabelElement,
  LabelSize,
  TemplateData
} from '@/types/label'

const MM_TO_PX = 3.78

export const useLabelEditorStore = defineStore('labelEditor', () => {
  // ===== State =====
  const positions = ref<Record<string, ElementPosition>>({})
  const elements = ref<Record<string, LabelElement>>({})
  const selectedId = ref<string | null>(null)
  const labelSize = ref<LabelSize>({ width: 100, height: 60, unit: 'mm' })
  const zoom = ref<number>(1)
  // gridStep — UI-предпочтение, не сохраняется в шаблон
  const gridStep = ref<number>(1)

  const fieldCounters = ref<FieldCounters>({
    serial: 0,
    partNumber: 0,
    description: 0,
    manufacturer: 0,
    custom: 0
  })

  const batchCommonData = ref<Record<string, string>>({})
  const batchSerialsText = ref('261200001-01\n261200002-01\n261200003-01')
  const batchPrintEnabled = ref(false)
  const svgRenderEnabled = ref(false)
  const lastSavedPath = ref<string>('')

  const availableFonts = ref<FontInfo[]>([{ label: 'Arial', value: 'Arial', svgPreviewPath: '' }])
  const fontsLoading = ref(true)

  // ── Инициализация fontManager ─────────────────────────────────────────────
  // init() — быстро, читает кэш с диска → шрифты сразу доступны
  // scan() — медленно, обходит систему → запускаем в фоне
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

    // Фоновое сканирование: добавляет новые шрифты и обновляет список
    fontManager.scan().then(() => {
      const all = fontManager.getSupportedFonts()
      if (all.length) {
        availableFonts.value = all.map((e) => ({
          label: e.fullName,
          value: e.fullName,
          svgPreviewPath: e.svgPreviewPath
        }))
      }
    })
  })()

  // ===== Computed =====

  const labelSizeMM = computed(() => {
    if (labelSize.value.unit === 'mm') {
      return { width: labelSize.value.width, height: labelSize.value.height }
    }
    return {
      width: labelSize.value.width / MM_TO_PX,
      height: labelSize.value.height / MM_TO_PX
    }
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

  const hasSerialInTemplate = computed(() =>
    Object.values(elements.value).some((el) => el.dataField.startsWith('serial'))
  )

  const serials = computed(() =>
    batchSerialsText.value
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  )

  // Синхронизация полей формы групповой печати с шаблоном
  watch(
    templateTextFields,
    (fields) => {
      const currentKeys = new Set(fields.map((f) => f.dataField))
      for (const key of Object.keys(batchCommonData.value)) {
        if (!currentKeys.has(key)) delete batchCommonData.value[key]
      }
      for (const { dataField } of fields) {
        if (!(dataField in batchCommonData.value)) {
          batchCommonData.value[dataField] = ''
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
    switch (field?.split('_')[0]) {
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
    if (element.props.customText != null) return element.props.customText as string
    return getDefaultText(element.dataField)
  }

  function getFieldDisplayName(dataField: string): string {
    const [base, index] = dataField.split('_')
    const names: Record<string, string> = {
      serial: 'Serial',
      partNumber: 'Part Number',
      description: 'Description',
      manufacturer: 'Manufacturer',
      custom: 'Custom'
    }
    return `${names[base] ?? base} ${index}`
  }

  function generateFieldName(baseField: keyof FieldCounters): DataField {
    fieldCounters.value[baseField]++
    return `${baseField}_${fieldCounters.value[baseField]}`
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
    positions.value[id] = clampToLabel(pos)
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

  // ===== Element management =====
  function addElement(type: ElementType, baseField?: string): void {
    const id = uid()

    const dataField: DataField =
      type === 'barcode'
        ? `${baseField ?? 'serial'}_barcode`
        : generateFieldName((baseField ?? 'custom') as keyof FieldCounters)

    const { width, height } = labelSizeMM.value
    const defaultPos: ElementPosition = clampToLabel({
      x: 0,
      y: 0,
      w: Math.round(width / 3),
      h: Math.round(height / (type === 'barcode' ? 4 : 6))
    })
    positions.value[id] = defaultPos

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
          verticalAlign: 'middle',
          bold: false,
          fontFamily: 'Arial',
          lineHeight: 1.2,
          paddingX: 4,
          paddingY: 0,
          customText: getDefaultText(baseField)
        }),
        ...(type === 'barcode' && {
          barcodeType: 'code128',
          barcodeHeight: 6,
          barcodeWidth: 6,
          barcodeScale: 10,
          testValue: 'TEST123456'
        }),
        ...(type === 'image' && { src: '', imageWidth: 100, imageHeight: 'auto' })
      }
    }

    if (type === 'barcode') generateBarcode(elements.value[id])
    selectedId.value = id
  }

  function removeElement(id: string): void {
    delete positions.value[id]
    delete elements.value[id]
    if (selectedId.value === id) selectedId.value = null
  }

  // ===== Label size =====
  function validateSize(): void {
    if (labelSize.value.width < 10) labelSize.value.width = 10
    if (labelSize.value.height < 10) labelSize.value.height = 10
    if (labelSize.value.width > 500) labelSize.value.width = 500
    if (labelSize.value.height > 500) labelSize.value.height = 500
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
                fontSize: el.props.fontSize,
                bold: el.props.bold,
                align: el.props.align,
                verticalAlign: el.props.verticalAlign,
                fontFamily: el.props.fontFamily,
                lineHeight: el.props.lineHeight,
                paddingX: el.props.paddingX,
                paddingY: el.props.paddingY
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
      labelSize: labelSize.value
    }
  }

  async function applyTemplateData(parsed: any): Promise<void> {
    if (parsed.labelSize) labelSize.value = parsed.labelSize

    if (parsed.positions) {
      positions.value = parsed.positions
    } else if (parsed.layout) {
      // Миграция старого формата: grid-ячейки → мм
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
          ...(el.type === 'text' && { customText: getDefaultText(el.dataField) }),
          ...(el.type === 'barcode' && { testValue: 'TEST123456', customText: null })
        }
      }
      if (el.type === 'barcode') await generateBarcode(elements.value[id])
    }

    selectedId.value = null
  }

  function resetCounters(): void {
    fieldCounters.value = { serial: 0, partNumber: 0, description: 0, manufacturer: 0, custom: 0 }
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

  // ===== Print =====
  function buildSinglePrintData(): { items: { serial: string }[]; common: Record<string, string> } {
    const common: Record<string, string> = {}
    let serial = ''
    for (const el of Object.values(elements.value)) {
      if (el.type === 'text') {
        common[el.dataField] = el.props.customText ?? getDefaultText(el.dataField)
        if (el.dataField.startsWith('serial')) serial = common[el.dataField]
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
      const td = buildTemplateData()
      if (svgRenderEnabled.value) await printer.printFromTemplateSVG(items, common, td)
      else await printer.printFromTemplate(items, common, td)
      return
    }

    if (!serials.value.length) {
      alert('Нет серийных номеров для печати')
      return
    }

    const templateData = buildTemplateData()
    Object.values(templateData.elements).forEach((el: any) => {
      delete el.props.customText
      delete el.props.testValue
    })

    const printFn = svgRenderEnabled.value
      ? printer.printFromTemplateSVG.bind(printer)
      : printer.printFromTemplate.bind(printer)
    await printFn(
      serials.value.map((s) => ({ serial: s })),
      { ...batchCommonData.value } as any,
      templateData
    )
  }

  return {
    // State
    positions,
    elements,
    selectedId,
    labelSize,
    zoom,
    gridStep,
    batchCommonData,
    batchSerialsText,
    batchPrintEnabled,
    svgRenderEnabled,
    lastSavedPath,
    availableFonts,
    fontsLoading,

    // Computed
    labelSizeMM,
    labelSizeInPx,
    realSizeInPx,
    selectedElement,
    templateTextFields,
    hasSerialInTemplate,
    serials,

    // Actions — position
    updatePosition,

    // Actions — elements
    addElement,
    removeElement,
    updateBarcode,

    // Actions — editor
    validateSize,
    getDisplayText,
    getFieldDisplayName,

    // Actions — template
    saveTemplate,
    saveTemplateAs,
    openTemplate,
    clearTemplate,

    // Actions — print
    printLabels
  }
})
