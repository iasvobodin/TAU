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
const { positions, elements, selectedId, labelSizeInPx, labelSizeMM, zoom, templateKey } =
  storeToRefs(store)

// ── Константы ─────────────────────────────────────────────────────────────────
const MM_TO_PX = 3.78
const SNAP_MM = 0.1 // шаг привязки — 0.1 мм
const FIT_PADDING = 48 // px-зазор вокруг этикетки при авто-фите

// ── Ref на контейнер ──────────────────────────────────────────────────────────
const containerEl = ref<HTMLElement | null>(null)

// ── Авто-фит ──────────────────────────────────────────────────────────────────
function fitZoom() {
  if (!containerEl.value) return
  const cw = containerEl.value.clientWidth
  const ch = containerEl.value.clientHeight
  if (cw === 0 || ch === 0) return

  const labelW = labelSizeMM.value.width * MM_TO_PX
  const labelH = labelSizeMM.value.height * MM_TO_PX

  const raw = Math.min((cw - FIT_PADDING * 2) / labelW, (ch - FIT_PADDING * 2) / labelH)
  // Округляем до 0.1, зажимаем в допустимые пределы
  zoom.value = Math.min(9, Math.max(0.5, Math.round(raw * 10) / 10))
}

// Авто-фит при маунте (первый рендер)
onMounted(async () => {
  await nextTick()
  fitZoom()
})

// Авто-фит при загрузке шаблона (templateKey меняется в applyTemplateData)
watch(templateKey, () => nextTick(fitZoom))

// Авто-фит при изменении размера этикетки (пользователь поменял W/H в панели)
watch(labelSizeMM, () => nextTick(fitZoom), { deep: true })

// ── Колёсико мыши — изменение зума ───────────────────────────────────────────
function onWheel(e: WheelEvent) {
  // e.preventDefault() уже вызван через @wheel.prevent в шаблоне
  const step = e.shiftKey ? 0.5 : 0.1 // Shift → крупный шаг
  const delta = e.deltaY < 0 ? step : -step
  zoom.value = Math.min(9, Math.max(0.5, Math.round((zoom.value + delta) * 10) / 10))
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
  return {
    x: Math.round(mmToPx(pos.x)),
    y: Math.round(mmToPx(pos.y)),
    w: Math.max(snapPx.value, Math.round(mmToPx(pos.w))),
    h: Math.max(snapPx.value, Math.round(mmToPx(pos.h)))
  }
}

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
  return { width: '100%', textAlign: tp.align, overflow: 'hidden' }
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
      :style="{
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px'
      }"
      @click.self="selectedId = null"
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
          :active="selectedId === String(id)"
          :prevent-deactivation="true"
          class="label-el"
          :class="{ 'label-el--selected': selectedId === String(id) }"
          @activated="selectedId = String(id)"
          @drag-stop="(x: number, y: number) => onDragStop(String(id), x, y)"
          @resize-stop="
            (x: number, y: number, w: number, h: number) => onResizeStop(String(id), x, y, w, h)
          "
          @dblclick="store.removeElement(String(id))"
        >
          <!-- TEXT -->
          <div
            v-if="elements[id]?.type === 'text'"
            :style="getTextWrapperStyle(elements[id]?.props ?? {})"
          >
            <span :style="getTextSpanStyle(elements[id]?.props ?? {})">
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
}

/* ── Элемент на листе ────────────────────────────────────────────────────────── */
.label-el {
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
