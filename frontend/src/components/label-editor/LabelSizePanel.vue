<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const { labelSize, zoom, realSizeInPx } = storeToRefs(store)

// Подогнать масштаб этикетки под рабочую область.
// Сигнал отправляется в store, LabelCanvas подписан на него и вызывает fitZoom.
function resetFit() {
  store.triggerFitZoom()
}
</script>

<template>
  <div class="sp-root">
    <!-- ── Размер этикетки ─────────────────────────────────────────────────── -->
    <div class="sp-section-header">
      <v-icon size="11" color="#7a8a9a">mdi-label-outline</v-icon>
      <span>Размер этикетки</span>
    </div>

    <div class="sp-row">
      <!-- Ширина -->
      <div class="sp-field">
        <span class="sp-label">W</span>
        <div class="sp-spinbox">
          <input
            v-model.number="labelSize.width"
            type="number"
            min="10"
            max="500"
            class="sp-spinbox-input"
            @change="store.validateSize"
          />
        </div>
      </div>

      <span class="sp-x">×</span>

      <!-- Высота -->
      <div class="sp-field">
        <span class="sp-label">H</span>
        <div class="sp-spinbox">
          <input
            v-model.number="labelSize.height"
            type="number"
            min="10"
            max="500"
            class="sp-spinbox-input"
            @change="store.validateSize"
          />
        </div>
      </div>

      <!-- Единицы -->
      <div class="sp-unit-toggle">
        <button
          :class="['sp-unit-btn', { 'sp-unit-btn--active': labelSize.unit === 'mm' }]"
          @click="labelSize.unit = 'mm'"
        >
          mm
        </button>
        <button
          :class="['sp-unit-btn', { 'sp-unit-btn--active': labelSize.unit === 'px' }]"
          @click="labelSize.unit = 'px'"
        >
          px
        </button>
      </div>

      <!-- px-справка -->
      <span class="sp-info">
        {{ realSizeInPx.width.toFixed(0) }}×{{ realSizeInPx.height.toFixed(0) }}&thinsp;px
      </span>
    </div>

    <!-- ── Зум: только информация ──────────────────────────────────────────── -->
    <div class="sp-section-header" style="margin-top: 2px">
      <v-icon size="11" color="#7a8a9a">mdi-magnify</v-icon>
      <span>Масштаб</span>
    </div>

    <div class="sp-row" style="gap: 8px">
      <!-- Текущий зум -->
      <div class="sp-zoom-badge">{{ Math.round(zoom * 100) }}%</div>

      <!-- Подсказка -->
      <span class="sp-hint">
        <v-icon size="11" color="#aaa">mdi-mouse</v-icon>
        колёсико над макетом
      </span>

      <!-- Кнопка «вписать» -->
      <v-tooltip text="Вписать этикетку в рабочую область" location="bottom">
        <template #activator="{ props: tp }">
          <button v-bind="tp" class="sp-fit-btn" @click="resetFit">
            <v-icon size="13">mdi-fit-to-screen-outline</v-icon>
          </button>
        </template>
      </v-tooltip>
    </div>
  </div>
</template>

<style scoped>
.sp-root {
  padding: 8px 10px 6px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
}

.sp-section-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: #7a8a9a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0;
}

.sp-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: nowrap;
  padding-bottom: 4px;
}

.sp-x {
  color: #aaa;
  font-size: 12px;
  flex-shrink: 0;
}

.sp-info {
  font-size: 10px;
  color: #9a9a9a;
  white-space: nowrap;
  font-family: 'Consolas', monospace;
  flex-shrink: 0;
}

.sp-field {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.sp-label {
  font-size: 10px;
  font-weight: 600;
  color: #888;
  min-width: 10px;
}

.sp-spinbox {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
  width: 54px;
}
.sp-spinbox:focus-within {
  border-color: #5a96cc;
}
.sp-spinbox-input {
  flex: 1;
  width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  padding: 0 4px;
  color: #222;
  text-align: center;
  -moz-appearance: textfield;
}
.sp-spinbox-input::-webkit-inner-spin-button,
.sp-spinbox-input::-webkit-outer-spin-button {
  opacity: 0.4;
  margin-right: 1px;
}

.sp-unit-toggle {
  display: inline-flex;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0;
}
.sp-unit-btn {
  height: 24px;
  padding: 0 7px;
  border: none;
  background: #fff;
  cursor: pointer;
  font-size: 10px;
  font-family: inherit;
  font-weight: 600;
  color: #888;
  transition:
    background 0.1s,
    color 0.1s;
  outline: none;
}
.sp-unit-btn + .sp-unit-btn {
  border-left: 1px solid #c4c8ce;
}
.sp-unit-btn:hover {
  background: #e8f0fb;
  color: #1565c0;
}
.sp-unit-btn--active {
  background: #ccdff5;
  color: #0d47a1;
}

/* ── Зум ─────────────────────────────────────────────────────────────────────── */
.sp-zoom-badge {
  font-size: 13px;
  font-weight: 700;
  font-family: 'Consolas', monospace;
  color: #1565c0;
  background: #e8f0fe;
  border: 1px solid #c5d8f6;
  border-radius: 4px;
  padding: 1px 8px;
  min-width: 46px;
  text-align: center;
  flex-shrink: 0;
}

.sp-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: #aaa;
  white-space: nowrap;
  flex-shrink: 0;
}

.sp-fit-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 24px;
  width: 28px;
  border: 1px solid #c4c8ce;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  color: #666;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  outline: none;
  flex-shrink: 0;
}
.sp-fit-btn:hover {
  background: #e8f0fb;
  border-color: #90b8e8;
  color: #1565c0;
}
</style>
