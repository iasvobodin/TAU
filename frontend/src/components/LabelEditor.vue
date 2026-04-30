<script setup lang="ts">
import { useLabelEditorStore } from '@/stores/labelEditor'
import LabelSizePanel from './label-editor/LabelSizePanel.vue'
import AddElementPanel from './label-editor/AddElementPanel.vue'
import ElementPropsPanel from './label-editor/ElementPropsPanel.vue'
import LabelCanvas from './label-editor/LabelCanvas.vue'
import PrintDataPanel from './label-editor/PrintDataPanel.vue'
import { FontManager } from '@/assets/font-manager-chatgpt'

// const manager = new FontManager()

// async function startApp() {
//   await manager.init()
//   await manager.scan()
//   const fonts = manager.getFonts()
//   console.log(`Loaded ${fonts.length} fonts.`)
// }

// startApp()

// const fontManager = new FontManager()

// async function startApp() {
//   await fontManager.init()
// }

// startApp()

const store = useLabelEditorStore()
</script>

<template>
  <!--
    Двухколоночный layout:
      Левая колонка — фиксированная ширина, все панели управления, скролл внутри
      Правая колонка — канвас занимает всё оставшееся пространство

    Такой подход полностью исключает сдвиг канваса при раскрытии/закрытии
    панели настроек выбранного элемента.
  -->
  <div style="display: flex; height: 100vh; overflow: hidden; background: #f5f5f5; gap: 0">
    <!-- ── Левая панель (фиксированная ширина) ── -->
    <div
      style="
        width: 340px;
        min-width: 340px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-right: 1px solid #e0e0e0;
        background: white;
      "
    >
      <!-- Верхняя часть — настройки и добавление элементов, скроллится -->
      <div style="flex: 1; overflow-y: auto; padding: 12px">
        <LabelSizePanel />

        <v-divider class="my-3" />

        <AddElementPanel />

        <v-divider class="my-3" />

        <!-- Действия с шаблоном -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end">
          <v-btn size="x-small" color="error" variant="text" @click="store.clearTemplate">
            Очистить
          </v-btn>
          <v-btn
            size="x-small"
            color="secondary"
            variant="outlined"
            prepend-icon="mdi-folder-open-outline"
            @click="store.openTemplate"
          >
            Открыть
          </v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="outlined"
            prepend-icon="mdi-content-save-outline"
            @click="store.saveTemplate"
          >
            Сохранить
          </v-btn>
          <v-btn
            size="x-small"
            color="primary"
            variant="tonal"
            prepend-icon="mdi-content-save-edit-outline"
            @click="store.saveTemplateAs"
          >
            Сохранить как…
          </v-btn>
        </div>
      </div>

      <!-- Нижняя часть — настройки выбранного элемента.
           Фиксированная высота, не влияет на положение канваса. -->
      <div
        style="
          border-top: 2px solid #e8e8e8;
          background: #fafafa;
          min-height: 160px;
          max-height: 300px;
          overflow-y: auto;
          padding: 12px;
          flex-shrink: 0;
        "
      >
        <ElementPropsPanel />
      </div>
    </div>

    <!-- ── Правая часть — канвас + печать ── -->
    <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0">
      <!-- Канвас занимает всё доступное пространство -->
      <div style="flex: 1; overflow: auto; min-height: 0">
        <LabelCanvas />
      </div>

      <!-- Панель печати — фиксированная снизу -->
      <div
        style="
          border-top: 1px solid #e0e0e0;
          background: white;
          padding: 12px 16px;
          overflow-y: auto;
          max-height: 320px;
          flex-shrink: 0;
        "
      >
        <PrintDataPanel />
      </div>
    </div>
  </div>
</template>

<style>
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #888;
}
</style>
