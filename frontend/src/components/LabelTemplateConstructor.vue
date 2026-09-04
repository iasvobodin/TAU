<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
// @ts-ignore - FontFaceSet.add существует в браузерах
import { GridLayout as GridLayoutComponent, GridItem } from 'vue3-grid-layout'
import bwipjs from 'bwip-js'
import { storage } from '@neutralinojs/lib'
import { LabelPrinterMulty } from '@/assets/printLabelMultyСopy'
import { MM_TO_PX } from '@/assets/textLayout'
// ===== Types =====
type ElementType = 'text' | 'barcode' | 'image'
type BarcodeType = 'code128' | 'datamatrix'
type DataField = 'serial' | 'partNumber' | 'description' | 'manufacturer' | 'custom'

interface LayoutItem {
  x: number
  y: number
  w: number
  h: number
  i: string
}

interface LabelElement {
  id: string
  type: ElementType
  dataField: DataField // Уникальный идентификатор поля
  props: {
    // Для текста
    fontSize?: number
    bold?: boolean
    align?: 'left' | 'center' | 'right'
    fontFamily?: string

    // Для штрихкода
    barcodeType?: BarcodeType
    barcodeHeight?: number
    barcodeWidth?: number // Только для DataMatrix
    barcodeScale?: number // Для Code128
    testValue?: string // Тестовое значение для проверки

    // Для изображения
    src?: string
    imageWidth?: number
    imageHeight?: string

    // Общие
    customText?: string // Только для визуального отображения в редакторе
  }
}

interface LabelSize {
  width: number
  height: number
  unit: Unit
}

type Unit = 'mm' | 'px'

// ===== State =====
const layout = ref<LayoutItem[]>([])
const elements = ref<Record<string, LabelElement>>({})
const selectedId = ref<string | null>(null)
const editingTextId = ref<string | null>(null)
const editingTextValue = ref('')
const labelSize = ref<LabelSize>({
  width: 100,
  height: 60,
  unit: 'mm'
})
const zoom = ref<number>(1)

// Счетчики для генерации уникальных идентификаторов полей
const fieldCounters = ref({
  serial: 0,
  partNumber: 0,
  description: 0,
  manufacturer: 0,
  custom: 0
})

// Константы для конвертации (единый MM_TO_PX — импорт из textLayout.ts)

// ===== Computed =====
const labelSizeInPx = computed(() => {
  let widthInPx, heightInPx
  if (labelSize.value.unit === 'mm') {
    widthInPx = labelSize.value.width * MM_TO_PX
    heightInPx = labelSize.value.height * MM_TO_PX
  } else {
    widthInPx = labelSize.value.width
    heightInPx = labelSize.value.height
  }
  return {
    width: widthInPx * zoom.value,
    height: heightInPx * zoom.value
  }
})

const realSizeInPx = computed(() => {
  if (labelSize.value.unit === 'mm') {
    return {
      width: labelSize.value.width * MM_TO_PX,
      height: labelSize.value.height * MM_TO_PX
    }
  }
  return {
    width: labelSize.value.width,
    height: labelSize.value.height
  }
})

const gridConfig = computed(() => ({
  rowHeight: labelSizeInPx.value.height / 12,
  colWidth: labelSizeInPx.value.width / 12
}))

// ===== Barcode Generation (только для визуализации) =====
async function generateBarcode(element: LabelElement) {
  if (element.type !== 'barcode') return

  const barcodeType = element.props.barcodeType || 'code128'
  const barcodeValue = element.props.testValue || 'TEST123456'

  try {
    let canvas = document.createElement('canvas')

    if (barcodeType === 'datamatrix') {
      const scale = element.props.barcodeScale || 2
      const size = Math.min(element.props.barcodeWidth || 100, element.props.barcodeHeight || 100)
      canvas = await bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix',
        text: barcodeValue,
        scale: scale,
        height: 6,
        width: 6
      })
    } else {
      const scale = element.props.barcodeScale || 2
      canvas = await bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: barcodeValue,
        scale: scale,
        height: element.props.barcodeHeight || 6
        // includetext: true,
        // textxalign: 'center'
      })
    }

    element.props.customText = canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error generating barcode:', error)
    element.props.customText = ''
  }
}

