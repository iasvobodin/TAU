<script setup lang="ts">
import { printPassport } from '@/assets/docxProcessor'
import { storage } from '@neutralinojs/lib'
import { onMounted, ref } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
const partNumber = ref('')
const serialNumber = ref('')
const convertDone = ref(false)
const errorStore = useErrorStore()


errorStore.disableErrorOutput()
const getStorageData = async () => {
  partNumber.value = await storage.getData('partNumber')
  serialNumber.value = await storage.getData('serialNumber')
}

onMounted(async () => {
  try {
    await getStorageData()
    convertDone.value = await printPassport(partNumber.value, serialNumber.value)
  } catch (error) {
    console.log(error)
  }
  errorStore.enableErrorOutput()
})
</script>

<template>
  <embed
    v-if="convertDone"
    :src="`http://127.0.0.1:8080/convertFolder/${partNumber}__${serialNumber}.pdf`"
    type="application/pdf"
  />
  <v-container v-else class="text-center pa-6">
    <h3 class="text-center">Подготовка паспорта <br> {{ partNumber }} <br> SN {{ serialNumber }}</h3>
    <!-- Оверлей с лоадером -->
    <v-skeleton-loader class="mx-auto border mt-6" type="image, article, table"></v-skeleton-loader>
  </v-container>
</template>

<style scoped>
body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}
embed {
  width: 100%;
  height: 100vh;
}
</style>
