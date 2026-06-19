<script setup lang="ts">
/**
 * LabelCanvas — канвас-адаптер для vue-draggable-resizable.
 *
 * Zoom-логика:
 *   • При загрузке шаблона (watch templateKey + labelSizeMM) автоматически
 *     вычисляет коэффициент так, чтобы этикетка занимала рабочую область.
 *   • Колёсико мыши над рабочей областью меняет зум ±0.1.
 *   • Шаг привязки сетки зафиксирован на 0.1 мм.
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import VueDraggableResizable from 'vue-draggable-resizable'
import 'vue-draggable-resizable/style.css'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { resolveTextProps } from '@/types/label'
import type { ElementPosition } from '@/types/label'

const store = useLabelEditorStore()
const {
  positions,
  elements,
  selectedId,
  labelSizeInPx,
  labelSizeMM,
  zoom,
  templateKey,
  fitZoomTrigger,
  copyBrushActive,
  linkBrushActive
} = storeToRefs(store)

// ── Константы ─────────────────────────────────────────────────────────────────
const MM_TO_PX = 3.78
const SNAP_MM = 0.1 // шаг привязки — 0.1 мм

// Отступы от краёв контейнера до этикетки при авто-фите:
// padding контейнера = 24px + визуальный зазор = 24px → итого 48px с каждой стороны
const FIT_MARGIN = 48

// ── Ref на контейнер ──────────────────────────────────────────────────────────
const containerEl = ref<HTMLElement | null>(null)

// ── Авто-фит ──────────────────────────────────────────────────────────────────
function fitZoom() {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  const cw = rect.width
  const ch = rect.height
  if (cw === 0 || ch === 0) return

  const labelW = labelSizeMM.value.width * MM_TO_PX
  const labelH = labelSizeMM.value.height * MM_TO_PX

  const availW = cw - FIT_MARGIN * 2
  const availH = ch - FIT_MARGIN * 2
  if (availW <= 0 || availH <= 0) return

  // Math.min — подбираем коэффициент по меньшей стороне,
  // чтобы этикетка целиком поместилась в рабочую область
  const raw = Math.min(availW / labelW, availH / labelH)
  // Округляем до 0.1, зажимаем в допустимые пределы
  zoom.value = Math.min(9, Math.max(0.5, Math.round(raw * 10) / 10))
}

// Авто-фит при маунте (первый рендер)
onMounted(async () => {
  await nextTick()
  fitZoom()
  document.addEventListener('keydown', onArrowKey, true)
})

// Авто-фит при загрузке шаблона (templateKey меняется в applyTemplateData)
watch(templateKey, () => nextTick(fitZoom))

// Авто-фит при изменении размера этикетки (пользователь поменял W/H в панели)
watch(labelSizeMM, () => nextTick(fitZoom), { deep: true })

// Авто-фит по сигналу от LabelSizePanel (кнопка «вписать»)
watch(fitZoomTrigger, () => nextTick(fitZoom))

// ── Колёсико мыши — изменение зума ───────────────────────────────────────────
function onWheel(e: WheelEvent) {
  // e.preventDefault() уже вызван через @wheel.prevent в шаблоне
  const step = e.shiftKey ? 0.5 : 0.1 // Shift → крупный шаг
  const delta = e.deltaY < 0 ? step : -step
  zoom.value = Math.min(9, Math.max(0.5, Math.round((zoom.value + delta) * 10) / 10))
}

// ── Стрелки — перемещение блока на 0.1 мм ─────────────────────────────────────
function onArrowKey(e: KeyboardEvent) {
  // Если фокус на input/textarea — пропускаем (пользователь вводит текст)
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  // Если активен inline-редактор — не перехватываем (стрелки в textarea)
  if (editingId.value) return
  // Кисточка / связь — не мешаем
  if (copyBrushActive.value || linkBrushActive.value) return
  // Нет выбранного элемента
  if (!selectedId.value) return

  const pos = positions.value[selectedId.value]
  if (!pos) return

  let dx = 0
  let dy = 0
  switch (e.key) {
    case 'ArrowUp':
      dy = -0.1
      break
    case 'ArrowDown':
      dy = 0.1
      break
    case 'ArrowLeft':
      dx = -0.1
      break
    case 'ArrowRight':
      dx = 0.1
      break
    default:
      return // не стрелка
  }

  e.preventDefault() // предотвращаем скролл страницы

  store.updatePosition(selectedId.value, {
    x: pos.x + dx,
    y: pos.y + dy,
    w: pos.w,
    h: pos.h
  })
}

// ── мм ↔ px ───────────────────────────────────────────────────────────────────
function mmToPx(mm: number): number {
  return mm * MM_TO_PX * zoom.value
}
function pxToMm(px: number): number {
  return px / (MM_TO_PX * zoom.value)
}

const snapPx = computed(() => Math.max(1, Math.round(mmToPx(SNAP_MM))))

function posToPx(pos: ElementPosition) {
  const result = {
    x: Math.round(mmToPx(pos.x)),
    y: Math.round(mmToPx(pos.y)),
    w: Math.max(snapPx.value, Math.round(mmToPx(pos.w))),
    h: Math.max(snapPx.value, Math.round(mmToPx(pos.h)))
  }
  return result
}

// ── In-place text editing ──────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editingText = ref('')
const editInputEl = ref<HTMLTextAreaElement | null>(null)

function onStartEdit(id: string): void {
  const el = elements.value[id]
  if (!el || el.type !== 'text') return
  editingText.value = store.getDisplayText(el)
  editingId.value = id
  nextTick(() => {
    editInputEl.value?.focus()
    editInputEl.value?.select()
  })
}

function onSaveEdit(id: string, value: string): void {
  const el = elements.value[id]
  if (el && el.type === 'text') {
    el.props.customText = value || el.dataField
  }
  editingId.value = null
  editingText.value = ''
}

function onCancelEdit(): void {
  editingId.value = null
  editingText.value = ''
}

// ── Copy Brush (кисточка) / Link Brush (связь с barcode) ─────────────────────
function onElementClick(id: string): void {
  if (copyBrushActive.value) {
    store.applyCopyBrush(id)
  } else if (linkBrushActive.value) {
    store.applyLinkBrush(id)
  }
}
function onCanvasClick(): void {
  if (editingId.value) {
    onCancelEdit()
  }
  if (copyBrushActive.value) {
    store.deactivateCopyBrush()
  } else if (linkBrushActive.value) {
    store.deactivateLinkBrush()
  } else {
    selectedId.value = null
  }
}

// ── Подчистка при анмаунте ────────────────────────────────────────────────────
onUnmounted(() => {
  document.removeEventListener('keydown', onArrowKey, true)
})

// ── Drag / resize ─────────────────────────────────────────────────────────────
function onDragStop(id: string, xPx: number, yPx: number): void {
  const pos = positions.value[id]
  if (!pos) return
  store.updatePosition(id, { x: pxToMm(xPx), y: pxToMm(yPx), w: pos.w, h: pos.h })
}
function onResizeStop(id: string, xPx: number, yPx: number, wPx: number, hPx: number): void {
  store.updatePosition(id, { x: pxToMm(xPx), y: pxToMm(yPx), w: pxToMm(wPx), h: pxToMm(hPx) })
}

// ── Стили текстового блока (идентично htmlRenderer) ───────────────────────────
function getTextWrapperStyle(props: Record<string, any>): Record<string, string> {
  const tp = resolveTextProps(props as any)
  const z = zoom.value
  const padTop = (tp.paddingTop * MM_TO_PX * z).toFixed(2) + 'px'
  const padRight = (tp.paddingRight * MM_TO_PX * z).toFixed(2) + 'px'
  const padBottom = (tp.paddingBottom * MM_TO_PX * z).toFixed(2) + 'px'
  const padLeft = (tp.paddingLeft * MM_TO_PX * z).toFixed(2) + 'px'
  const alignItems =
    tp.verticalAlign === 'top'
      ? 'flex-start'
      : tp.verticalAlign === 'bottom'
        ? 'flex-end'
        : 'center'
  const justifyContent =
    tp.align === 'center' ? 'center' : tp.align === 'right' ? 'flex-end' : 'flex-start'
  return {
    display: 'flex',
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    overflow: 'hidden',
    alignItems,
    justifyContent,
    fontSize: tp.fontSize * z + 'px',
    lineHeight: String(tp.lineHeight),
    fontWeight: tp.bold ? 'bold' : 'normal',
    fontFamily: `'${tp.fontFamily}'`,
    padding: `${padTop} ${padRight} ${padBottom} ${padLeft}`,
    wordBreak: 'break-word',
    pointerEvents: 'none'
  }
}
function getTextSpanStyle(props: Record<string, any>): Record<string, string> {
  const tp = resolveTextProps(props as any)
  return { width: '100%', textAlign: tp.align, overflow: 'hidden', userSelect: 'none' }
}

function getTextEditorStyle(props: Record<string, any>): Record<string, string> {
  const tp = resolveTextProps(props as any)
  const z = zoom.value
  return {
    width: '100%',
    height: '100%',
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    fontFamily: `'${tp.fontFamily}'`,
    fontSize: tp.fontSize * z + 'px',
    lineHeight: String(tp.lineHeight),
    fontWeight: tp.bold ? 'bold' : 'normal',
    textAlign: tp.align as string,
    padding: '0',
    margin: '0',
    color: '#222',
    overflow: 'hidden',
    boxSizing: 'border-box'
  }
}
</script>

<template>
  <!--
    @wheel.prevent — перехватываем колёсико над рабочей областью.
    ref="containerEl" — нужен для вычисления размера при авто-фите.
  -->
  <div ref="containerEl" class="canvas-container" @wheel.prevent="onWheel">
    <!-- Белый лист этикетки -->
    <div
      class="canvas-label"
      :class="{
        'canvas-label--copy-brush': copyBrushActive,
        'canvas-label--link-brush': linkBrushActive
      }"
      :style="{
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px'
      }"
      @click.self="onCanvasClick"
    >
      <!-- :key включает zoom — VDR перечитывает размеры родителя при ремаунте -->
      <template v-for="(pos, id) in positions" :key="String(id)">
        <VueDraggableResizable
          v-if="elements[id]"
          :key="`${String(id)}-${zoom}`"
          :x="posToPx(pos).x"
          :y="posToPx(pos).y"
          :w="posToPx(pos).w"
          :h="posToPx(pos).h"
          :parent="true"
          :grid="[snapPx, snapPx]"
          :min-width="snapPx"
          :min-height="snapPx"
          :active="!copyBrushActive && selectedId === String(id)"
          :prevent-deactivation="true"
          class="label-el"
          :class="{
            'label-el--selected': !copyBrushActive && selectedId === String(id),
            'label-el--brush-target': copyBrushActive
          }"
          @activated="selectedId = String(id)"
          @click="onElementClick(String(id))"
          @drag-stop="(x: number, y: number) => onDragStop(String(id), x, y)"
          @resize-stop="
            (x: number, y: number, w: number, h: number) => onResizeStop(String(id), x, y, w, h)
          "
        >
          <!-- TEXT -->
          <div
            v-if="elements[id]?.type === 'text'"
            :style="getTextWrapperStyle(elements[id]?.props ?? {})"
          >
            <textarea
              v-if="editingId === String(id)"
              ref="editInputEl"
              v-model="editingText"
              class="el-text-editor"
              :style="getTextEditorStyle(elements[id]?.props ?? {})"
              @keydown.esc="onCancelEdit"
              @keydown.enter.ctrl="onSaveEdit(String(id), editingText)"
              @blur="onSaveEdit(String(id), editingText)"
              @mousedown.stop
              @pointerdown.stop
            />
            <span v-else :style="getTextSpanStyle(elements[id]?.props ?? {})">
              {{ store.getDisplayText(elements[id]!) }}
            </span>
          </div>

          <!-- BARCODE -->
          <div v-else-if="elements[id]?.type === 'barcode'" class="el-center">
            <img
              v-if="elements[id]?.props.customText"
              :src="elements[id]!.props.customText as string"
              style="max-width: 100%; max-height: 100%; object-fit: contain"
              alt="barcode"
            />
            <v-icon v-else size="22" color="#ccc">mdi-barcode</v-icon>
          </div>

          <!-- IMAGE -->
          <div v-else-if="elements[id]?.type === 'image'" class="el-center">
            <template v-if="elements[id]?.props.src">
              <div
                v-if="elements[id]!.props.src!.trimStart().startsWith('<svg')"
                style="
                  max-width: 100%;
                  max-height: 100%;
                  overflow: hidden;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
                v-html="elements[id]!.props.src"
              />
              <img
                v-else
                :src="elements[id]!.props.src"
                style="max-width: 100%; max-height: 100%; object-fit: contain"
                alt="image"
              />
            </template>
            <v-icon v-else size="22" color="#ccc">mdi-image-outline</v-icon>
          </div>

          <!-- ── Плавающая панель: ручка + корзинка ── -->
          <div
            v-if="
              !copyBrushActive &&
              !linkBrushActive &&
              selectedId === String(id) &&
              editingId !== String(id)
            "
            class="el-actions"
          >
            <!-- Редактировать (только для текста) -->
            <button
              v-if="elements[id]?.type === 'text'"
              class="el-actions__btn"
              title="Редактировать текст"
              @mousedown.stop
              @click.stop="onStartEdit(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <!-- Удалить -->
            <button
              class="el-actions__btn el-actions__btn--del"
              title="Удалить элемент"
              @mousedown.stop
              @click.stop="store.removeElement(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </VueDraggableResizable>
      </template>

      <!-- Размер этикетки -->
      <div class="canvas-badge canvas-badge--br">
        {{ labelSizeMM.width.toFixed(1) }} × {{ labelSizeMM.height.toFixed(1) }} мм
      </div>
      <!-- Текущий зум -->
      <div class="canvas-badge canvas-badge--tr">{{ Math.round(zoom * 100) }}%</div>
    </div>

    <!-- Подсказка об управлении зумом -->
    <div class="zoom-hint">
      <v-icon size="12" color="#aaa">mdi-mouse</v-icon>
      <span>колёсико — зум</span>
      <span class="zoom-hint-sep">·</span>
      <span>Shift + колёсико — ×5</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Контейнер-рабочая область ───────────────────────────────────────────────── */
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  overflow: auto;
  min-height: 0;
  cursor: default;

  /* Шахматный фон */
  background-color: #d8d8d8;
  background-image:
    linear-gradient(45deg, #c8c8c8 25%, transparent 25%),
    linear-gradient(-45deg, #c8c8c8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #c8c8c8 75%),
    linear-gradient(-45deg, transparent 75%, #c8c8c8 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
}

/* ── Лист этикетки ───────────────────────────────────────────────────────────── */
.canvas-label {
  position: relative;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #b0b0b0;
  border-radius: 3px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.18),
    0 1px 3px rgba(0, 0, 0, 0.1);
  user-select: none;
  -webkit-user-select: none;
}

/* ── Элемент на листе ────────────────────────────────────────────────────────── */
.label-el {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px dashed #ccc;
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
}
.label-el:hover {
  border-color: #1976d2;
  border-style: solid;
  box-shadow: 0 0 0 1px rgba(25, 118, 210, 0.18);
}
.label-el--selected {
  border: 1px solid #1976d2 !important;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.25) !important;
}

/* ── Плавающая панель с действиями ──────────────────────────────────────────── */
.el-actions {
  position: absolute;
  top: -22px;
  right: 0;
  display: flex;
  gap: 2px;
  z-index: 10;
  pointer-events: auto;
}
.el-actions__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid #1976d2;
  border-radius: 3px;
  background: #fff;
  color: #1976d2;
  cursor: pointer;
  padding: 0;
  transition:
    background 0.1s,
    color 0.1s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.el-actions__btn:hover {
  background: #1976d2;
  color: #fff;
}
.el-actions__btn--del {
  border-color: #c62828;
  color: #c62828;
}
.el-actions__btn--del:hover {
  background: #c62828;
  color: #fff;
}

/* ── Текстовый редактор на месте ─────────────────────────────────────────────── */
.el-text-editor {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  pointer-events: auto;
}
.el-text-editor:focus {
  background: rgba(255, 255, 255, 0.95) !important;
  box-shadow: inset 0 0 0 1px #1976d2;
}

/* ── Copy Brush ──────────────────────────────────────────────────────────────── */
.canvas-label--copy-brush {
  cursor: crosshair;
}
.label-el--brush-target {
  cursor: crosshair;
}
.label-el--brush-target:hover {
  border-color: #e65100 !important;
  border-style: solid !important;
  box-shadow: 0 0 0 2px rgba(230, 81, 0, 0.25) !important;
}

/* ── Link Brush (связь текста с barcode) ─────────────────────────────────────── */
.canvas-label--link-brush {
  cursor: crosshair;
}
.label-el--link-target {
  cursor: crosshair;
}
.label-el--link-target:hover {
  border-color: #283593 !important;
  border-style: solid !important;
  box-shadow: 0 0 0 2px rgba(40, 57, 147, 0.25) !important;
}

/* ── Центрирование для barcode / image ───────────────────────────────────────── */
.el-center {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  box-sizing: border-box;
}

/* ── Бейджи (размер + зум) ───────────────────────────────────────────────────── */
.canvas-badge {
  position: absolute;
  font-size: 10px;
  font-family: 'Consolas', monospace;
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 7px;
  border-radius: 10px;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.canvas-badge--br {
  bottom: 6px;
  right: 8px;
  color: #888;
}
.canvas-badge--tr {
  top: 6px;
  right: 8px;
  color: #1565c0;
  font-weight: 600;
}

/* ── Подсказка зума ──────────────────────────────────────────────────────────── */
.zoom-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #aaa;
  font-family: 'Segoe UI', system-ui, sans-serif;
  user-select: none;
  pointer-events: none;
  flex-shrink: 0;
}
.zoom-hint-sep {
  color: #ccc;
}
</style>
