<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'
import LabelPrintMulty from '../LabelPrintMulty.vue'
import PrintPassports from '../printPassports.vue'
import LabelEditor from '../LabelEditor.vue'
const counterStore = useCounterStore()
</script>

<template>
  <v-container>
    <h1>Настройки приложения</h1>
    <v-row>
      <v-col align-self="center">
        <p>Разблокировать кнопки на этапе производства</p>
      </v-col>
      <v-col> <v-checkbox hide-details v-model="counterStore.settings"></v-checkbox></v-col>
    </v-row>
    <hr />
  </v-container>
  <LabelPrintMulty />
  <PrintPassports />
  <v-container>
    <v-row>
      <v-col align-self="center">
        <LabelEditor />
      </v-col>
    </v-row>
  </v-container>
</template>
