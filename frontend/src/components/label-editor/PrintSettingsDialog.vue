<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'
import type { PrintLayoutConfig } from '@/types/label'
import LabelDiffPanel from './LabelDiffPanel.vue'

const store = useLabelEditorStore()
const { labelSize, printLayoutConfig } = storeToRefs(store)

// Локальная копия для редактирования
const local = ref<PrintLayoutConfig>({
  ...printLayoutConfig.value
})

// Если enabled=false — подставляем размер шаблона как физический
if (!local.value.enabled || local.value.sheetWidth === 0 || local.value.sheetHeight === 0) {
  local.value.sheetWidth = labelSize.value.width
  local.value.sheetHeight = labelSize.value.height
}

// Авторасчёт количества колонок и строк
function autoCalculate() {
  const tw = labelSize.value.width
  const th = labelSize.value.height
  if (tw <= 0 || th <= 0) return

  const usableW = local.value.sheetWidth - local.value.marginLeft - local.value.marginRight
  const usableH = local.value.sheetHeight - local.value.marginTop - local.value.marginBottom

  if (usableW <= 0 || usableH <= 0) {
    local.value.cols = 0
    local.value.rows = 0
    return
  }

  local.value.cols = Math.max(1, Math.floor((usableW + local.value.gapX) / (tw + local.value.gapX)))
  local.value.rows = Math.max(1, Math.floor((usableH + local.value.gapY) / (th + local.value.gapY)))
}

// Пересчитываем при изменении параметров (если autoArrange)
watch(
  () => [
    local.value.sheetWidth,
    local.value.sheetHeight,
    local.value.gapX,
    local.value.gapY,
    local.value.marginTop,
    local.value.marginBottom,
    local.value.marginLeft,
    local.value.marginRight,
    local.value.autoArrange
  ],
  () => {
    if (local.value.autoArrange) autoCalculate()
  },
  { immediate: true }
)

// Итоговое количество этикеток на листе
const labelsPerSheet = computed(() => local.value.cols * local.value.rows)

// Предпросмотр: схематичные прямоугольники
const previewStyle = computed(() => {
  const s = local.value
  const tw = labelSize.value.width
  const th = labelSize.value.height
  if (tw <= 0 || th <= 0 || s.cols <= 0 || s.rows <= 0)
    return { wrapper: '', labels: [] as string[] }

  // Масштабируем preview (чтобы влезало ~300px)
  const scale = Math.min(280 / s.sheetWidth, 200 / s.sheetHeight, 1)
  const w = s.sheetWidth * scale
  const h = s.sheetHeight * scale

  const labels: string[] = []
  for (let r = 0; r < s.rows; r++) {
    for (let c = 0; c < s.cols; c++) {
      const idx = r * s.cols + c
      const left = (s.marginLeft + c * (tw + s.gapX)) * scale
      const top = (s.marginTop + r * (th + s.gapY)) * scale
      const lw = tw * scale
      const lh = th * scale
      labels.push(`<div style="
        position:absolute;
        left:${left.toFixed(1)}px;
        top:${top.toFixed(1)}px;
        width:${lw.toFixed(1)}px;
        height:${lh.toFixed(1)}px;
        border:1px solid #3a8fd6;
        background:rgba(58,143,214,0.08);
        border-radius:1px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:8px;
        color:#3a8fd6;
        box-sizing:border-box;
      ">#${idx + 1}</div>`)
    }
  }

  return {
    wrapper: `position:relative;width:${w.toFixed(1)}px;height:${h.toFixed(1)}px;background:#fafafa;border:1px solid #d0d4d9;border-radius:2px;`,
    labels
  }
})

function apply() {
  if (local.value.enabled) {
    if (local.value.autoArrange) autoCalculate()
    printLayoutConfig.value = { ...local.value }
  } else {
    printLayoutConfig.value = { ...local.value, enabled: false }
  }
}

const emit = defineEmits<{
  close: []
}>()

function close() {
  emit('close')
}

function applyAndClose() {
  apply()
  close()
}
</script>

