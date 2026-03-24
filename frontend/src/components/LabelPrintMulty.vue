<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import bwipjs from 'bwip-js'
import { LabelPrinterMulty } from '@/assets/printLabelMulty'

// ===== State =====
const partNumber = ref('')
const description = ref('')
const manufacturer = ref('')

// Массив серийников
const serialsText = ref('123456\n123457\n123458')

// CSS переменные
const labelWidth = ref(30)
const labelHeight = ref(15)
const codeSize = ref(8)
const fontMain = ref(8)
const fontSmall = ref(7)
const padding = ref(1)
const gap = ref(1)
const previewScale = ref(2)

// ===== Массив серийников =====
const serials = computed(() =>
  serialsText.value
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length)
)

// Предпросмотр HTML
const previewHtml = ref('')

// ===== Вычисляемая высота блока предпросмотра =====
const previewHeight = computed(() => labelHeight.value * previewScale.value + 20)

// ===== Генерация DataMatrix =====
async function generateDataMatrix(text: string) {
  const canvas = document.createElement('canvas')
  await bwipjs.toCanvas(canvas, {
    bcid: 'datamatrix',
    text,
    scale: 3
  })
  return canvas.toDataURL('image/png')
}

// ===== Генерация HTML предпросмотра (берём первый SN) =====
async function updatePreview() {
  if (!serials.value.length) return
  const firstSN = serials.value[0]
  const barcode = await generateDataMatrix(firstSN)

  previewHtml.value = `
<style>
.page {
  width: ${labelWidth.value}mm;
  height: ${labelHeight.value}mm;
  border: 1px dashed #ccc;
  margin-bottom: 4px;
  transform: scale(${previewScale.value});
  transform-origin: top left;
}
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
.code {
  grid-column: 1;
  grid-row: 1;
}
.code img {
  width: 100%;
  height: 100%;
}
.top-text {
  grid-column: 2;
  grid-row: 1;
  font-size: ${fontMain.value}px;
  overflow: hidden;
  word-break: break-word;
}
.bottom-text {
  grid-column: 1 / span 2;
  grid-row: 2;
  font-size: ${fontSmall.value}px;
  overflow: hidden;
  word-break: break-word;
}
</style>

<div class="page">
  <div class="label">
    <div class="code">
      <img src="${barcode}" />
    </div>
    <div class="top-text">
      <div>${firstSN}</div>
      <div>${partNumber.value}</div>
    </div>
    <div class="bottom-text">
      ${description.value} ${manufacturer.value}
    </div>
  </div>
</div>
`
}

// ===== Печать =====
async function printLabels() {
  if (!serials.value.length) {
    alert('Нет серийников для печати')
    return
  }

  const printer = new LabelPrinterMulty(window.NL_PATH)
  await printer.print(
    serials.value.map((s) => ({ serial: s })),
    {
      partNumber: partNumber.value,
      description: description.value,
      manufacturer: manufacturer.value
    }
  )
}

// ===== Авто-обновление предпросмотра =====
watch(
  [
    partNumber,
    description,
    manufacturer,
    serials,
    labelWidth,
    labelHeight,
    codeSize,
    fontMain,
    fontSmall,
    padding,
    gap,
    previewScale
  ],
  updatePreview,
  { immediate: true }
)
</script>

<template>
  <v-container>
    <v-card class="pa-4">
      <v-card-title>Дизайнер этикеток</v-card-title>

      <v-card-text>
        <!-- Общие данные -->
        <v-text-field v-model="partNumber" label="Part Number" />
        <v-text-field v-model="description" label="Описание" />
        <v-text-field v-model="manufacturer" label="Производитель" />

        <!-- Массив серийников -->
        <v-textarea
          v-model="serialsText"
          label="Серийные номера (каждый с новой строки)"
          rows="6"
        />

        <!-- Настройки CSS -->
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
