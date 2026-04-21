<script setup lang="ts">
/**
 * LabelCanvas — канвас-адаптер для vue-draggable-resizable.
 * Единственный файл который знает про библиотеку и конвертирует мм ↔ px.
 *
 * Контракт со store:
 *   Читает:  positions (мм), elements, selectedId, labelSizeInPx, zoom, gridStep, labelSizeMM
 *   Пишет:   store.updatePosition(id, ElementPosition в мм), store.selectedId, store.removeElement
 */
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import VueDraggableResizable from 'vue-draggable-resizable'
import 'vue-draggable-resizable/style.css'
import { useLabelEditorStore } from '@/stores/labelEditor'
import type { ElementPosition } from '@/types/label'

const store = useLabelEditorStore()
const { positions, elements, selectedId, labelSizeInPx, labelSizeMM, zoom, gridStep } =
  storeToRefs(store)

// ── мм ↔ px ──────────────────────────────────────────────────────────────────
const MM_TO_PX = 3.78
function mmToPx(mm: number): number {
  return mm * MM_TO_PX * zoom.value
}
function pxToMm(px: number): number {
  return px / (MM_TO_PX * zoom.value)
}

// Шаг snap-сетки в px
const snapPx = computed(() => Math.max(1, Math.round(mmToPx(gridStep.value))))

// px-позиция для библиотеки, вычисляется из мм
function posToPx(pos: ElementPosition) {
  return {
    x: Math.round(mmToPx(pos.x)),
    y: Math.round(mmToPx(pos.y)),
    w: Math.max(1, Math.round(mmToPx(pos.w))),
    h: Math.max(1, Math.round(mmToPx(pos.h)))
  }
}

// ── Ключ для принудительного перемонтирования при смене зума ─────────────────
// vue-draggable-resizable кэширует размер родителя при mount.
// При изменении zoom родитель меняет px-размер → нужно перемонтировать
// чтобы библиотека пересчитала границы.
// Позиции восстанавливаются из мм → px корректно.

// ── Обработчики событий библиотеки ───────────────────────────────────────────
function onDragStop(id: string, xPx: number, yPx: number): void {
  const pos = positions.value[id]
  if (!pos) return
  store.updatePosition(id, { x: pxToMm(xPx), y: pxToMm(yPx), w: pos.w, h: pos.h })
}

function onResizeStop(id: string, xPx: number, yPx: number, wPx: number, hPx: number): void {
  store.updatePosition(id, { x: pxToMm(xPx), y: pxToMm(yPx), w: pxToMm(wPx), h: pxToMm(hPx) })
}
</script>

<template>
  <div
    class="canvas-container"
    style="
      flex: 1;
      background: #e0e0e0;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      overflow: auto;
      min-height: 0;
    "
  >
    <div
      :style="{
        position: 'relative',
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px',
        flexShrink: 0,
        backgroundColor: '#fff',
        border: '1px solid #c0c0c0',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }"
      @click.self="selectedId = null"
    >
      <!-- :key включает zoom — при смене масштаба компонент ремонтируется
           и vue-draggable-resizable перечитывает px-размер родителя -->
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
          class="label-element"
          :class="{ 'label-element--selected': selectedId === String(id) }"
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
            class="element-content"
            :style="{
              fontSize: (elements[id]?.props.fontSize ?? 12) * zoom + 'px',
              lineHeight: 1.2,
              fontWeight: elements[id]?.props.bold ? 'bold' : 'normal',
              textAlign: elements[id]?.props.align,
              fontFamily: elements[id]?.props.fontFamily ?? 'Arial'
            }"
          >
            {{ store.getDisplayText(elements[id]!) }}
          </div>

          <!-- BARCODE -->
          <div v-else-if="elements[id]?.type === 'barcode'" class="element-content">
            <img
              v-if="elements[id]?.props.customText"
              :src="elements[id]!.props.customText as string"
              style="max-width: 100%; max-height: 100%; object-fit: contain"
              alt="barcode"
            />
          </div>

          <!-- IMAGE -->
          <div v-else-if="elements[id]?.type === 'image'" class="element-content">
            <template v-if="elements[id]?.props.src">
              <!-- Сырой SVG-текст (вставлен вручную) — рендерим inline -->
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
              <!-- URL / data URL (файл выбран через диалог) -->
              <img
                v-else
                :src="elements[id]!.props.src"
                style="max-width: 100%; max-height: 100%; object-fit: contain"
                alt="image"
              />
            </template>
            <div v-else style="color: #999; text-align: center; font-size: 12px">
              🖼️<br />Изображение
            </div>
          </div>
        </VueDraggableResizable>
      </template>

      <div class="size-info">
        {{ labelSizeMM.width.toFixed(0) }} × {{ labelSizeMM.height.toFixed(0) }} мм
      </div>
      <div v-if="zoom !== 1" class="zoom-badge">🔍 {{ Math.round(zoom * 100) }}%</div>
    </div>
  </div>
</template>

<style scoped>
.label-element {
  border: 1px solid #ddd;
  background: white;
  border-radius: 2px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
}
.label-element:hover {
  border-color: #1976d2;
  background: #f8f9ff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.label-element--selected {
  border: 2px solid #1976d2 !important;
  background: #e3f2fd !important;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2) !important;
}
.element-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  word-break: break-word;
  overflow: hidden;
  pointer-events: none;
}
.size-info {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 10px;
  color: #666;
  font-family: monospace;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.zoom-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 10px;
  color: #1976d2;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
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
</style>
