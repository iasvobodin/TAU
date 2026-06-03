<script setup lang="ts">
import { useLabelEditorStore } from '@/stores/labelEditor'
const store = useLabelEditorStore()
</script>

<template>
  <div>
    <h3 style="margin-bottom: 12px; font-size: 14px; font-weight: 600; color: #666">
      Добавить элемент
    </h3>
    <div style="display: flex; gap: 8px; flex-wrap: wrap">
      <v-btn size="small" color="primary" variant="outlined" @click="store.addElement('text')">
        + Текст
      </v-btn>
      <v-btn size="small" color="warning" variant="outlined" @click="store.addElement('barcode')">
        + Штрихкод
      </v-btn>
      <v-btn size="small" color="success" variant="outlined" @click="store.addElement('image')">
        + Изображение
      </v-btn>
    </div>
  </div>
</template>
