<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const {
  batchCommonData,
  batchSerialsText,
  batchPrintEnabled,
  svgRenderEnabled,
  templateTextFields,
  hasSerialInTemplate,
  lastSavedPath,
  serials
} = storeToRefs(store)

const currentFileName = computed(() =>
  lastSavedPath.value ? (lastSavedPath.value.split(/[\\\/]/).pop() ?? null) : null
)

function toggleBatch(val: boolean | null) {
  const enabled = val ?? false
  if (enabled && !hasSerialInTemplate.value) return
  batchPrintEnabled.value = enabled
}
</script>

<template>
  <div class="pp-root">
    <!-- ══ Верхняя строка: файл + батч тоггл ══════════════════════════════ -->
    <div class="pp-topbar">
      <!-- Текущий файл -->
      <div class="pp-file-indicator">
        <v-icon size="13" :color="currentFileName ? '#4caf50' : '#aaa'">{{
          currentFileName ? 'mdi-file-check-outline' : 'mdi-file-outline'
        }}</v-icon>
        <span class="pp-file-name" :class="{ 'pp-file-name--saved': !!currentFileName }">
          {{ currentFileName ?? 'Не сохранён' }}
        </span>
      </div>

      <div class="pp-topbar-spacer" />

      <!-- SVG toggle -->
      <v-tooltip
        location="top"
        :text="svgRenderEnabled ? 'SVG-рендер (векторный)' : 'HTML-рендер (стандартный)'"
      >
        <template #activator="{ props: tp }">
          <button
            v-bind="tp"
            :class="['pp-mode-btn', { 'pp-mode-btn--active': svgRenderEnabled }]"
            @click="svgRenderEnabled = !svgRenderEnabled"
          >
            <v-icon size="13">mdi-vector-curve</v-icon>
            <span>SVG</span>
          </button>
        </template>
      </v-tooltip>

      <!-- Batch toggle -->
      <div class="pp-batch-toggle">
        <span class="pp-batch-label">Серия</span>
        <v-tooltip
          :text="!hasSerialInTemplate ? 'Нет поля серийного номера в шаблоне' : ''"
          :disabled="hasSerialInTemplate"
          location="top"
        >
          <template #activator="{ props }">
            <span v-bind="props">
              <button
                :class="[
                  'pp-toggle',
                  {
                    'pp-toggle--on': batchPrintEnabled,
                    'pp-toggle--disabled': !hasSerialInTemplate
                  }
                ]"
                :disabled="!hasSerialInTemplate"
                @click="toggleBatch(!batchPrintEnabled)"
              >
                <span class="pp-toggle__knob" />
              </button>
            </span>
          </template>
        </v-tooltip>
      </div>

      <div class="pp-divider-v" />

      <!-- Кнопка печати -->
      <button class="pp-print-btn" @click="store.printLabels">
        <v-icon size="14">mdi-printer</v-icon>
        <span>{{ batchPrintEnabled ? `Печать (${serials.length} шт.)` : 'Печать' }}</span>
      </button>
    </div>

    <!-- ══ Расширяемая секция: данные для серийной печати ═════════════════ -->
    <transition name="pp-expand">
      <div v-if="batchPrintEnabled" class="pp-batch-body">
        <div class="pp-batch-inner">
          <!-- Общие поля -->
          <div v-if="templateTextFields.length" class="pp-common-fields">
            <div class="pp-fields-label">Общие данные</div>
            <div class="pp-fields-grid">
              <template v-for="field in templateTextFields" :key="field.dataField">
                <label class="pp-field-label">{{ field.dataField }}</label>
                <div class="pp-spinbox pp-text-input-wrap">
                  <input
                    v-model="batchCommonData[field.dataField]"
                    type="text"
                    class="pp-text-input"
                    :placeholder="field.label"
                  />
                </div>
              </template>
            </div>
          </div>

          <div class="pp-v-sep" />

          <!-- Серийные номера -->
          <div class="pp-serials">
            <div class="pp-fields-label">
              Серийные номера
              <span class="pp-count">{{ serials.length }} шт.</span>
            </div>
            <textarea
              v-model="batchSerialsText"
              class="pp-serials-textarea"
              placeholder="261200001-01&#10;261200002-01&#10;261200003-01"
              rows="4"
            />
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.pp-root {
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
}

