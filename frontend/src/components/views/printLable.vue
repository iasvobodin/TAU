<script setup lang="ts">
import { storage, events, os, server, filesystem, init, app } from '@neutralinojs/lib'
import { onUnmounted, onMounted, computed, watch, ref, type Ref, reactive } from 'vue'
import { useErrorStore } from '@/stores/errorStore'
import { mountServer } from '@/assets/utils/mountServer'

const errorStore = useErrorStore()
const serverPath = ref('')
const serverPoint = ref('')
const pdfName = ref('')
const fileExist = ref(false)
errorStore.disableErrorOutput()

const getStorageData = async () => {
  serverPath.value = await storage.getData('serverPath')
  pdfName.value = await storage.getData('pdfName')
  serverPoint.value = await storage.getData('serverPoint')
}

async function handleBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  await server.unmount(serverPoint.value)
}

const getData = async () => {
  try {
    await getStorageData()
    await mountServer(serverPath.value, serverPoint.value)
    const stats = await filesystem.getStats(`${serverPath.value}/${pdfName.value}`)
    console.log(stats, 'stats', serverPath.value)

    if (stats.isFile) {
      fileExist.value = true
    }
  } catch (error) {
    console.log(error)
  }
}

const createWatcher = async () => {
  if (!serverPath.value.startsWith('//')) {
    console.log('данные не с сервера,нужен watcher')
    const watcherId = await filesystem.createWatcher(`${serverPath.value}`)
    events.on('watchFile', (evt) => {
      if (watcherId == evt.detail.id) {
        if (evt.detail.filename === pdfName.value) {
          console.log('вот он файл, можно менять состояние')
          fileExist.value = true
        }
        console.log(evt.detail)
      }
    })
    console.log(`ID: ${watcherId}`)
  }
}

onMounted(async () => {
  window.addEventListener('beforeunload', handleBeforeUnload)
  await getData()
  await createWatcher()
  errorStore.enableErrorOutput()
})
</script>

<template>
  <embed
    v-if="fileExist"
    :src="`http://127.0.0.1:8080${serverPoint}/${pdfName}`"
    type="application/pdf"
  />
  <v-container v-else class="text-center pa-6">
    <h3 class="text-center">
      Подготовка файла<br />
      {{ pdfName }}
    </h3>
    <!-- Оверлей с лоадером -->
    <v-skeleton-loader class="mx-auto border mt-6" type="article, table"></v-skeleton-loader>
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
  width: 100vw;
  height: 99vh;
}
</style>
