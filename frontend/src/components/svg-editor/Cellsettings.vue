<template>
  <v-card v-if="cell" variant="outlined" class="mb-4">
    <v-card-title class="text-subtitle-2 pa-3">
      Ячейка [{{ selectedCell!.row + 1 }}, {{ selectedCell!.col + 1 }}]
    </v-card-title>
    <v-divider />
    <v-card-text class="pt-3">
      <v-row dense>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="cell.fontSizeMm"
            @update:model-value="store.recalcCell(selectedCell!.row, selectedCell!.col)"
            label="Размер шрифта (мм)"
            type="number"
            min="0.5"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="6" sm="4">
          <v-text-field
            v-model.number="cell.letterSpacing"
            @update:model-value="store.recalcCell(selectedCell!.row, selectedCell!.col)"
            label="Межсимвольный интервал"
            type="number"
            min="-5"
            step="0.1"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
        <v-col cols="12" sm="4">
          <v-select
            v-model="cell.verticalAlignment"
            @update:model-value="store.recalcCell(selectedCell!.row, selectedCell!.col)"
            :items="alignItems"
            label="Выравнивание"
            density="compact"
            variant="outlined"
            hide-details
          />
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'

const store = useSvgEditorStore()
const { selectedCell, selectedCellData: cell } = storeToRefs(store)

const alignItems = [
  { title: 'По верхнему краю', value: 'top' },
  { title: 'По центру', value: 'center' },
  { title: 'По нижнему краю', value: 'bottom' }
]
</script>
