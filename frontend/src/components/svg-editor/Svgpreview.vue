<template>
  <v-card v-if="svgContent" variant="outlined">
    <v-card-title class="d-flex align-center justify-space-between pa-3">
      <span class="text-subtitle-2">Предпросмотр SVG</span>
      <span class="text-caption text-medium-emphasis">
        {{ svgWidthMm.toFixed(1) }} × {{ svgHeightMm.toFixed(1) }} мм
      </span>
    </v-card-title>
    <v-divider />
    <v-card-text>
      <div class="svg-preview-container" v-html="svgContent" />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        @click="store.downloadSVG()"
        color="primary"
        variant="tonal"
        prepend-icon="mdi-download"
      >
        Сохранить SVG
      </v-btn>
    </v-card-actions>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'

const store = useSvgEditorStore()
const { svgContent, svgWidthMm, svgHeightMm } = storeToRefs(store)
</script>

<style scoped>
.svg-preview-container {
  overflow: auto;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  padding: 12px;
  display: flex;
  justify-content: center;
}
.svg-preview-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
