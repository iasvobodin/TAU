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
  lastSavedPath.value ? (lastSavedPath.value.split(/[\\/]/).pop() ?? null) : null
)

function toggleBatch(val: boolean | null) {
  const enabled = val ?? false
  if (enabled && !hasSerialInTemplate.value) return
  batchPrintEnabled.value = enabled
}
</script>

<template>
  <div>
    <!-- Batch print toggle -->
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px">
      <h3 style="font-size: 14px; font-weight: 600; color: #666; margin: 0">Групповая печать</h3>
      <v-tooltip
        :text="!hasSerialInTemplate ? 'В шаблоне нет поля серийного номера' : ''"
        :disabled="hasSerialInTemplate"
        location="top"
      >
        <template #activator="{ props }">
          <span v-bind="props">
            <v-switch
              :model-value="batchPrintEnabled"
              :disabled="!hasSerialInTemplate"
              density="compact"
              hide-details
              color="primary"
              style="flex: none"
              @update:model-value="toggleBatch"
            />
          </span>
        </template>
      </v-tooltip>
    </div>

    <!-- Batch fields (conditional) -->
    <v-expand-transition>
      <div v-if="batchPrintEnabled">
        <!-- Common fields — динамически из шаблона -->
        <div v-if="templateTextFields.length" style="margin-bottom: 12px">
          <div style="font-size: 12px; color: #888; margin-bottom: 6px">
            Общие данные (одинаковые для всех этикеток)
          </div>
          <v-text-field
            v-for="field in templateTextFields"
            :key="field.dataField"
            v-model="batchCommonData[field.dataField]"
            :label="field.label"
            density="compact"
            hide-details
            class="mb-2"
          />
        </div>

        <v-divider class="mb-3" />

        <!-- Serials -->
        <div style="font-size: 12px; color: #888; margin-bottom: 6px">
          Серийные номера (каждый с новой строки)
        </div>
        <v-textarea
          v-model="batchSerialsText"
          placeholder="261200001-01&#10;261200002-01&#10;261200003-01"
          rows="4"
          density="compact"
          hide-details
        />
        <div style="font-size: 12px; color: #999; margin-top: 4px; text-align: right">
          {{ serials.length }} шт.
        </div>
      </div>

      <div v-else style="font-size: 12px; color: #999; padding: 4px 0 8px">
        Напечатает одну этикетку с текстом из шаблона
      </div>
    </v-expand-transition>

    <v-divider class="my-3" />

    <!-- Current file indicator -->
    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; min-height: 20px">
      <v-icon size="14" :color="currentFileName ? 'success' : 'grey'">
        {{ currentFileName ? 'mdi-file-check-outline' : 'mdi-file-outline' }}
      </v-icon>
      <span style="font-size: 12px" :style="{ color: currentFileName ? '#555' : '#999' }">
        {{ currentFileName ?? 'Шаблон не сохранён' }}
      </span>
    </div>

    <!-- Action buttons -->
    <div style="display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap">
      <v-btn size="small" color="error" variant="text" @click="store.clearTemplate">
        Очистить
      </v-btn>

      <v-divider vertical style="margin: 0 4px" />

      <v-btn
        size="small"
        color="secondary"
        variant="outlined"
        prepend-icon="mdi-folder-open-outline"
        @click="store.openTemplate"
      >
        Открыть
      </v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="outlined"
        prepend-icon="mdi-content-save-outline"
        @click="store.saveTemplate"
      >
        Сохранить
      </v-btn>
      <v-btn
        size="small"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-content-save-edit-outline"
        @click="store.saveTemplateAs"
      >
        Сохранить как…
      </v-btn>

      <v-divider vertical style="margin: 0 4px" />

      <v-tooltip
        location="top"
        :text="
          svgRenderEnabled
            ? 'SVG: текст и штрихкоды как векторные пути'
            : 'HTML: стандартный рендер'
        "
      >
        <template #activator="{ props: tp }">
          <v-btn
            v-bind="tp"
            size="small"
            :color="svgRenderEnabled ? 'deep-purple' : 'grey'"
            :variant="svgRenderEnabled ? 'tonal' : 'text'"
            icon
            @click="svgRenderEnabled = !svgRenderEnabled"
          >
            <v-icon size="16">mdi-vector-curve</v-icon>
          </v-btn>
        </template>
      </v-tooltip>

      <v-btn size="small" color="success" prepend-icon="mdi-printer" @click="store.printLabels">
        {{ batchPrintEnabled ? `Печать (${serials.length} шт.)` : 'Печать' }}
      </v-btn>
    </div>
  </div>
</template>
