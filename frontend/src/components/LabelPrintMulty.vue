<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { LabelPrinterMulty } from '@/assets/printLabelMulty'
import bwipjs from 'bwip-js'

// ===== State =====
const partNumber = ref('AB80307A')
const description = ref(
  'Электронная плата 2 для модуля 8-канального дискретного ввода, 24В, "Сухой контакт"'
)
const manufacturer = ref('')

const serialsText = ref('261200001-01\n261200002-01\n261200003-01')
const serials = computed(() =>
  serialsText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length)
)

// CSS-параметры
const labelWidth = ref(30)
const labelHeight = ref(15)
const codeSize = ref(6)
const fontMain = ref(10)
const fontSmall = ref(7)
const padding = ref(1)
const gap = ref(0.5)
const previewScale = ref(9) // только для предпросмотра

// HTML предпросмотра
const previewHtml = ref('')
// ===== Вычисляемая высота блока предпросмотра =====
const previewHeight = computed(() => labelHeight.value * previewScale.value + 20)
// ===== Генерация DataMatrix =====
async function generateDataMatrix(text: string) {
  const canvas = document.createElement('canvas')
  await bwipjs.toCanvas(canvas, { bcid: 'datamatrix', text, scale: 3 })
  return canvas.toDataURL('image/png')
}

// ===== Генерация шаблона одной этикетки (с переменными) =====
const templateHtml = computed(
  () => `
<div class="page">
  <div class="label">
    <div class="code">
      <img src="\${barcode}" />
    </div>
    <div class="top-text">
      <div>\${serial}</div>
      <div>\${partNumber}</div>
    </div>
    <div class="bottom-text">
     <b> \${description} </b> <br> <p> \${manufacturer} </p>
    </div>
  </div>
</div>
<style>
.page { width: ${labelWidth.value}mm; height: ${labelHeight.value}mm;  page-break-after: always; }
.label {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: ${padding.value}mm;
  display: grid;
  grid-template-columns: ${codeSize.value}mm 1fr;
  grid-template-rows: ${codeSize.value}mm 1fr;
  gap: ${gap.value}mm;
}
.code { grid-column:1; grid-row:1; }
.code img { width: 100%; height: 100%; }
.top-text { grid-column:2; grid-row:1; font-family: "Arial Narrow", Arial, sans-serif; line-height: 1; font-size: ${fontMain.value}px; overflow:hidden; word-break:break-word; }
.bottom-text { grid-column:1/span 2; grid-row:2; font-family: "Arial Narrow", Arial, sans-serif; line-height: 1; font-size: ${fontSmall.value}px; overflow:hidden; word-break:break-word; }
.bottom-text p { grid-column:1/span 2; grid-row:2; font-family: "Arial Narrow", Arial, sans-serif; line-height: 1; font-size: ${fontSmall.value}px; overflow:hidden; justify-self: end; padding-top:1px }
    @media print {
        @page {
            size: var(--label-width) var(--label-height);
            margin: 0;
        }

        body {
            margin: 0;
        }
    }
</style>
`
)

async function generatePreview() {
  if (!serials.value.length) return

  const barcode = await generateDataMatrix(serials.value[0])

  // формируем HTML одной этикетки с заменой переменных
  const labelHtml = templateHtml.value
    .replaceAll('${serial}', serials.value[0])
    .replaceAll('${barcode}', barcode)
    .replaceAll('${partNumber}', partNumber.value)
    .replaceAll('${description}', description.value)
    .replaceAll('${manufacturer}', manufacturer.value)

  // применяем масштаб и рамку внутри масштабируемого блока
  previewHtml.value = `
      <div style="transform: scale(${previewScale.value}); transform-origin: top left; display: inline-block; border: 1px dashed #999;">
        ${labelHtml}
      </div>`
}

// ===== Печать =====
async function printLabels() {
  if (!serials.value.length) return
  const printer = new LabelPrinterMulty(window.NL_PATH)
  await printer.print(
    serials.value.map((s) => ({ serial: s })),
    {
      partNumber: partNumber.value,
      description: description.value,
      manufacturer: manufacturer.value
    },
    {
      labelWidth: labelWidth.value,
      labelHeight: labelHeight.value,
      codeSize: codeSize.value,
      fontMain: fontMain.value,
      fontSmall: fontSmall.value,
      padding: padding.value,
      gap: gap.value
    },
    templateHtml.value
  )
}

// ===== Авто-обновление предпросмотра =====
watch(
  [
    serials,
    partNumber,
    description,
    manufacturer,
    labelWidth,
    labelHeight,
    codeSize,
    fontMain,
    fontSmall,
    padding,
    gap,
    previewScale
  ],
  generatePreview,
  { immediate: true }
)
</script>

<template>
  <v-container>
    <v-card class="pa-4">
      <v-card-title>Дизайнер этикеток</v-card-title>
      <v-card-text>
        <v-text-field v-model="partNumber" label="Part Number" />
        <v-text-field v-model="description" label="Описание" />
        <v-text-field v-model="manufacturer" label="Производитель" />
        <v-textarea
          v-model="serialsText"
          label="Серийные номера (каждый с новой строки)"
          rows="6"
        />

        <v-row dense class="mt-3">
          <v-col cols="6" md="3"><v-text-field v-model.number="labelWidth" label="Ширина" /></v-col>
          <v-col cols="6" md="3"
            ><v-text-field v-model.number="labelHeight" label="Высота"
          /></v-col>
          <v-col cols="6" md="3"
            ><v-text-field v-model.number="codeSize" label="Размер кода"
          /></v-col>
          <v-col cols="6" md="3"
            ><v-text-field v-model.number="previewScale" label="Масштаб"
          /></v-col>
        </v-row>

        <v-row dense>
          <v-col cols="6"><v-text-field v-model.number="fontMain" label="Шрифт основной" /></v-col>
          <v-col cols="6"
            ><v-text-field v-model.number="fontSmall" label="Шрифт маленький"
          /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model.number="padding" label="Отступ" /></v-col>
          <v-col cols="6"
            ><v-text-field v-model.number="gap" label="Расстояние между блоками"
          /></v-col>
        </v-row>

        <v-btn class="mt-3" color="secondary" @click="generatePreview">Обновить предпросмотр</v-btn>

        <!-- предпросмотр -->
        <div
          class="preview mt-3"
          v-html="previewHtml"
          :style="{
            border: '1px solid #ccc',
            padding: '8px',
            overflow: 'hidden',
            height: previewHeight + 'mm'
          }"
        ></div>
      </v-card-text>
      <v-card-actions>
        <v-btn color="primary" @click="printLabels">Печать всех</v-btn>
      </v-card-actions>
    </v-card>
  </v-container>
</template>