// Генерация уникального имени поля
function generateFieldName(baseField: DataField): string {
  fieldCounters.value[baseField]++
  const counter = fieldCounters.value[baseField]
  return `${baseField}_${counter}`
}

// ===== Helpers =====
function uid() {
  return Math.random().toString(36).substring(2, 9)
}

function addElement(type: ElementType, baseField?: DataField) {
  const id = uid()
  const defaultWidth = 4
  const defaultHeight = type === 'barcode' ? 4 : 2

  // Генерируем уникальное имя поля
  let dataField: DataField
  if (type === 'barcode') {
    // Для штрихкода используем поле с суффиксом _barcode
    const fieldName = baseField || 'serial'
    dataField = `${fieldName}_barcode` as DataField
  } else {
    dataField = generateFieldName(baseField || 'custom') as DataField
  }

  layout.value.push({
    x: 0,
    y: 0,
    w: defaultWidth,
    h: defaultHeight,
    i: id
  })

  const baseFontSize = Math.max(8, Math.min(72, Math.round(12 * (realSizeInPx.value.height / 600))))

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

function getDefaultText(field?: DataField): string {
  switch (field) {
    case 'serial':
      return 'SN:12345678-01'
    case 'partNumber':
      return 'PN:AB123456'
    case 'description':
      return 'Описание продукта'
    case 'manufacturer':
      return 'Производитель'
    default:
      return 'Текст'
  }
}

function removeElement(id: string) {
  layout.value = layout.value.filter((l) => l.i !== id)
  delete elements.value[id]
  if (selectedId.value === id) selectedId.value = null
  if (editingTextId.value === id) editingTextId.value = null
}

function updateZoom(value: number) {
  zoom.value = value
}

// Редактирование текста (только для визуализации)
function startEditText(id: string, currentText: string) {
  editingTextId.value = id
  editingTextValue.value = currentText
  nextTick(() => {
    const input = document.querySelector(`.text-editor-input-${id}`) as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishEditText() {
  if (editingTextId.value && elements.value[editingTextId.value]) {
    elements.value[editingTextId.value].props.customText = editingTextValue.value
  }
  editingTextId.value = null
  editingTextValue.value = ''
}

function handleTextKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    finishEditText()
  } else if (e.key === 'Escape') {
    editingTextId.value = null
    editingTextValue.value = ''
  }
}

async function updateBarcode(elementId: string) {
  const element = elements.value[elementId]
  if (element && element.type === 'barcode') {
    await generateBarcode(element)
  }
}

// Сохранение шаблона
async function saveTemplate() {
  const templateData = {
    layout: layout.value,
    elements: Object.fromEntries(
      Object.entries(elements.value).map(([id, element]) => [
        id,
        {
          id: element.id,
          type: element.type,
          dataField: element.dataField,
          props: {
            ...(element.type === 'text' && {
              fontSize: element.props.fontSize,
              bold: element.props.bold,
              align: element.props.align,
              fontFamily: element.props.fontFamily
            }),
            ...(element.type === 'barcode' && {
              barcodeType: element.props.barcodeType,
              barcodeHeight: element.props.barcodeHeight,
              barcodeWidth: element.props.barcodeWidth,
              barcodeScale: element.props.barcodeScale
            }),
            ...(element.type === 'image' && {
              src: element.props.src,
              imageWidth: element.props.imageWidth,
              imageHeight: element.props.imageHeight
            })
          }
        }
      ])
    ),
    labelSize: labelSize.value
  }

  try {
    // @ts-ignore
    if (storage) {
      await storage.setData('label-template', JSON.stringify(templateData))
      alert('Шаблон сохранен!')
    } else {
      localStorage.setItem('label-template', JSON.stringify(templateData))
      alert('Шаблон сохранен в localStorage')
    }
  } catch (error) {
    console.error('Error saving template:', error)
    alert('Ошибка при сохранении шаблона')
  }
}

async function loadTemplate() {
  try {
    let data: string | null = null

    // @ts-ignore
    if (storage) {
      data = await storage.getData('label-template')
    } else {
      data = localStorage.getItem('label-template')
    }

    if (!data) {
      alert('Нет сохраненного шаблона')
      return
    }

    const parsed = JSON.parse(data)

    layout.value = (parsed.layout || []).map((l: any) => ({
      x: l.x ?? 0,
      y: l.y ?? 0,
      w: l.w ?? 4,
      h: l.h ?? 2,
      i: l.i
    }))

    elements.value = {}
    for (const [id, elementData] of Object.entries(parsed.elements || {})) {
      const element = elementData as any
      elements.value[id] = {
        id: element.id,
        type: element.type,
        dataField: element.dataField,
        props: {
          ...element.props,
          ...(element.type === 'text' && {
            customText: getDefaultText(element.dataField?.split('_')[0] as DataField)
          }),
          ...(element.type === 'barcode' && {
            testValue: 'TEST123456',
            customText: null
          })
        }
      }

      if (element.type === 'barcode') {
        await generateBarcode(elements.value[id])
      }
    }

    if (parsed.labelSize) {
      labelSize.value = parsed.labelSize
    }

    selectedId.value = null
    alert('Шаблон загружен!')
  } catch (error) {
    console.error('Error loading template:', error)
    alert('Ошибка при загрузке шаблона')
  }
}

async function clearTemplate() {
  if (confirm('Очистить все элементы?')) {
    layout.value = []
    elements.value = {}
    selectedId.value = null
    editingTextId.value = null
    // Сбрасываем счетчики
    fieldCounters.value = {
      serial: 0,
      partNumber: 0,
      description: 0,
      manufacturer: 0,
      custom: 0
    }
  }
}

function validateSize() {
  if (labelSize.value.width < 10) labelSize.value.width = 10
  if (labelSize.value.height < 10) labelSize.value.height = 10
  if (labelSize.value.width > 500) labelSize.value.width = 500
  if (labelSize.value.height > 500) labelSize.value.height = 500
}

const selectedElement = () => (selectedId.value ? elements.value[selectedId.value] : null)

function getDisplayText(element: LabelElement): string {
  if (element.props.customText !== undefined) {
    return element.props.customText
  }
  return getDefaultText(element.dataField?.split('_')[0] as DataField)
}

function getFieldDisplayName(dataField: string): string {
  const parts = dataField.split('_')
  const baseField = parts[0]
  const index = parts[1]

  switch (baseField) {
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
const temp = {
  layout: [
    { x: 0, y: 0, w: 12, h: 3, i: 'bbumayt', moved: false },
    { x: 0, y: 8, w: 12, h: 3, i: 'lduoq9f', moved: false },
    { x: 0, y: 3, w: 12, h: 5, i: 'mg2cw2n', moved: false }
  ],
  elements: {
    bbumayt: {
      id: 'bbumayt',
      type: 'barcode',
      dataField: 'serial_barcode',
      props: { barcodeType: 'code128', barcodeHeight: 6, barcodeWidth: 6, barcodeScale: 10 }
    },
    lduoq9f: {
      id: 'lduoq9f',
      type: 'text',
      dataField: 'description_1',
      props: { fontSize: 33, bold: false, align: 'left', fontFamily: 'Arial' }
    },
    mg2cw2n: {
      id: 'mg2cw2n',
      type: 'text',
      dataField: 'partNumber_1',
      props: { fontSize: 55, bold: false, align: 'left', fontFamily: 'Arial' }
    }
  },
  labelSize: { width: 100, height: 60, unit: 'mm' }
}

// Данные для печати (временные, потом можно сделать форму)
const printData = ref({
  partNumber: 'AB80307A',
  description:
    'Электронная плата 2 для модуля 8-канального дискретного ввода, 24В, "Сухой контакт"',
  manufacturer: 'Производитель',
  serialsText: '261200001-01\n261200002-01\n261200003-01'
})

const serials = computed(() =>
  printData.value.serialsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length)
)

// Функция печати
async function printLabels() {
  if (!serials.value.length) {
    alert('Нет серийных номеров для печати')
    return
  }

  // Собираем текущий шаблон
  const templateData = {
    layout: layout.value,
    elements: Object.fromEntries(
      Object.entries(elements.value).map(([id, element]) => [
        id,
        {
          id: element.id,
          type: element.type,
          dataField: element.dataField,
          props: { ...element.props }
        }
      ])
    ),
    labelSize: labelSize.value
  }

  // Убираем визуальные данные перед отправкой
  Object.values(templateData.elements).forEach((element: any) => {
    delete element.props.customText
    delete element.props.testValue
  })

  const printer = new LabelPrinterMulty(window.NL_PATH || '')

  const items = serials.value.map((s) => ({ serial: s }))
  const common = {
    partNumber: printData.value.partNumber,
    description: printData.value.description,
    manufacturer: printData.value.manufacturer
  }
  // @ts-ignore - FontFaceSet.add существует в браузерах
  await printer.printFromTemplate(items, common, templateData)
}

// Функция для экспорта шаблона в JSON
function exportTemplate() {
  const templateData = {
    layout: layout.value,
    elements: Object.fromEntries(
      Object.entries(elements.value).map(([id, element]) => [
        id,
        {
          id: element.id,
          type: element.type,
          dataField: element.dataField,
          props: {
            ...(element.type === 'text' && {
              fontSize: element.props.fontSize,
              bold: element.props.bold,
              align: element.props.align,
              fontFamily: element.props.fontFamily
            }),
            ...(element.type === 'barcode' && {
              barcodeType: element.props.barcodeType,
              barcodeHeight: element.props.barcodeHeight,
              barcodeWidth: element.props.barcodeWidth,
              barcodeScale: element.props.barcodeScale
            }),
            ...(element.type === 'image' && {
              src: element.props.src,
              imageWidth: element.props.imageWidth,
              imageHeight: element.props.imageHeight
            })
          }
        }
      ])
    ),
    labelSize: labelSize.value
  }

  const json = JSON.stringify(templateData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'label-template.json'
  a.click()
  URL.revokeObjectURL(url)
}

// Функция для импорта шаблона из JSON
function importTemplate() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    const text = await file.text()
    const parsed = JSON.parse(text)

    layout.value = parsed.layout || []
    elements.value = {}

    for (const [id, elementData] of Object.entries(parsed.elements || {})) {
      const element = elementData as any
      elements.value[id] = {
        id: element.id,
        type: element.type,
        dataField: element.dataField,
        props: {
          ...element.props,
          ...(element.type === 'text' && {
            customText: getDefaultText(element.dataField?.split('_')[0] as DataField)
          }),
          ...(element.type === 'barcode' && {
            testValue: 'TEST123456',
            customText: null
          })
        }
      }

      if (element.type === 'barcode') {
        await generateBarcode(elements.value[id])
      }
    }

    if (parsed.labelSize) {
      labelSize.value = parsed.labelSize
    }

    alert('Шаблон импортирован!')
  }
  input.click()
}
</script>

<template>
  <div
    style="
      height: fit-content;
      display: flex;
      flex-direction: column;
      padding: 16px;
      background: #f5f5f5;
    "
  >
    <!-- TOP PANEL -->
    <div
      style="
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow-y: auto;
        max-height: 60%;
      "
    >
      <!-- Размер этикетки -->
      <div style="margin-bottom: 16px">
        <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
          Размер этикетки
        </h3>
        <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap">
          <div style="display: flex; gap: 8px; align-items: center">
            <div>
              <div style="font-size: 12px; margin-bottom: 4px">Ширина</div>
              <v-text-field
                v-model.number="labelSize.width"
                type="number"
                density="compact"
                style="width: 100px"
                hide-details
                @update:model-value="validateSize"
              />
            </div>
            <div>
              <div style="font-size: 12px; margin-bottom: 4px">Высота</div>
              <v-text-field
                v-model.number="labelSize.height"
                type="number"
                density="compact"
                style="width: 100px"
                hide-details
                @update:model-value="validateSize"
              />
            </div>
            <div>
              <div style="font-size: 12px; margin-bottom: 4px">Единицы</div>
              <v-select
                v-model="labelSize.unit"
                :items="['mm', 'px']"
                density="compact"
                style="width: 80px"
                hide-details
              />
            </div>
          </div>
          <div style="font-size: 12px; color: #666">
            Реальный размер: {{ realSizeInPx.width.toFixed(0) }} ×
            {{ realSizeInPx.height.toFixed(0) }} px
          </div>

          <!-- Масштаб -->
          <div style="margin: 16px 0; width: 50%">
            <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
              Масштаб отображения
            </h3>
            <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap">
              <div style="display: flex; gap: 8px; align-items: center; flex: 1; max-width: 400px">
                <span style="font-size: 12px">🔍</span>
                <v-slider
                  v-model="zoom"
                  :min="0.5"
                  :max="9"
                  :step="0.1"
                  density="compact"
                  hide-details
                  style="flex: 1"
                  @update:model-value="updateZoom"
                />
                <span style="font-size: 12px; min-width: 60px">{{ Math.round(zoom * 100) }}%</span>
              </div>
              <div style="font-size: 12px; color: #666">
                Отображение: {{ labelSizeInPx.width.toFixed(0) }} ×
                {{ labelSizeInPx.height.toFixed(0) }} px
              </div>
            </div>
          </div>
        </div>
      </div>

      <v-divider />

      <!-- Добавление элементов -->
      <div style="margin: 16px 0">
        <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
          Добавить элемент
        </h3>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <v-btn
            size="small"
            color="primary"
            variant="outlined"
            @click="addElement('text', 'serial')"
            >+ Serial</v-btn
          >
          <v-btn
            size="small"
            color="primary"
            variant="outlined"
            @click="addElement('text', 'partNumber')"
            >+ Part Number</v-btn
          >
          <v-btn
            size="small"
            color="primary"
            variant="outlined"
            @click="addElement('text', 'description')"
            >+ Description</v-btn
          >
          <v-btn
            size="small"
            color="primary"
            variant="outlined"
            @click="addElement('text', 'manufacturer')"
            >+ Manufacturer</v-btn
          >
          <v-btn
            size="small"
            color="warning"
            variant="outlined"
            @click="addElement('barcode', 'serial')"
            >+ Barcode (Serial)</v-btn
          >
          <!-- <v-btn
            size="small"
            color="warning"
            variant="outlined"
            @click="addElement('barcode', 'partNumber')"
            >+ Barcode (Part)</v-btn
          > -->
          <v-btn size="small" color="success" variant="outlined" @click="addElement('image')"
            >+ Image</v-btn
          >
        </div>
      </div>

      <v-divider />

      <!-- Настройки выбранного элемента -->
      <div v-if="selectedElement()" style="margin-top: 16px">
        <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
          Настройки:
          {{
            selectedElement()?.type === 'text'
              ? 'Текст'
              : selectedElement()?.type === 'barcode'
                ? 'Штрихкод'
                : 'Изображение'
          }}
          <span style="font-size: 12px; color: #999; margin-left: 8px">
            (ID: {{ selectedElement()?.dataField }})
          </span>
        </h3>
        <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center">
          <!-- Текст -->
          <template v-if="selectedElement()?.type === 'text'">
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Размер шрифта:</span>
              <v-text-field
                v-model.number="selectedElement()!.props.fontSize"
                type="number"
                density="compact"
                style="width: 80px"
                hide-details
              />
              <span style="font-size: 11px; color: #666">px</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Выравнивание:</span>
              <v-select
                v-model="selectedElement()!.props.align"
                :items="['left', 'center', 'right']"
                density="compact"
                style="width: 100px"
                hide-details
              />
            </div>
            <v-checkbox
              v-model="selectedElement()!.props.bold"
              label="Жирный"
              density="compact"
              hide-details
            />
          </template>

          <!-- Штрихкод -->
          <template v-if="selectedElement()?.type === 'barcode'">
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Тип:</span>
              <v-select
                v-model="selectedElement()!.props.barcodeType"
                :items="['code128', 'datamatrix']"
                density="compact"
                style="width: 120px"
                hide-details
                @update:model-value="updateBarcode(selectedId!)"
              />
            </div>

            <!-- Настройки для Code128 -->
            <template v-if="selectedElement()?.props.barcodeType === 'code128'">
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="font-size: 12px">Высота (px):</span>
                <v-text-field
                  v-model.number="selectedElement()!.props.barcodeHeight"
                  type="number"
                  density="compact"
                  style="width: 80px"
                  hide-details
                  @update:model-value="updateBarcode(selectedId!)"
                />
              </div>
              <!-- <div style="display: flex; align-items: center; gap: 8px">
                <span style="font-size: 12px">Масштаб:</span>
                <v-text-field
                  v-model.number="selectedElement()!.props.barcodeScale"
                  type="number"
                  step="1"
                  density="compact"
                  style="width: 80px"
                  hide-details
                  @update:model-value="updateBarcode(selectedId!)"
                />
              </div> -->
            </template>

            <!-- Настройки для DataMatrix -->
            <template v-if="selectedElement()?.props.barcodeType === 'datamatrix'">
              <!-- <div style="display: flex; align-items: center; gap: 8px">
                <span style="font-size: 12px">Размер (px):</span>
                <v-text-field
                  v-model.number="selectedElement()!.props.barcodeWidth"
                  type="number"
                  density="compact"
                  style="width: 80px"
                  hide-details
                  @update:model-value="updateBarcode(selectedId!)"
                />
              </div> -->
              <div style="display: flex; align-items: center; gap: 8px">
                <span style="font-size: 12px">Масштаб:</span>
                <v-text-field
                  v-model.number="selectedElement()!.props.barcodeScale"
                  type="number"
                  step="1"
                  density="compact"
                  style="width: 80px"
                  hide-details
                  @update:model-value="updateBarcode(selectedId!)"
                />
              </div>
            </template>

            <!-- Тестовое значение для проверки -->
            <div style="display: flex; align-items: center; gap: 8px; flex: 1">
              <span style="font-size: 12px">Тестовое значение:</span>
              <v-text-field
                v-model="selectedElement()!.props.testValue"
                placeholder="Значение для проверки"
                density="compact"
                style="flex: 1"
                hide-details
                @update:model-value="updateBarcode(selectedId!)"
              />
            </div>
          </template>

          <!-- Изображение -->
          <template v-if="selectedElement()?.type === 'image'">
            <div style="display: flex; align-items: center; gap: 8px; flex: 1">
              <span style="font-size: 12px">URL изображения:</span>
              <v-text-field
                v-model="selectedElement()!.props.src"
                placeholder="https://example.com/image.png"
                density="compact"
                style="flex: 1"
                hide-details
              />
            </div>
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Ширина (px):</span>
              <v-text-field
                v-model.number="selectedElement()!.props.imageWidth"
                type="number"
                density="compact"
                style="width: 80px"
                hide-details
              />
            </div>
          </template>
        </div>
      </div>

      <div v-else style="margin-top: 16px; color: #999; font-size: 12px; text-align: center">
        Нажмите на элемент, чтобы настроить его свойства
      </div>

      <v-divider class="my-2" />

      <!-- Действия -->
      <div style="display: flex; gap: 8px; justify-content: flex-end">
        <v-btn size="small" color="error" variant="text" @click="clearTemplate">Очистить всё</v-btn>
        <v-btn size="small" color="primary" variant="outlined" @click="loadTemplate"
          >Загрузить</v-btn
        >
        <v-btn size="small" color="primary" @click="saveTemplate">Сохранить шаблон</v-btn>
      </div>
    </div>

    <!-- CANVAS -->
    <div
      class="canvas-container"
      style="
        flex: 1;
        background: #e0e0e0;
        border-radius: 8px;
        /* overflow: auto; */
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px',
      "
    >
      <div
        class="label-canvas"
        :style="{
          width: labelSizeInPx.width + 'px',
          height: labelSizeInPx.height + 'px',
          backgroundColor: '#fff',
          border: '1px solid #c0c0c0',
          borderRadius: '4px',
          position: 'relative',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'all 0.2s ease'
        }"
      >
        <GridLayoutComponent
          v-model:layout="layout"
          :col-num="12"
          :row-height="gridConfig.rowHeight"
          :is-draggable="true"
          :is-resizable="true"
          :vertical-compact="false"
          :use-css-transforms="false"
          :margin="[1, 1]"
          style="height: 100%; width: 100%"
        >
          <GridItem
            v-for="item in layout"
            :key="item.i"
            v-bind="item"
            @click.stop="selectedId = item.i"
          >
            <div
              class="grid-item"
              :class="{ 'grid-item-selected': selectedId === item.i }"
              @dblclick="removeElement(item.i)"
            >
              <!-- TEXT -->
              <div
                v-if="elements[item.i]?.type === 'text'"
                class="element-content"
                :style="{
                  fontSize: elements[item.i]?.props.fontSize + 'px',
                  fontWeight: elements[item.i]?.props.bold ? 'bold' : 'normal',
                  textAlign: elements[item.i]?.props.align
                }"
                @click.stop
              >
                <div v-if="editingTextId === item.i" class="text-editor-wrapper" @click.stop>
                  <input
                    :class="`text-editor-input-${item.i}`"
                    v-model="editingTextValue"
                    type="text"
                    style="
                      width: 100%;
                      padding: 4px;
                      font-size: inherit;
                      font-weight: inherit;
                      text-align: inherit;
                      border: 1px solid #1976d2;
                      outline: none;
                      background: white;
                    "
                    @blur="finishEditText"
                    @keydown="handleTextKeydown"
                  />
                </div>
                <div
                  v-else
                  class="editable-text"
                  @click.stop="startEditText(item.i, getDisplayText(elements[item.i]!))"
                >
                  <div>
                    <div>{{ getDisplayText(elements[item.i]!) }}</div>
                  </div>
                </div>
              </div>

              <!-- BARCODE -->
              <div v-else-if="elements[item.i]?.type === 'barcode'" class="element-content">
                <div style="text-align: center">
                  <img
                    v-if="elements[item.i]?.props.customText"
                    :src="elements[item.i]?.props.customText"
                    style="max-width: 100%; max-height: 100%; object-fit: contain"
                    alt="barcode"
                  />
                </div>
              </div>

              <!-- IMAGE -->
              <div v-else-if="elements[item.i]?.type === 'image'" class="element-content">
                <div
                  v-if="elements[item.i]?.props.src"
                  style="
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                  "
                >
                  <img
                    :src="elements[item.i]?.props.src"
                    style="max-width: 100%; max-height: 100%; object-fit: contain"
                    alt="image"
                  />
                </div>
                <div v-else style="color: #999; text-align: center">🖼️<br />Изображение</div>
              </div>
            </div>
          </GridItem>
        </GridLayoutComponent>

        <div class="size-info">
          {{ labelSize.width }} × {{ labelSize.height }} {{ labelSize.unit }}
        </div>
        <div v-if="zoom !== 1" class="zoom-badge">🔍 {{ Math.round(zoom * 100) }}%</div>
      </div>
    </div>
  </div>
  <!-- Добавляем секцию с данными для печати и кнопками -->
  <div style="margin-top: 16px">
    <v-divider class="my-2" />

    <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
      Данные для печати
    </h3>

    <v-text-field
      v-model="printData.partNumber"
      label="Part Number"
      density="compact"
      hide-details
      class="mb-2"
    />
    <v-text-field
      v-model="printData.description"
      label="Описание"
      density="compact"
      hide-details
      class="mb-2"
    />
    <v-text-field
      v-model="printData.manufacturer"
      label="Производитель"
      density="compact"
      hide-details
      class="mb-2"
    />
    <v-textarea
      v-model="printData.serialsText"
      label="Серийные номера (каждый с новой строки)"
      rows="4"
      density="compact"
      hide-details
    />
  </div>

  <v-divider class="my-2" />

  <!-- Действия -->
  <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap">
    <v-btn size="small" color="error" variant="text" @click="clearTemplate">Очистить всё</v-btn>
    <v-btn size="small" color="secondary" variant="outlined" @click="importTemplate">Импорт</v-btn>
    <v-btn size="small" color="secondary" variant="outlined" @click="exportTemplate">Экспорт</v-btn>
    <v-btn size="small" color="primary" variant="outlined" @click="loadTemplate">Загрузить</v-btn>
    <v-btn size="small" color="primary" @click="saveTemplate">Сохранить</v-btn>
    <v-btn size="small" color="success" @click="printLabels">Печать</v-btn>
  </div>
</template>

<style scoped>
.grid-item {
  border: 1px solid #ddd;
  background: white;
  height: 100%;
  width: 100%;
  cursor: pointer;
  transition: all 0.15s;
  overflow: auto;
  border-radius: 2px;
}

.grid-item:hover {
  border-color: #1976d2;
  background: #f8f9ff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.grid-item-selected {
  border: 2px solid #1976d2;
  background: #e3f2fd;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.element-content {
  padding: 4px;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
  overflow: auto;
  position: relative;
}

.editable-text {
  cursor: text;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.editable-text:hover {
  background: rgba(25, 118, 210, 0.05);
  border-radius: 4px;
}

.text-editor-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
}

.text-editor-wrapper input {
  width: 100%;
  padding: 4px;
  border-radius: 4px;
}

.size-info {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 10px;
  color: #666;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  font-family: monospace;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.zoom-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 10px;
  color: #1976d2;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.label-canvas {
  position: relative;
  transition: all 0.2s ease;
}

.canvas-container {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
