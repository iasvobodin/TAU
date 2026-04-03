<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { GridLayout as GridLayoutComponent, GridItem } from 'vue3-grid-layout'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const { layout, elements, selectedId, labelSizeInPx, labelSize, zoom, gridConfig, gridCols } =
  storeToRefs(store)
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
    "
  >
    <div
      class="label-canvas"
      :style="{
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px',
        backgroundColor: '#fff',
        border: '1px solid #c0c0c0',
        borderRadius: '4px',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        transition: 'all 0.2s ease'
      }"
    >
      <GridLayoutComponent
        v-model:layout="layout"
        :col-num="gridCols"
        :row-height="gridConfig.rowHeight"
        :is-draggable="true"
        :is-resizable="true"
        :vertical-compact="false"
        :use-css-transforms="false"
        :margin="[0, 0]"
        style="height: 100%; width: 100%"
        @item-resized="store.onItemResized"
        @item-moved="store.onItemMoved"
      >
        <GridItem
          v-for="item in layout"
          :key="item.i"
          v-bind="item"
          @click.stop="selectedId = item.i"
        >
          <div
            class="grid-item"
            :class="{ 'grid-item-selected': selectedId === item.i }"
            @dblclick="store.removeElement(item.i)"
          >
            <!-- TEXT -->
            <div
              v-if="elements[item.i]?.type === 'text'"
              class="element-content"
              :style="{
                fontSize: (elements[item.i]?.props.fontSize ?? 12) * zoom + 'px',
                lineHeight: 1.2,
                fontWeight: elements[item.i]?.props.bold ? 'bold' : 'normal',
                textAlign: elements[item.i]?.props.align
              }"
            >
              <div style="width: 100%; height: 100%; display: flex; align-items: center">
                {{ store.getDisplayText(elements[item.i]!) }}
              </div>
            </div>

            <!-- BARCODE -->
            <div v-else-if="elements[item.i]?.type === 'barcode'" class="element-content">
              <div style="text-align: center">
                <img
                  v-if="elements[item.i]?.props.customText"
                  :src="elements[item.i]!.props.customText as string"
                  style="max-width: 100%; max-height: 100%; object-fit: contain"
                  alt="barcode"
                />
              </div>
            </div>

            <!-- IMAGE -->
            <div v-else-if="elements[item.i]?.type === 'image'" class="element-content">
              <div
                v-if="elements[item.i]?.props.src"
                style="
                  width: 100%;
                  height: 100%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
              >
                <img
                  :src="elements[item.i]!.props.src"
                  style="max-width: 100%; max-height: 100%; object-fit: contain"
                  alt="image"
                />
              </div>
              <div v-else style="color: #999; text-align: center">🖼️<br />Изображение</div>
            </div>
          </div>
        </GridItem>
      </GridLayoutComponent>

      <div class="size-info">
        {{ labelSize.width }} × {{ labelSize.height }} {{ labelSize.unit }}
      </div>
      <div v-if="zoom !== 1" class="zoom-badge">🔍 {{ Math.round(zoom * 100) }}%</div>
    </div>
  </div>
</template>

<style scoped>
.grid-item {
  border: 1px solid #ddd;
  background: white;
  height: 100%;
  width: 100%;
  cursor: pointer;
  transition: all 0.15s;
  overflow: auto;
  border-radius: 2px;
}

.grid-item:hover {
  border-color: #1976d2;
  background: #f8f9ff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.grid-item-selected {
  border: 2px solid #1976d2;
  background: #e3f2fd;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.2);
}

.element-content {
  padding: 4px;
  height: 100%;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
  overflow: auto;
  position: relative;
}

.size-info {
  position: absolute;
  bottom: 4px;
  right: 8px;
  font-size: 10px;
  color: #666;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  font-family: monospace;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.zoom-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  font-size: 10px;
  color: #1976d2;
  background: rgba(255, 255, 255, 0.95);
  padding: 2px 6px;
  border-radius: 4px;
  pointer-events: none;
  font-weight: bold;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.label-canvas {
  position: relative;
  transition: all 0.2s ease;
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