<template>
  <div class="psd-overlay" @click.self="close">
    <div class="psd-dialog">
      <!-- ══ Header ══ -->
      <div class="psd-header">
        <v-icon size="16">mdi-cog-outline</v-icon>
        <span>Настройки печати</span>
        <button class="psd-close" @click="close">&times;</button>
      </div>

      <div class="psd-body">
        <!-- ══ Включение/выключение режима ══ -->
        <label class="psd-toggle">
          <input type="checkbox" v-model="local.enabled" />
          <span>Печать нескольких этикеток на листе</span>
        </label>

        <template v-if="local.enabled">
          <!-- ══ Размер шаблона (инфо) ══ -->
          <div class="psd-info">
            Размер этикетки: <strong>{{ labelSize.width }} × {{ labelSize.height }} мм</strong>
          </div>

          <!-- ══ Физический размер листа ══ -->
          <div class="psd-section">
            <div class="psd-section-title">Физический размер листа (этикетка в принтере)</div>
            <div class="psd-row">
              <div class="psd-field">
                <label>Ширина, мм</label>
                <input type="number" v-model.number="local.sheetWidth" min="1" step="1" />
              </div>
              <div class="psd-field">
                <label>Высота, мм</label>
                <input type="number" v-model.number="local.sheetHeight" min="1" step="1" />
              </div>
            </div>
          </div>

          <!-- ══ Компоновка ══ -->
          <div class="psd-section">
            <div class="psd-section-title">Компоновка на листе</div>

            <label class="psd-toggle psd-toggle--small">
              <input type="checkbox" v-model="local.autoArrange" />
              <span>Авторасчёт (по размеру листа)</span>
            </label>

            <div class="psd-row">
              <div class="psd-field">
                <label>Колонок</label>
                <input
                  type="number"
                  v-model.number="local.cols"
                  min="1"
                  :disabled="local.autoArrange"
                />
              </div>
              <div class="psd-field">
                <label>Строк</label>
                <input
                  type="number"
                  v-model.number="local.rows"
                  min="1"
                  :disabled="local.autoArrange"
                />
              </div>
            </div>

            <div class="psd-info psd-info--small">
              Этикеток на листе: <strong>{{ labelsPerSheet }}</strong>
            </div>
          </div>

          <!-- ══ Зазоры ══ -->
          <div class="psd-section">
            <div class="psd-section-title">Зазоры между этикетками</div>
            <div class="psd-row">
              <div class="psd-field">
                <label>По горизонтали, мм</label>
                <input type="number" v-model.number="local.gapX" min="0" step="0.5" />
              </div>
              <div class="psd-field">
                <label>По вертикали, мм</label>
                <input type="number" v-model.number="local.gapY" min="0" step="0.5" />
              </div>
            </div>
          </div>

          <!-- ══ Отступы ══ -->
          <div class="psd-section">
            <div class="psd-section-title">Отступы от краёв листа</div>
            <div class="psd-row">
              <div class="psd-field">
                <label>Сверху, мм</label>
                <input type="number" v-model.number="local.marginTop" min="0" step="0.5" />
              </div>
              <div class="psd-field">
                <label>Снизу, мм</label>
                <input type="number" v-model.number="local.marginBottom" min="0" step="0.5" />
              </div>
            </div>
            <div class="psd-row">
              <div class="psd-field">
                <label>Слева, мм</label>
                <input type="number" v-model.number="local.marginLeft" min="0" step="0.5" />
              </div>
              <div class="psd-field">
                <label>Справа, мм</label>
                <input type="number" v-model.number="local.marginRight" min="0" step="0.5" />
              </div>
            </div>
          </div>

          <!-- ══ Предпросмотр ══ -->
          <div class="psd-section">
            <div class="psd-section-title">Предпросмотр</div>
            <div class="psd-preview-wrap">
              <div
                v-if="labelsPerSheet > 0"
                :style="previewStyle.wrapper"
                v-html="previewStyle.labels.join('')"
              ></div>
              <div v-else class="psd-preview-empty">
                Не помещается ни одной этикетки &mdash; проверьте размеры листа
              </div>
            </div>
          </div>
        </template>

        <div v-else class="psd-off-hint">
          <v-icon size="14" color="#888">mdi-information-outline</v-icon>
          <span>Каждая этикетка будет напечатана на отдельном листе (как обычно)</span>
        </div>
      </div>

      <!-- ══ Footer ══ -->
      <div class="psd-footer">
        <LabelDiffPanel class="psd-diff" />
        <div class="psd-footer-spacer" />
        <button class="psd-btn psd-btn--cancel" @click="close">Отмена</button>
        <button class="psd-btn psd-btn--apply" @click="applyAndClose">Применить</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Overlay ────────────────────────────────────────────────────────────── */