/* ── Topbar ──────────────────────────────────────────────────────────────── */
.pp-topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  height: 40px;
  background: linear-gradient(180deg, #f6f8fa 0%, #eef0f3 100%);
  border-top: 1px solid #dde0e5;
}

.pp-topbar-spacer {
  flex: 1;
}

.pp-divider-v {
  width: 1px;
  height: 20px;
  background: #d0d4d9;
  flex-shrink: 0;
}

/* ── Файл ────────────────────────────────────────────────────────────────── */
.pp-file-indicator {
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

.pp-file-name {
  font-size: 11px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'Consolas', monospace;
}
.pp-file-name--saved {
  color: #444;
}

/* ── SVG mode button ─────────────────────────────────────────────────────── */
.pp-mode-btn {
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
.pp-mode-btn:hover {
  background: #e8f0fb;
  border-color: #90b8e8;
  color: #1565c0;
}
.pp-mode-btn--active {
  background: #ccdff5;
  border-color: #5a96cc;
  color: #0d47a1;
}

/* ── Batch toggle ────────────────────────────────────────────────────────── */
.pp-batch-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pp-batch-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
}

.pp-toggle {
  position: relative;
  width: 32px;
  height: 18px;
  border-radius: 9px;
  border: none;
  background: #c8cdd4;
  cursor: pointer;
  transition: background 0.2s;
  outline: none;
  flex-shrink: 0;
  padding: 0;
}
.pp-toggle--on {
  background: #5a96cc;
}
.pp-toggle--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.pp-toggle__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: block;
}
.pp-toggle--on .pp-toggle__knob {
  transform: translateX(14px);
}

/* ── Print button ────────────────────────────────────────────────────────── */
.pp-print-btn {
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
.pp-print-btn:hover {
  background: linear-gradient(180deg, #4a9fe6 0%, #3a88d0 100%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.pp-print-btn:active {
  background: linear-gradient(180deg, #2a78c0 0%, #1a68b0 100%);
  box-shadow: none;
}

/* ── Batch body ──────────────────────────────────────────────────────────── */
.pp-batch-body {
  border-top: 1px solid #dde0e5;
  overflow: hidden;
}

.pp-batch-inner {
  display: flex;
  gap: 0;
  padding: 10px 12px;
}

.pp-common-fields {
  flex: 1;
  min-width: 0;
}

.pp-v-sep {
  width: 1px;
  background: #dde0e5;
  margin: 0 12px;
  flex-shrink: 0;
}

.pp-serials {
  width: 200px;
  flex-shrink: 0;
}

.pp-fields-label {
  font-size: 10px;
  font-weight: 600;
  color: #7a8a9a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.pp-count {
  font-size: 10px;
  color: #5a96cc;
  font-weight: 700;
  background: #e8f0fb;
  padding: 1px 5px;
  border-radius: 8px;
}

.pp-fields-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 8px;
  align-items: center;
}

.pp-field-label {
  font-size: 11px;
  color: #666;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
}

/* ── Text input ──────────────────────────────────────────────────────────── */
.pp-text-input-wrap {
  height: 24px;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  background: #fff;
  display: flex;
  overflow: hidden;
}
.pp-text-input-wrap:focus-within {
  border-color: #5a96cc;
}
.pp-text-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 11px;
  font-family: inherit;
  padding: 0 6px;
  color: #222;
}

/* ── Serials textarea ────────────────────────────────────────────────────── */
.pp-serials-textarea {
  width: 100%;
  box-sizing: border-box;
  height: 80px;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  background: #fff;
  padding: 5px 7px;
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: #222;
  resize: vertical;
  outline: none;
  transition: border-color 0.1s;
}
.pp-serials-textarea:focus {
  border-color: #5a96cc;
}
.pp-serials-textarea::placeholder {
  color: #c8c8c8;
}

/* ── Transition ──────────────────────────────────────────────────────────── */
.pp-expand-enter-active,
.pp-expand-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease;
  max-height: 300px;
  overflow: hidden;
}
.pp-expand-enter-from,
.pp-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
