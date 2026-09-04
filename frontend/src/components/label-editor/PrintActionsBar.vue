<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'
import PrintSettingsDialog from './PrintSettingsDialog.vue'

const store = useLabelEditorStore()
const {
  svgRenderEnabled,
  batchPrintEnabled,
  iterableFields,
  iterableCounts,
  lastSavedLabelPath,
  showElementBorders,
  printLayoutConfig
} = storeToRefs(store)

const showSettings = ref(false)

const currentFileName = computed(() =>
  lastSavedLabelPath.value ? (lastSavedLabelPath.value.split(/[\\\/]/).pop() ?? null) : null
)

// Количество этикеток в пакетной печати (из первого итерируемого barcode)
const batchCount = computed(() => {
  const fields = iterableFields.value
  if (!fields.length) return 0
  const firstField = fields[0]
  return iterableCounts.value[firstField] ?? 0
})

const hasMultiLabel = computed(() => printLayoutConfig.value.enabled)

// Если multi-label включён, показываем количество этикеток на листе
const multiLabelHint = computed(() => {
  const c = printLayoutConfig.value
  if (!c.enabled) return ''
  const total = c.cols * c.rows
  return `${c.sheetWidth}×${c.sheetHeight} • ${total} шт/лист`
})
</script>

<template>
  <div class="pa-root">
    <!-- Файл -->
    <div class="pa-file">
      <v-icon size="13" :color="currentFileName ? '#4caf50' : '#aaa'">{{
        currentFileName ? 'mdi-file-check-outline' : 'mdi-file-outline'
      }}</v-icon>
      <span class="pa-file-name" :class="{ 'pa-file-name--saved': !!currentFileName }">
        {{ currentFileName ?? 'Не сохранён' }}
      </span>
    </div>

    <div class="pa-spacer" />

    <!-- ── Multi-label hint ── -->
    <span v-if="hasMultiLabel" class="pa-multi-hint">{{ multiLabelHint }}</span>

    <!-- ── Границы элементов (чертёжный режим) ── -->
    <v-tooltip
      location="top"
      :text="
        showElementBorders ? 'Скрыть границы элементов' : 'Показать границы элементов с размерами'
      "
    >
      <template #activator="{ props: tp }">
        <button
          v-bind="tp"
          :class="['pa-btn', { 'pa-btn--active': showElementBorders }]"
          @click="showElementBorders = !showElementBorders"
        >
          <v-icon size="13">mdi-border-all-variant</v-icon>
          <span>Границы</span>
        </button>
      </template>
    </v-tooltip>

    <!-- SVG toggle -->
    <v-tooltip
      location="top"
      :text="svgRenderEnabled ? 'SVG-рендер (векторный)' : 'HTML-рендер (стандартный)'"
    >
      <template #activator="{ props: tp }">
        <button
          v-bind="tp"
          :class="['pa-btn', { 'pa-btn--active': svgRenderEnabled }]"
          @click="svgRenderEnabled = !svgRenderEnabled"
        >
          <v-icon size="13">mdi-vector-curve</v-icon>
          <span>SVG</span>
        </button>
      </template>
    </v-tooltip>

    <!-- Save SVG -->
    <v-tooltip location="top" text="Сохранить этикетку как SVG">
      <template #activator="{ props: tp }">
        <button v-bind="tp" class="pa-btn" @click="store.saveSVG">
          <v-icon size="13">mdi-file-download-outline</v-icon>
          <span>Save SVG</span>
        </button>
      </template>
    </v-tooltip>

    <div class="pa-divider" />

    <!-- ⚙ Настройки печати -->
    <v-tooltip location="top" text="Настройки печати">
      <template #activator="{ props: tp }">
        <button
          v-bind="tp"
          :class="['pa-btn', { 'pa-btn--active': hasMultiLabel }]"
          @click="showSettings = true"
        >
          <v-icon size="14">mdi-cog-outline</v-icon>
        </button>
      </template>
    </v-tooltip>

    <!-- Печать -->
    <button class="pa-print-btn" @click="store.printLabels">
      <v-icon size="14">mdi-printer</v-icon>
      <span>{{ batchPrintEnabled ? `Печать (${batchCount} шт.)` : 'Печать' }}</span>
    </button>

    <!-- Диалог настроек -->
    <PrintSettingsDialog v-if="showSettings" @close="showSettings = false" />
  </div>
</template>

<style scoped>
.pa-root {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  height: 36px;
  background: linear-gradient(180deg, #f6f8fa 0%, #eef0f3 100%);
  border-top: 1px solid #d4d8de;
  flex-shrink: 0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
}

.pa-spacer {
  flex: 1;
}

.pa-divider {
  width: 1px;
  height: 18px;
  background: #d0d4d9;
  flex-shrink: 0;
}

/* ── Multi-label hint ─────────────────────────────────────────────────────── */
.pa-multi-hint {
  font-size: 10px;
  color: #3a8fd6;
  background: #e8f0fb;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
  border: 1px solid #c8ddf0;
}

/* ── File indicator ─────────────────────────────────────────────────────── */
.pa-file {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  background: #fff;
  border: 1px solid #dde0e5;
  border-radius: 3px;
  max-width: 200px;
  overflow: hidden;
}

.pa-file-name {
  font-size: 11px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Consolas', monospace;
}

.pa-file-name--saved {
  color: #444;
}

/* ── Action buttons ─────────────────────────────────────────────────────── */
.pa-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid #c8cdd4;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  color: #666;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  outline: none;
}

.pa-btn:hover {
  background: #e8f0fb;
  border-color: #90b8e8;
  color: #1565c0;
}

.pa-btn--active {
  background: #ccdff5;
  border-color: #5a96cc;
  color: #0d47a1;
}

/* ── Print button ───────────────────────────────────────────────────────── */
.pa-print-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 14px;
  border: none;
  border-radius: 4px;
  background: linear-gradient(180deg, #3a8fd6 0%, #2a78c0 100%);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  font-family: inherit;
  color: #fff;
  transition:
    background 0.1s,
    box-shadow 0.1s;
  outline: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  white-space: nowrap;
}

.pa-print-btn:hover {
  background: linear-gradient(180deg, #4a9fe6 0%, #3a88d0 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}

.pa-print-btn:active {
  background: linear-gradient(180deg, #2a78c0 0%, #1a68b0 100%);
  box-shadow: none;
}
</style>
