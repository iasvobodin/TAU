<script setup lang="ts">
import { fetchCheckList, updateCheckList } from '@/api/checkListServices'
import type { Specification } from '@/assets/interfaces'
import { fetchSpecifications } from '@/api/specificationServices'
import CheckListView from './CheckListView.vue'
import DefectsView from './DefectsView.vue'
import { server, filesystem, os, events, window as neuWindow } from '@neutralinojs/lib'
import { onMounted, shallowRef, ref, watch } from 'vue'
import SettingsView from './SettingsView.vue'
import AdminLog from '../AdminLog.vue'
import ClientsApp from '../ClientsApp.vue'
import OrderToProduction from './OrderToProduction.vue'
import { getClients } from '@/api/userServices'

// import { printDocxFile } from '@/assets/printer'

// Интерфейс для клиента
interface Client {
  clientId: string
  lastActive: string // ISO-строка даты
}

// Интерфейс для структуры ответа API
interface ClientsResponse {
  count: number
  clients: Client[]
}

const clientsData = ref<ClientsResponse | null>(null)

// Заголовки таблицы
const headers = [
  { title: 'ID Клиента', key: 'clientId' },
  { title: 'Последняя активность', key: 'lastActive' }
]

// Форматирование даты
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const dialog = ref(false)
const closeDialogAndCheck = () => {
  dialog.value = false
}

// .tmp\print-label.html
const print = () => {
  console.log('print')

  // printDocxFile('.tmp/DC.docx')
  //     .then(() => console.log('✔️ Печать завершена.'))
  //     .catch((err) => console.error('Ошибка при печати:', err));
}

const current = shallowRef(CheckListView)

const selectComponent = (component: string) => {
  dialog.value = true
  current.value = componentsMap[component] || null
}

const componentsMap: Record<string, any> = {
  checklist: CheckListView,
  defects: DefectsView,
  settings: SettingsView,
  znp: OrderToProduction
}

const templateCheckList = ref('')
const doTemplate = async (e: string) => {
  try {
    await updateCheckList(selectedSP.value.split(' ')[0], {
      checkListTemplate: e
    })
    console.log('event', e)
  } catch (error) {
    console.log(error)
  }

  templateCheckList.value = e
}
const specifications = ref<Specification[] | null>(null)
const selectedSP = ref('')
const templateFromServer = ref('')
const checkListFromServer = ref<Specification['checkList'][] | null>(null)
const getSpecification = async () => {
  try {
    const sp = await fetchSpecifications()
    if (sp.data) {
      specifications.value = sp.data
      console.log(sp.data)

      checkListFromServer.value = specifications.value?.map((e) => e.checkList)
    }
  } catch (error) {
    console.log(error)
  }
}

watch(
  () => selectedSP.value,
  async (newValue) => {
    if (newValue) {
      //попробовать запросить чек лист
      try {
        const result = await fetchCheckList(newValue.split(' ')[0])
        console.log(newValue.split(' ')[0], result.data)
        if (result.data?.checkListTemplate) {
          templateFromServer.value = result.data?.checkListTemplate
          templateCheckList.value = result.data?.checkListTemplate
          console.log(templateCheckList.value, templateFromServer.value)
        } else {
          templateFromServer.value = ''
          templateCheckList.value = ''
        }
      } catch (e) {
        console.error('Invalid template string:', e)
      }
    }
  },
  { immediate: true }
)

onMounted(async () => {
  const result = await getClients()
  if (result.data) {
    clientsData.value = result.data
  }

  // await getSpecification()
})

const files = ref<filesystem.DirectoryEntry[]>([])
const pdfData = ref<ArrayBuffer>()

const serverMount = async () => {
  // await server.mount('/KD', '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/КД');
  try {
    await server.mount('/KD', './KD')
    console.log('server is mounted on /KD')
    await server.mount('/.temp', './temp')
    console.log('server is mounted on /KD')
  } catch (error) {
    console.log(error)
  }
  // await server.mount('/KD', '/KD');
  // await server.mount('/KD', './KD');
  // await events.on('trayMenuItemClicked', onTrayMenuItemClicked);
}

const readFile = async () => {
  pdfData.value = await filesystem.readBinaryFile(window.NL_PATH + '/temp/1.pdf')
  console.log(pdfData.value)
}

const copyDir = async () => {
  try {
    await filesystem.readDirectory(window.NL_PATH + '/KD')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/KD')
  }
  await filesystem.copy(
    '\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\КД',
    window.NL_PATH + '/KD'
  )
}

const openFile = async () => {
  console.log(window.NL_PATH)
  // await filesystem.createDirectory(window.NL_PATH + '/app-res');
  files.value = await filesystem.readDirectory(
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/КД'
  )
  console.log('Content: ', files.value)
  let fileId = await filesystem.openFile(files.value[1].path)
  console.log(`ID: ${fileId}`)
}

