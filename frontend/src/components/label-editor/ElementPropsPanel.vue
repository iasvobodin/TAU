<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'

const store = useLabelEditorStore()
const { selectedElement, selectedId } = storeToRefs(store)

function onTextInput(value: string) {
  if (selectedElement.value?.type === 'text') {
    selectedElement.value.props.customText = value
  }
}
</script>

<template>
  <div>
    <div v-if="selectedElement">
      <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
        Настройки:
        {{
          selectedElement.type === 'text'
            ? 'Текст'
            : selectedElement.type === 'barcode'
              ? 'Штрихкод'
              : 'Изображение'
        }}
        <span style="font-size: 12px; color: #999; margin-left: 8px">
          (ID: {{ selectedElement.dataField }})
        </span>
      </h3>

      <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center">
        <!-- Text settings -->
        <template v-if="selectedElement.type === 'text'">
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px">Размер шрифта:</span>
            <v-text-field
              v-model.number="selectedElement.props.fontSize"
              type="number"
              density="compact"
              style="width: 80px"
              hide-details
            />
            <span style="font-size: 11px; color: #666">px</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px">Выравнивание:</span>
            <v-select
              v-model="selectedElement.props.align"
              :items="['left', 'center', 'right']"
              density="compact"
              style="width: 100px"
              hide-details
            />
          </div>
          <v-checkbox
            v-model="selectedElement.props.bold"
            label="Жирный"
            density="compact"
            hide-details
          />
          <div style="width: 100%; margin-top: 8px">
            <div style="font-size: 12px; margin-bottom: 4px; color: #666">Текст:</div>
            <v-textarea
              :model-value="store.getDisplayText(selectedElement)"
              rows="3"
              density="compact"
              hide-details
              auto-grow
              @update:model-value="onTextInput"
            />
          </div>
        </template>

        <!-- Barcode settings -->
        <template v-if="selectedElement.type === 'barcode'">
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px">Тип:</span>
            <v-select
              v-model="selectedElement.props.barcodeType"
              :items="['code128', 'datamatrix']"
              density="compact"
              style="width: 120px"
              hide-details
              @update:model-value="store.updateBarcode(selectedId!)"
            />
          </div>

          <!-- Code128 settings -->
          <template v-if="selectedElement.props.barcodeType === 'code128'">
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Высота (px):</span>
              <v-text-field
                v-model.number="selectedElement.props.barcodeHeight"
                type="number"
                density="compact"
                style="width: 80px"
                hide-details
                @update:model-value="store.updateBarcode(selectedId!)"
              />
            </div>
          </template>

          <!-- DataMatrix settings -->
          <template v-if="selectedElement.props.barcodeType === 'datamatrix'">
            <div style="display: flex; align-items: center; gap: 8px">
              <span style="font-size: 12px">Масштаб:</span>
              <v-text-field
                v-model.number="selectedElement.props.barcodeScale"
                type="number"
                step="1"
                density="compact"
                style="width: 80px"
                hide-details
                @update:model-value="store.updateBarcode(selectedId!)"
              />
            </div>
          </template>

          <!-- Test value -->
          <div style="display: flex; align-items: center; gap: 8px; flex: 1">
            <span style="font-size: 12px">Тестовое значение:</span>
            <v-text-field
              v-model="selectedElement.props.testValue"
              placeholder="Значение для проверки"
              density="compact"
              style="flex: 1"
              hide-details
              @update:model-value="store.updateBarcode(selectedId!)"
            />
          </div>
        </template>

        <!-- Image settings -->
        <template v-if="selectedElement.type === 'image'">
          <div style="display: flex; align-items: center; gap: 8px; flex: 1">
            <span style="font-size: 12px">URL изображения:</span>
            <v-text-field
              v-model="selectedElement.props.src"
              placeholder="https://example.com/image.png"
              density="compact"
              style="flex: 1"
              hide-details
            />
          </div>
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 12px">Ширина (px):</span>
            <v-text-field
              v-model.number="selectedElement.props.imageWidth"
              type="number"
              density="compact"
              style="width: 80px"
              hide-details
            />
          </div>
        </template>
      </div>
    </div>

    <div v-else style="color: #999; font-size: 12px; text-align: center">
      Нажмите на элемент, чтобы настроить его свойства
    </div>
  </div>
</template>
