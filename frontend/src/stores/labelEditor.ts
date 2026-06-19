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
  LabelSize,
  TemplateData,
  BatchItem
} from '@/types/label'

const MM_TO_PX = 3.78

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

    // Тексты без linkedBarcodeId
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
        if (!(dataField in batchCommonData.value)) batchCommonData.value[dataField] = ''
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
          fontSize: baseFontSize,
          align: 'left',
          verticalAlign: 'middle',
          bold: false,
          fontFamily: 'Arial',
          lineHeight: 1.2,
          // Отступы в мм (все 4 стороны)
          paddingTop: 0,
          paddingRight: 1.0,
          paddingBottom: 0,
          paddingLeft: 1.0,
          customText: dataField
        }),
        ...(type === 'barcode' && {
          barcodeType: 'code128',
          barcodeHeight: 6,
          barcodeWidth: 6,
          barcodeScale: 2,
          isSerial: false,
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
                // Новые 4-сторонние отступы в мм
                paddingTop: el.props.paddingTop,
                paddingRight: el.props.paddingRight,
                paddingBottom: el.props.paddingBottom,
                paddingLeft: el.props.paddingLeft,
                linkedBarcodeId: el.props.linkedBarcodeId
              }),
              ...(el.type === 'barcode' && {
                barcodeType: el.props.barcodeType,
                barcodeHeight: el.props.barcodeHeight,
                barcodeWidth: el.props.barcodeWidth,
                barcodeScale: el.props.barcodeScale,
                isSerial: el.props.isSerial
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

    // Шаг 5: нормализация отсутствующих полей у текстовых элементов
    for (const el of Object.values(elements.value)) {
      if (el.type === 'text') {
        const p = el.props
        if (p.verticalAlign == null) p.verticalAlign = 'middle'
        if (p.lineHeight == null) p.lineHeight = 1.2
        if (p.paddingTop == null) p.paddingTop = 0
        if (p.paddingRight == null) p.paddingRight = 0
        if (p.paddingBottom == null) p.paddingBottom = 0
        if (p.paddingLeft == null) p.paddingLeft = 0
        // Удаляем isSerial из текста — он теперь только на barcode
        if ('isSerial' in p) delete (p as any).isSerial
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

  // ===== Print =====
  function buildSinglePrintData(): { items: { serial: string }[]; common: Record<string, string> } {
    const common: Record<string, string> = {}
    let serial = ''
    for (const el of Object.values(elements.value)) {
      if (el.type === 'text' && !el.props.linkedBarcodeId) {
        const val = el.props.customText ?? getDefaultText(el.dataField)
        common[el.dataField] = val
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
      if (svgRenderEnabled.value) await printer.printFromTemplateSVG(items, common, td)
      else await printer.printFromTemplate(items, common, td)
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
        const svg = await renderLabelToSVG(td, common, items[0]?.serial ?? '')
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
        const svg = await renderLabelToSVG(td, itemData, items[i].serial ?? '')

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

    // Копируем текстовые props (кроме isSerial, dataField, customText)
    const propsToCopy: Array<keyof typeof src.props> = [
      'fontSize',
      'fontFamily',
      'bold',
      'align',
      'verticalAlign',
      'lineHeight',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft'
    ]
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
    removeElement,
    updateBarcode,
    toggleBarcodeIterable,
    renameField,
    splitDataField,
    // Actions — editor
    validateSize,
    getDisplayText,
    // Actions — template
    saveTemplate,
    saveTemplateAs,
    openTemplate,
    clearTemplate,
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