.psd-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

/* ── Dialog ─────────────────────────────────────────────────────────────── */
.psd-dialog {
  width: 520px;
  max-height: 85vh;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  display: flex;
  flex-direction: column;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  color: #2a2a2a;
  overflow: hidden;
}

.psd-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: linear-gradient(180deg, #f6f8fa, #eef0f3);
  border-bottom: 1px solid #d4d8de;
  font-weight: 600;
  font-size: 13px;
  flex-shrink: 0;
}

.psd-close {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 20px;
  color: #888;
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
}
.psd-close:hover {
  color: #333;
}

.psd-body {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.psd-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e0e3e8;
  flex-shrink: 0;
}

.psd-footer-spacer {
  flex: 1;
}

.psd-diff {
  flex-shrink: 0;
}

/* ── Toggle ─────────────────────────────────────────────────────────────── */
.psd-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  font-weight: 500;
}

.psd-toggle--small {
  margin-bottom: 8px;
  font-weight: 400;
  font-size: 11px;
}

.psd-toggle input[type='checkbox'] {
  width: 16px;
  height: 16px;
  accent-color: #3a8fd6;
  cursor: pointer;
}

/* ── Info ───────────────────────────────────────────────────────────────── */
.psd-info {
  padding: 8px 12px;
  background: #eef5fc;
  border: 1px solid #c8ddf0;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 12px;
}

.psd-info--small {
  padding: 4px 8px;
  margin-top: 6px;
  margin-bottom: 0;
}

.psd-off-hint {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: #f8f8f8;
  border: 1px dashed #ccc;
  border-radius: 4px;
  color: #888;
  font-size: 12px;
}

/* ── Sections ───────────────────────────────────────────────────────────── */
.psd-section {
  margin-bottom: 14px;
}

.psd-section-title {
  font-weight: 600;
  font-size: 11px;
  color: #555;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 8px;
}

.psd-row {
  display: flex;
  gap: 12px;
  margin-bottom: 6px;
}

.psd-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.psd-field label {
  font-size: 11px;
  color: #666;
}

.psd-field input[type='number'] {
  height: 30px;
  padding: 0 8px;
  border: 1px solid #c8cdd4;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.1s;
}

.psd-field input[type='number']:focus {
  border-color: #3a8fd6;
  box-shadow: 0 0 0 2px rgba(58, 143, 214, 0.15);
}

.psd-field input[type='number']:disabled {
  background: #f0f0f0;
  color: #999;
}

/* ── Preview ────────────────────────────────────────────────────────────── */
.psd-preview-wrap {
  display: flex;
  justify-content: center;
  padding: 12px;
  background: #f5f5f5;
  border: 1px solid #e0e3e8;
  border-radius: 4px;
  min-height: 80px;
}

.psd-preview-empty {
  display: flex;
  align-items: center;
  color: #999;
  font-size: 11px;
}

/* ── Buttons ────────────────────────────────────────────────────────────── */
.psd-btn {
  height: 30px;
  padding: 0 16px;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  border: 1px solid #c8cdd4;
  background: #fff;
  color: #444;
  transition: background 0.1s;
}

.psd-btn:hover {
  background: #f0f2f5;
}

.psd-btn--apply {
  background: linear-gradient(180deg, #3a8fd6, #2a78c0);
  color: #fff;
  border: none;
}

.psd-btn--apply:hover {
  background: linear-gradient(180deg, #4a9fe6, #3a88d0);
}
</style>
