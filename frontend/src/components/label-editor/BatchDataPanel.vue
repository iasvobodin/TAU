<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const {
  batchCommonData,
  batchPrintEnabled,
  templateTextFields,
  hasSerialInTemplate,
  iterableFields,
  iterableCounts,
  iterableCountMismatch,
  batchIterableTexts
} = storeToRefs(store)

const batchCount = computed(() => {
  const fields = iterableFields.value
  if (!fields.length) return 0
  const firstField = fields[0]
  return iterableCounts.value[firstField] ?? 0
})

function toggleBatch(val: boolean | null) {
  const enabled = val ?? false
  if (enabled && !hasSerialInTemplate.value) return
  batchPrintEnabled.value = enabled
}
</script>

<template>
  <div class="bp-root">
    <div class="sp-section-header">
      <v-icon size="11" color="#7a8a9a">mdi-printer-outline</v-icon>
      <span>Групповая печать</span>
    </div>

    <!-- ── Batch toggle ────────────────────────────────────────────────── -->
    <div class="bp-toggle-row">
      <span class="bp-toggle-label">Серия</span>
      <v-tooltip
        :text="!hasSerialInTemplate ? 'Нет поля серийного номера в шаблоне' : ''"
        :disabled="hasSerialInTemplate"
        location="top"
      >
        <template #activator="{ props }">
          <span v-bind="props">
            <button
              :class="[
                'bp-toggle',
                { 'bp-toggle--on': batchPrintEnabled, 'bp-toggle--disabled': !hasSerialInTemplate }
              ]"
              :disabled="!hasSerialInTemplate"
              @click="toggleBatch(!batchPrintEnabled)"
            >
              <span class="bp-toggle__knob" />
            </button>
          </span>
        </template>
      </v-tooltip>
    </div>

    <!-- ── Batch data (только когда включено) ──────────────────────────── -->
    <transition name="bp-expand">
      <div v-if="batchPrintEnabled" class="bp-body">
        <!-- Общие поля -->
        <div v-if="templateTextFields.length" class="bp-section">
          <div class="bp-section-label">Общие данные</div>
          <div class="bp-fields">
            <template v-for="field in templateTextFields" :key="field.dataField">
              <label class="bp-field-label">{{ field.dataField }}</label>
              <div class="bp-input-wrap">
                <input
                  v-model="batchCommonData[field.dataField]"
                  type="text"
                  class="bp-input"
                  :placeholder="field.label"
                />
              </div>
            </template>
          </div>
        </div>

        <!-- Итерируемые barcode -->
        <div v-if="iterableFields.length" class="bp-section">
          <div class="bp-section-label">Значения для итерируемых barcode</div>
          <div v-for="field in iterableFields" :key="field" class="bp-iter-field">
            <label class="bp-field-label">{{ field }}</label>
            <textarea
              v-model="batchIterableTexts[field]"
              class="bp-textarea"
              :placeholder="`AA1\nAA2\nAA3`"
              rows="3"
            />
            <span class="bp-count">{{ iterableCounts[field] ?? 0 }} шт.</span>
          </div>
          <!-- Предупреждение о несовпадении -->
          <div v-if="iterableCountMismatch" class="bp-warning">
            <v-icon size="14" color="#e65100">mdi-alert</v-icon>
            <span>Несовпадение количества значений у итерируемых barcode</span>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.bp-root {
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
  padding: 8px 10px 10px;
}

/* Переиспользуем заголовок секции из LabelSizePanel */
:deep(.sp-section-header) {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: #7a8a9a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0 6px;
}

/* ── Batch toggle row ──────────────────────────────────────────────────── */
.bp-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.bp-toggle-label {
  font-size: 11px;
  font-weight: 600;
  color: #555;
}

.bp-toggle {
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

.bp-toggle--on {
  background: #5a96cc;
}

.bp-toggle--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.bp-toggle__knob {
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

.bp-toggle--on .bp-toggle__knob {
  transform: translateX(14px);
}

/* ── Body ──────────────────────────────────────────────────────────────── */
.bp-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bp-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-section-label {
  font-size: 10px;
  font-weight: 600;
  color: #7a8a9a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

/* ── Fields grid (вертикальная) ────────────────────────────────────────── */
.bp-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bp-field-label {
  font-size: 11px;
  color: #666;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
}

.bp-input-wrap {
  height: 24px;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  background: #fff;
  display: flex;
  overflow: hidden;
}

.bp-input-wrap:focus-within {
  border-color: #5a96cc;
}

.bp-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 11px;
  font-family: inherit;
  padding: 0 6px;
  color: #222;
}

/* ── Iterable fields ───────────────────────────────────────────────────── */
.bp-iter-field {
  display: flex;
  flex-direction: column;
  gap: 3px;
  margin-bottom: 6px;
}

.bp-textarea {
  width: 100%;
  box-sizing: border-box;
  min-height: 60px;
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

.bp-textarea:focus {
  border-color: #5a96cc;
}

.bp-textarea::placeholder {
  color: #c8c8c8;
}

.bp-count {
  font-size: 10px;
  color: #5a96cc;
  font-weight: 700;
  background: #e8f0fb;
  padding: 1px 5px;
  border-radius: 8px;
  align-self: flex-start;
}

.bp-warning {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  background: #fff3e0;
  border: 1px solid #ffb74d;
  border-radius: 4px;
  font-size: 10px;
  color: #e65100;
}

/* ── Transition ────────────────────────────────────────────────────────── */
.bp-expand-enter-active,
.bp-expand-leave-active {
  transition:
    max-height 0.2s ease,
    opacity 0.15s ease;
  max-height: 600px;
  overflow: hidden;
}

.bp-expand-enter-from,
.bp-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
