<template>
  <div class="label-editor">
    <aside class="label-editor__sidebar">
      <!-- Настройки таблицы -->
      <v-card variant="outlined">
        <v-card-title class="text-subtitle-2 pa-3">Настройки таблицы</v-card-title>
        <v-divider />
        <v-card-text class="pt-3">
          <v-row dense>
            <v-col cols="6">
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
            <v-col cols="6">
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
            <v-col cols="6">
              <v-text-field
                v-model.number="s.cellWidthMm"
                label="Ширина (мм)"
                type="number"
                min="5"
                step="0.5"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col cols="6">
              <v-text-field
                v-model.number="s.cellHeightMm"
                label="Высота (мм)"
                type="number"
                min="5"
                step="0.5"
                density="compact"
                variant="outlined"
                hide-details
              />
            </v-col>
            <v-col cols="6">
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
            <v-col cols="6">
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
            <v-col cols="12">
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
            <v-col cols="12" class="d-flex align-center">
              <v-checkbox
                v-model="s.showBorders"
                label="Границы ячеек"
                density="compact"
                hide-details
              />
            </v-col>
            <v-col cols="12">
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
            <v-col cols="12">
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

      <!-- Настройки ячейки — место зарезервировано всегда -->
      <v-card variant="outlined" class="label-editor__cell-panel">
        <v-card-title class="text-subtitle-2 pa-3">
          Настройки ячейки
          <span v-if="selectedCell" class="text-caption text-medium-emphasis ml-2">
            [{{ selectedCell.row + 1 }}, {{ selectedCell.col + 1 }}]
          </span>
        </v-card-title>
        <v-divider />
        <v-card-text class="pt-3">
          <template v-if="cell">
            <v-row dense>
              <!-- Выравнивание — одна строка вверху -->
              <v-col cols="12" class="d-flex align-center gap-2 pb-1">
                <v-btn-toggle
                  v-model="cell.horizontalAlignment"
                  @update:model-value="recalc"
                  density="compact"
                  variant="outlined"
                  mandatory
                >
                  <v-btn value="left" icon="mdi-format-align-left" size="small" />
                  <v-btn value="center" icon="mdi-format-align-center" size="small" />
                  <v-btn value="right" icon="mdi-format-align-right" size="small" />
                </v-btn-toggle>

                <v-divider vertical class="mx-1" style="height: 28px" />

                <v-btn-toggle
                  v-model="cell.verticalAlignment"
                  @update:model-value="recalc"
                  density="compact"
                  variant="outlined"
                  mandatory
                >
                  <v-btn value="top" icon="mdi-format-align-top" size="small" />
                  <v-btn value="center" icon="mdi-format-align-middle" size="small" />
                  <v-btn value="bottom" icon="mdi-format-align-bottom" size="small" />
                </v-btn-toggle>
              </v-col>

              <!-- Размер шрифта -->
              <v-col cols="12">
                <v-text-field
                  v-model.number="cell.fontSizeMm"
                  @update:model-value="recalc"
                  label="Размер шрифта (мм)"
                  type="number"
                  min="0.5"
                  step="0.1"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>

              <!-- Межсимвольный интервал -->
              <v-col cols="12">
                <v-text-field
                  v-model.number="cell.letterSpacing"
                  @update:model-value="recalc"
                  label="Межсимвольный интервал (px)"
                  type="number"
                  min="-10"
                  step="0.5"
                  density="compact"
                  variant="outlined"
                  hide-details
                />
              </v-col>

              <!-- Межстрочный интервал -->
              <v-col cols="12">
                <v-text-field
                  v-model.number="cell.lineHeightMultiplier"
                  @update:model-value="recalc"
                  label="Межстрочный интервал"
                  type="number"
                  min="0.8"
                  max="4"
                  step="0.05"
                  density="compact"
                  variant="outlined"
                  hide-details
                  hint="1.0 = вплотную, 1.2 = стандарт"
                  persistent-hint
                />
              </v-col>
            </v-row>
          </template>

          <template v-else>
            <div class="label-editor__cell-placeholder">
              <v-icon icon="mdi-cursor-pointer" size="24" class="mb-2 text-disabled" />
              <span class="text-caption text-disabled">Выберите ячейку в таблице</span>
            </div>
          </template>
        </v-card-text>
      </v-card>
    </aside>

    <main class="label-editor__canvas">
      <TableEditor />
      <SvgPreview />
    </main>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'
import TableEditor from './svg-editor/Tableeditor.vue'
import SvgPreview from './svg-editor/Svgpreview.vue'

const store = useSvgEditorStore()
const { settings: s, selectedCell, selectedCellData: cell } = storeToRefs(store)

const recalc = () => {
  if (selectedCell.value) {
    store.recalcCell(selectedCell.value.row, selectedCell.value.col)
  }
}

const onFontFile = (f: File | File[] | null) => {
  const file = Array.isArray(f) ? f[0] : f
  if (!file) return
  file.arrayBuffer().then((buf) => store.loadFontFromBuffer(buf, file.name.replace(/\.[^.]+$/, '')))
}

onMounted(async () => {
  await store.loadDefaultFont()
})
</script>

<style scoped>
.label-editor {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.label-editor__sidebar {
  flex: 0 0 260px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

.label-editor__canvas {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.label-editor__cell-panel {
  min-height: 320px;
}

.label-editor__cell-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 160px;
}
</style>