const createFile = async () => {
  const htmlContent = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Viewer</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      embed {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <embed src="http://127.0.0.1:8080/KD/19.5389.101.00 СБ.pdf" type="application/pdf" />
  </body>
  </html>
`
  // Функция для конвертации строки в Uint8Array
  function stringToUint8Array(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str)
  }

  // Преобразуем HTML в Uint8Array
  const data = stringToUint8Array(htmlContent)
  try {
    await filesystem.readDirectory(window.NL_PATH + '/temp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/temp')
  }

  // Запись файла в Neutralino
  try {
    await filesystem.writeBinaryFile(window.NL_PATH + '/temp/pdf-viewer.html', data)
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  }
  try {
    // Открываем новое окно
    await neuWindow.create('/temp/pdf-viewer.html', {
      x: 0,
      y: 0,
      width: 800,
      height: 650,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: false,
      processArgs: '--window-id=W_PDF'
    })
  } catch (error) {
    console.log(error)
  }
}

const createWindow = async () => {
  // Открываем новое окно
  await neuWindow.create('/temp/pdf-viewer.html', {
    x: 0,
    y: 0,
    width: 800,
    height: 650,
    maximizable: false,
    exitProcessOnClose: true,
    enableInspector: false,
    processArgs: '--window-id=W_PDF'
  })
}

const newRenderPDF = async () => {
  // Функция для конвертации строки в ArrayBuffer
  function stringToArrayBuffer(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str).buffer // Возвращаем ArrayBuffer напрямую
  }
  console.log(pdfData.value)

  // Преобразуем ArrayBuffer в Blob
  const blob = new Blob([pdfData.value!], { type: 'application/pdf' })
  console.log(blob)
  // Создаем URL для Blob
  const pdfUrl = URL.createObjectURL(blob)
  console.log(pdfUrl)

  // Создаем HTML-страницу с встроенным PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PDF Viewer</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }
        embed {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <embed src="${pdfUrl}" type="application/pdf" />
    </body>
    </html>
  `
  console.log(htmlContent)

  // Преобразуем HTML-строку в ArrayBuffer
  const htmlArrayBuffer = stringToArrayBuffer(htmlContent)

  try {
    await filesystem.readDirectory(window.NL_PATH + '/temp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/temp')
  }

  // Запись файла в Neutralino
  try {
    await filesystem.writeBinaryFile(window.NL_PATH + '/temp/pdf-viewer.html', htmlArrayBuffer)
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  }
}

const createPDFJS = async () => {
  // Функция для конвертации строки в ArrayBuffer
  function stringToArrayBuffer2(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str).buffer
  }

  // Ваш PDF в ArrayBuffer
  const pdfArrayBuffer2 = pdfData.value!

  // HTML-контент с использованием pdf.js
  const htmlContent2 = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Viewer with pdf.js</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      #pdf-canvas {
      display: block;
      object-fit: cover;
        width: 100%;
        height: 100%;
      }
    </style>
    <!-- Подключаем pdf.js из CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"><\/script>
  </head>
  <body>
    <canvas id="pdf-canvas"></canvas>
    <script>
  async function renderPDF(pdfData) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.id = 'pdf-canvas-' + pageNum;
      document.body.appendChild(canvas);
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    }
  }

  const pdfData = new Uint8Array([${new Uint8Array(pdfArrayBuffer2).join(',')}]);
  renderPDF(pdfData);
    <\/script>
  </body>
  </html>
`

  // Преобразуем HTML в ArrayBuffer
  const htmlArrayBuffer2 = stringToArrayBuffer2(htmlContent2)

  try {
    await filesystem.readDirectory(window.NL_PATH + '/temp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/temp')
  }

  // Записываем файл
  await filesystem.writeBinaryFile(window.NL_PATH + '/temp/pdf-viewer.html', htmlArrayBuffer2)
}

const tab = ref(null)
</script>

<template>
  <h1>DEV</h1>

  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('checklist')">
          Создание и редактирование чеклистов для функциональных тестов
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('defects')"> Работа с браком </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('znp')">
          Работа с заказом на производство
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('settings')">
          Настройки приложения
        </v-btn>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog :fullscreen="true" v-model="dialog" width="100%">
    <v-toolbar color="white" density="compact">
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialogAndCheck">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card>
      <component :is="current" />
      <template v-slot:actions> </template>
    </v-card>
  </v-dialog>
  <ClientsApp />
  <AdminLog />

  <!-- <button @click="readFile">readFile</button>
  <button @click="serverMount">mount server</button>
  <button @click="openFile">openFile</button>
  <button @click="createFile">createFile</button>
  <button @click="createWindow">createWindow</button>
  <button @click="copyDir">copyDir</button>
  {{ files }} -->
  <!-- <v-btn color="success" @click="getSpecification" >getSpecification</v-btn> -->

  <!-- <button @click="print">printDocxFile</button> -->
</template>
