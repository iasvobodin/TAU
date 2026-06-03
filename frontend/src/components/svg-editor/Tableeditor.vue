<template>
  <v-card variant="outlined" class="mb-4">
    <v-card-text class="pa-2 overflow-auto">
      <table v-if="tableData.length" class="label-editor-table">
        <tr v-for="(row, ri) in tableData" :key="ri">
          <TableCell v-for="(cell, ci) in row" :key="ci" :cell="cell" :row="ri" :col="ci" />
        </tr>
      </table>

      <div v-else class="d-flex align-center justify-center text-medium-emphasis py-10">
        <v-icon icon="mdi-table-plus" class="mr-2" />
        Нажмите «Создать таблицу» для начала работы
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'
import TableCell from './Tablecell.vue'

const store = useSvgEditorStore()
const { tableData } = storeToRefs(store)
</script>

<style scoped>
.label-editor-table {
  border-collapse: collapse;
}
</style>
