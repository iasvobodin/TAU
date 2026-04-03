<script setup lang="ts">
import { useLabelEditorStore } from '@/stores/labelEditor'

import LabelSizePanel from './label-editor/LabelSizePanel.vue'
import AddElementPanel from './label-editor/AddElementPanel.vue'
import ElementPropsPanel from './label-editor/ElementPropsPanel.vue'
import LabelCanvas from './label-editor/LabelCanvas.vue'
import PrintDataPanel from './label-editor/PrintDataPanel.vue'
import SVGeditor from './label-editor/SVGeditor.vue'

const store = useLabelEditorStore()
</script>

<template>
  <div
    style="
      height: fit-content;
      display: flex;
      flex-direction: column;
      padding: 16px;
      background: #f5f5f5;
    "
  >
    <!-- TOP PANEL -->
    <div
      style="
        background: white;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        overflow-y: auto;
        /* max-height: 60%; */
      "
    >
      <LabelSizePanel />

      <v-divider />

      <div style="margin: 16px 0">
        <AddElementPanel />
      </div>

      <v-divider />

      <div style="margin-top: 16px">
        <ElementPropsPanel />
      </div>

      <!-- CANVAS -->
      <LabelCanvas />

      <!-- PRINT DATA + ALL ACTIONS -->
      <div style="margin-top: 16px">
        <v-divider class="my-2" />
        <PrintDataPanel />
      </div>
    </div>
  </div>
</template>

<style>
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
