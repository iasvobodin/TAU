<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const { labelSize, zoom, labelSizeInPx, realSizeInPx, gridStep, labelSizeMM } = storeToRefs(store)

// Количество ячеек = размер этикетки в мм / шаг сетки в мм
// Чисто UI-инфо, не хранится в шаблоне
const gridCols = computed(() => Math.max(1, Math.round(labelSizeMM.value.width / gridStep.value)))
const gridRows = computed(() => Math.max(1, Math.round(labelSizeMM.value.height / gridStep.value)))
</script>

<template>
  <div>
    <!-- Label size -->
    <div style="margin-bottom: 16px">
      <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
        Размер этикетки
      </h3>
      <div style="display: flex; gap: 16px; align-items: flex-end; flex-wrap: wrap">
        <div style="display: flex; gap: 8px; align-items: center">
          <div>
            <div style="font-size: 12px; margin-bottom: 4px">Ширина</div>
            <v-text-field
              v-model.number="labelSize.width"
              type="number"
              density="compact"
              style="width: 100px"
              hide-details
              @update:model-value="store.validateSize"
            />
          </div>
          <div>
            <div style="font-size: 12px; margin-bottom: 4px">Высота</div>
            <v-text-field
              v-model.number="labelSize.height"
              type="number"
              density="compact"
              style="width: 100px"
              hide-details
              @update:model-value="store.validateSize"
            />
          </div>
          <div>
            <div style="font-size: 12px; margin-bottom: 4px">Единицы</div>
            <v-select
              v-model="labelSize.unit"
              :items="['mm', 'px']"
              density="compact"
              style="width: 80px"
              hide-details
            />
          </div>
        </div>
        <div style="font-size: 12px; color: #666">
          {{ realSizeInPx.width.toFixed(0) }} × {{ realSizeInPx.height.toFixed(0) }} px
        </div>
      </div>
    </div>

    <!-- Grid step + Zoom -->
    <div style="display: flex; gap: 32px; align-items: flex-start; flex-wrap: wrap; margin: 16px 0">
      <!-- Шаг сетки -->
      <div>
        <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
          Шаг сетки
        </h3>
        <div style="display: flex; gap: 8px; align-items: center">
          <v-select
            v-model="gridStep"
            :items="[
              { title: '2 мм', value: 2 },
              { title: '1 мм', value: 1 },
              { title: '0.5 мм', value: 0.5 }
            ]"
            item-title="title"
            item-value="value"
            density="compact"
            style="width: 100px"
            hide-details
          />
          <div style="font-size: 12px; color: #999; white-space: nowrap">
            {{ gridCols }} × {{ gridRows }} ячеек
          </div>
        </div>
      </div>

      <!-- Масштаб -->
      <div style="flex: 1; min-width: 200px">
        <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">Масштаб</h3>
        <div style="display: flex; gap: 8px; align-items: center">
          <span style="font-size: 12px">🔍</span>
          <v-slider
            v-model="zoom"
            :min="0.5"
            :max="9"
            :step="0.1"
            density="compact"
            hide-details
            style="flex: 1"
          />
          <span style="font-size: 12px; min-width: 40px">{{ Math.round(zoom * 100) }}%</span>
          <div style="font-size: 12px; color: #666; white-space: nowrap">
            {{ labelSizeInPx.width.toFixed(0) }} × {{ labelSizeInPx.height.toFixed(0) }} px
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
