<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-2 pa-3">Настройки таблицы</v-card-title>
    <v-divider />
    <v-card-text class="pt-3">
      <v-row dense>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.rows"
            label="Строки"
            type="number"
            min="1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.columns"
            label="Столбцы"
            type="number"
            min="1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.cellWidthMm"
            label="Ширина ячейки (мм)"
            type="number"
            min="5"
            step="0.5"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.cellHeightMm"
            label="Высота ячейки (мм)"
            type="number"
            min="5"
            step="0.5"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.cellPaddingHorizontalMm"
            label="Отступ гор. (мм)"
            type="number"
            min="0"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.cellPaddingVerticalMm"
            label="Отступ верт. (мм)"
            type="number"
            min="0"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3">
          <v-text-field
            v-model.number="s.globalFontSizeMm"
            @update:model-value="store.applyGlobalFontSize()"
            label="Размер шрифта (мм)"
            type="number"
            min="0.5"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="3" class="d-flex align-center">
          <v-checkbox
            v-model="s.showBorders"
            label="Границы ячеек"
            density="compact"
            hide-details
          />
        </v-col>
      </v-row>

      <v-row dense class="mt-2">
        <v-col cols="12" sm="7">
          <v-file-input
            :model-value="null"
            @update:model-value="onFontFile"
            label="Загрузить шрифт"
            accept=".ttf,.otf,.woff,.woff2"
            :hint="store.fontName"
            persistent-hint
            density="compact"
            variant="outlined"
            prepend-icon=""
            prepend-inner-icon="mdi-format-font"
            clearable
          />
        </v-col>
        <v-col cols="12" sm="5" class="d-flex align-center">
          <v-btn
            @click="store.generateTable()"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-table-plus"
            block
          >
            Создать таблицу
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'
import { useFont } from '@/assets/utils/UseFont'

const store = useSvgEditorStore()
const { settings: s } = storeToRefs(store)
const { loadFromFile } = useFont()

const onFontFile = (f: File | File[] | null) => {
  const file = Array.isArray(f) ? f[0] : f
  if (file) loadFromFile(file)
}
</script>
