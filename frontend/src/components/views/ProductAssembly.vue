<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import ProductInformation from '@/components/ProductInformation.vue'
import DefectDialog from '@/components/views/DefectDialog.vue'
import { updateComponent } from '@/api/componentServices'
import { updateProduct } from '@/api/productServices'
import { patchDocument, TextRun, PatchType } from 'docx'
import { createProductionOperationPassed } from '@/api/productionOperationServices'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import type { Component, Prisma } from '../../../../shared/src'
import { useUserStore } from '@/stores/user'
import type { ModulesType, Barcodes, ProductType, StageType, Tsp } from '@/assets/interfaces'
import { findFileInDirectory } from '@/assets/utils/findFileInDirectory'
import { printLabel } from '@/assets/printLabel'
import { printPassport } from '@/assets/docxProcessor'
import {
  server,
  filesystem,
  os,
  storage,
  events,
  window as neuWindow,
  resources
} from '@neutralinojs/lib'
import { createDefectHistory } from '@/api/defectHistoryServices'
import { openSecondWindow } from '@/assets/utils/openSecondWindow'
import { useCounterStore } from '@/stores/counter'
import { useWebSocketStore } from '@/stores/websockets'

const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()
const counterStore = useCounterStore()
const webSocketStore = useWebSocketStore()
const userStore = useUserStore()
const productionOperationAlarm = ref('') // предупреждение об удалении операции!
const pattern = /^\d{8}(-\d{2})?$/
const serialNumber = ref('')
const defectDialog = ref(false)
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const disabledAction = ref(false) //переменная на блокировку кнопок
const stageType: StageType = 'assembly'
const comment = ref('')
const assemblyPassedDialog = ref(false)
const checkLable = ref(false)
const checkPasport = ref(false)
const OK_PATH = import.meta.env.VITE_OK_PATH as string
const KD_PATH = import.meta.env.VITE_KD_PATH as string
const OTHER_PATH = import.meta.env.VITE_OTHER_PATH as string

const findPartNumberInSpecification = (item: string) => {
  return props.product.productPartNumbers.find((e) => e === item)
}

const findSerialNumberInAdded = (item: string) => {
  console.log('here', props.product.productSerialNumbers, item)
  return props.product.productSerialNumbers.find((e) => e === item)
}

const hasProdductionOperation = (stageType: string) => {
  //ищем по ключу наличие производственных операций
  const stage = props.product.productionOperations.some((e) => e.stageType === stageType)
  if (stage) {
    return ' - Операция выполнена'
  }
  return false
}

const checkSerialNumber = async ($event: Event) => {
  const target = $event.target as HTMLTextAreaElement
  const result = await fetchComponent(target.value)
  if (!result.data) {
    serialNumber.value = ''
    return
  } else if (result.data.status === 'on_hold') {
    errorStore.addError(`Данный компонент забракован`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
    return
  } else if (!findPartNumberInSpecification(result.data.pnComponentId)) {
    errorStore.addError(
      `Данный компонент ${result.data.pnComponentId} не соответствует спецификации ${props.product.productSerialNumbers}`
    )
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else if (result.data.snProductId) {
    errorStore.addError(
      `Данный компонент уже используется в другом модуле ${result.data.snProductId}`
    )
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else if (result.data.snProductId === props.product.snProduct) {
    errorStore.addError(`Данный компонент уже используется в этом модуле`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else if (findSerialNumberInAdded(serialNumber.value)) {
    console.log('уже добавлен')
    errorStore.addError(`Данный компонент уже добавлен`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else {
    for (const [key, value] of Object.entries(props.product.specification)) {
      if (value.PN === result.data.pnComponentId) {
        console.log(key, 'консоль ключа, нужно проверить что это плата чтобы забрать серийник')
        if (props.product.information['Тип изделия'] === 'TerminalBlocks') {
          if (key.toLowerCase().includes('плата 1')) {
            console.log('то что надо для клеммника')
          }
        }
        value.SN = result.data.snComponent
        props.product.productSerialNumbers.push(value.SN)
      }
    }
    console.log('COMPARE')
    errorStore.addInfo(`Компонент ${result.data.snComponent} успешно добавлен`)
    setTimeout(errorStore.removeInfo, 5000)
    serialNumber.value = ''
  }
}

watch(
  props.product.specification,
  () => {
    if (props.product.specification) {
      disabledAction.value = Object.values(props.product.specification).every(
        (item) => item.SN !== null && item.SN !== undefined && item.SN !== ''
      )
    } else {
      disabledAction.value = false
    }
  },
  {
    immediate: true
  }
)

const assemblyPassed = async () => {
  const productionOperatioData = {
    stageType,
    status: 'passed',
    user: useUserStore().userFullName,
    productId: props.product.snProduct,
    usedComponents: props.product.productSerialNumbers.join(', ')
  }

  try {
    await createProductionOperationPassed(productionOperatioData)
  } catch (error) {
    throw new Error('ошибка createProductionOperationPassed')
  }

  const promises = props.product.productSerialNumbers.map(async (component) => {
    try {
      await updateComponent(component, {
        status: 'passed',
        snProductId: props.product.snProduct
      })
    } catch (error) {
      throw new Error('ошибка обновления компонентов')
    }
  })

  await Promise.all(promises)
  emit('done')
}

const assemblyFailed = async (failedComponents: string[], comment: string) => {
  // делаем как будто всё прошло
  await assemblyPassed()
  //находим операцию маркировки, тоже меняем он холд
  // const { id } = props.product.productionOperations.find((e) => e.stageType === 'marking') as {
  //   id: number
  // }

  // try {
  //   await updateProductionOperation(id, {
  //     status: 'on_hold'
  //   })
  // } catch (error) {
  //   console.log(error)
  //   throw new Error('jopa')
  // }
  // получаем все бракованные компоненты, и создаём дефект хистори
  const promises = failedComponents.map(async (fComponent) => {
    // создаём дефект хистори на каждый компонент

    try {
      const dh = await createDefectHistory({
        componentSN: fComponent,
        actionType: 'DetectDefect',
        status: 'on_hold',
        user: useUserStore().userFullName,
        description: comment
      })
      console.log('создали дефект хистори', dh.data)
    } catch (error) {
      console.log(error)
    }

    // меняем все статусы у бракованных компонентов на on_hold

    try {
      await updateComponent(fComponent, {
        status: 'on_hold'
        // snProductId: null
      })
    } catch (error) {
      console.log(error)
      return
    }
    //чистим пропсы, хз можно так или нет

    for (const key in props.product.specification) {
      console.log('чистим пропсы')

      if (props.product.specification[key].SN === fComponent) {
        props.product.specification[key].SN = ''
      }
    }

    props.product.productSerialNumbers = props.product.productSerialNumbers.filter(
      (serial) => serial !== fComponent
    )
  })

  try {
    await updateProduct(props.product.snProduct, {
      comment: 'on_hold'
    })
    console.log('что-то обновили')
  } catch (error) {
    console.log(error)
  }
  await Promise.all(promises)

  // завершаем функцию
  emit('done')
}

// const printLabelDeffect = async () => {
//   const modifiedInformation = JSON.parse(
//     JSON.stringify(props.information)
//   ) as ProductType['information']
//   const modifiedProduct = JSON.parse(JSON.stringify(props.product)) as Tsp
//   modifiedProduct.information['Тип изделия'] = 'Defective'
//   const p2 = { product: modifiedProduct, information: modifiedInformation }
//   console.log(p2)
//   await printLabel(p2)
// }

const serialNumberInput = ref<InstanceType<typeof import('vuetify/components').VTextField> | null>(
  null
)

const readFile = async () => {
  const OK = props.product.template.RE
  const pdfData = await filesystem.readBinaryFile(
    `\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\Операционные карты\\${OK}.pdf`
  )
  console.log(pdfData)
}

const openPdfInHtml = async () => {
  const OK = props.product.template.RE
  const pdfPath = `\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\Операционные карты\\${OK}.pdf`

  let pdfData
  try {
    pdfData = await filesystem.readBinaryFile(pdfPath)
    console.log('PDF-файл успешно прочитан')
  } catch (error) {
    console.error('Ошибка при чтении PDF:', error)
    return
  }

  try {
    await filesystem.readDirectory(`${window.NL_PATH}/.tmp`)
  } catch (error) {
    await filesystem.createDirectory(`${window.NL_PATH}/.tmp`)
  }

  const tempPdfPath = `${window.NL_PATH}/.tmp/temp.pdf`
  try {
    await filesystem.writeBinaryFile(tempPdfPath, pdfData)
    console.log('PDF сохранён во временный файл')
  } catch (error) {
    console.error('Ошибка при сохранении PDF:', error)
    return
  }

  const pdfUrl = `http://127.0.0.1:8080/.tmp/temp.pdf`
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

  const stringToUint8Array = (str: string) => {
    const encoder = new TextEncoder()
    return encoder.encode(str)
  }
  const htmlData = stringToUint8Array(htmlContent)

  try {
    await filesystem.writeBinaryFile(`${window.NL_PATH}/.tmp/pdf-viewer.html`, htmlData)
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании HTML-файла:', error)
    return
  }

  try {
    await neuWindow.create('/.tmp/pdf-viewer.html', {
      title: props.product.template.RE,
      x: 0,
      y: 0,
      maximize: true,
      width: 800,
      height: 650,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: false,
      processArgs: '--window-id=W_PDF'
    })
    console.log('Окно с PDF открыто')
  } catch (error) {
    console.error('Ошибка при открытии окна:', error)
  }
}

const openFile = async () => {
  await openPdfInHtml()
  const OK = props.product.template.RE
  os.execCommand(
    `explorer "\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\Операционные карты\\${OK}.pdf"`
  )
}

const openFileKD = async () => {
  // await openPdfInHtml()
  const KD = props.product.checkList?.doc_ConstructKD
  os.execCommand(
    `explorer "\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\КД\\${KD}.pdf"`
  )
}

function normalizeUncPath(input: string): string {
  let path = input.trim()

  // Убираем ведущие двойные слэши // в начале
  if (path.startsWith('//')) {
    path = path.slice(2)
  }

  // Заменяем одинарные прямые слэши на одиночные обратные
  path = path.replace(/\//g, '\\')

  // Добавляем двойной обратный слэш в начале
  path = '\\\\' + path

  return path
}

const openFileOK = async () => {
  const OK = props.product.checkList?.doc_AssebbleOK
  console.log(OK)

  if (OK) {
    const fileEntry = await findFileInDirectory(OK, OK_PATH)
    if (fileEntry) {
      const path = normalizeUncPath(fileEntry?.path)
      console.log(fileEntry, 'fileEntry', path)
      os.execCommand(`explorer "${path}"`)
    }
  }
}

const openFileFromNet = async (
  fileName: string | null | undefined = '',
  dir: string,
  serverPoint: string
): Promise<void> => {
  if (typeof fileName === 'string') {
    try {
      const fileEntry = await findFileInDirectory(fileName, dir)
      console.log(fileEntry, fileName, dir)

      if (!fileEntry) {
        console.warn('File not found in directory')
        return
      }
      // const normalizedPath = normalizeUncPath(fileEntry.path)
      await openSecondWindow(dir, fileEntry.entry, serverPoint)

      // await os.execCommand(`explorer "${normalizedPath}"`)
    } catch (error) {
      console.error('Failed to open file:', error)
      throw error
    }
  } else {
    console.log('не указан параметр поиска')
    return
  }
}
const openFileOK2 = async () => {
  const fileName = props.product.checkList?.doc_AssebbleOK

  if (!fileName) {
    console.warn('Файл не указан в checkList.doc_AssebbleOK')
    return
  }

  const baseDir =
    '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Операционные карты/ОК PDF'

  try {
    const fileEntry = await findFileInDirectory(fileName, baseDir)

    if (!fileEntry) {
      console.warn(`Файл "${fileName}" не найден в директории.`)
      return
    }

    const uncPath = normalizeUncPath(fileEntry.path)
    console.log('Открытие файла:', uncPath)

    os.execCommand(`explorer "${uncPath}"`)
  } catch (error) {
    console.error('Ошибка при открытии файла:', error)
  }
}

const runVbsConversion = async (docxFileName: string) => {
  const tmpDir = `${window.NL_PATH}/.tmp`
  const tmpVbsPath = `${tmpDir}/convert.vbs`
  const command = `cscript //nologo "${tmpVbsPath}" "${docxFileName}"`

  try {
    // 1. Читаем VBS-файл из ресурсов
    const vbsContent = await resources.readFile('/frontend/dist/convert.vbs')

    // 2. Пишем во временную папку
    await filesystem.writeFile(tmpVbsPath, vbsContent)

    // 3. Выполняем VBS-скрипт
    const result = await os.execCommand(command)

    console.log('stdout:', result.stdOut)
    console.log('stderr:', result.stdErr)
    console.log('exitCode:', result.exitCode)

    if (result.exitCode !== 0) {
      console.error('Script execution failed')
    }

    // 4. (опционально) удаляем скрипт
    // await filesystem.removeFile(tmpVbsPath)
  } catch (error) {
    console.error('Ошибка при запуске VBS-конвертации:', error)
  }
}

const printPasport = async (partNumber: string) => {
  const searchKey = 'плата 2'

  const result = Object.entries(props.product.specification).find(([key]) =>
    key.includes(searchKey)
  )

  var snValue = result?.[1]?.SN

  // Обрезаем последние 3 символа, если значение есть и длина >= 3
  if (snValue && snValue.length >= 3) {
    snValue = snValue.slice(0, -3)
  }

  function getCurrentMonthYear(): string {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0') // Месяцы от 0 до 11, добавляем 1
    const year = now.getFullYear()
    return `${month}.${year}`
  }

  try {
    const dirTAU = await filesystem.readDirectory(
      '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/Паспорта'
    )

    const filteredFile = dirTAU.find(
      (item) => item.type === 'FILE' && item.entry.includes(partNumber)
    )

    if (!filteredFile) throw new Error('Файл с таким partNumber не найден')

    const newPath = filteredFile.path
      .replace(/^\/\//, '\\\\') // заменить // на \\
      .replace(/\//g, '\\') // заменить все / на \

    // console.log(newPath);

    // os.execCommand(`explorer "${newPath}"`);

    const pdfData = await filesystem.readBinaryFile(`${newPath}`)

    // Определяем патчи
    const patches = {
      serialnumber: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(`${snValue}`)]
      },
      currentdate: {
        type: PatchType.PARAGRAPH,
        children: [new TextRun(getCurrentMonthYear())]
      }
    }

    const patchedArrayBuffer = await patchDocument({
      outputType: 'arraybuffer',
      data: pdfData,
      patches: patches
    })
    try {
      await filesystem.writeBinaryFile(
        window.NL_PATH + `/.tmp/${filteredFile.entry}`,
        patchedArrayBuffer
      )
      console.log('пропатчилось')
    } catch (error) {
      console.log(error)
    }

    await runVbsConversion(filteredFile.entry)

    // const fileName = filteredFile.entry; // Пример: "MP3222X1-BA1_Модуль.docx"
    // const tmpPath = `${window.NL_PATH}/.tmp`; // Папка, где лежат и скрипт, и файл

    // const scriptPath = `${tmpPath}/convert.vbs`.replace(/\//g, '\\');
    // const inputFileName = fileName.replace(/\//g, '\\'); // Только имя, без пути

    // const command = `cscript //nologo "${scriptPath}" "${inputFileName}"`;
    // console.log("Выполняем:", command);

    // os.execCommand(command)
    //   .then((result) => {
    //     console.log("stdout:", result.stdOut);
    //     console.log("stderr:", result.stdErr);
    //     console.log("exitCode:", result.exitCode);

    //     if (result.exitCode !== 0) {
    //       console.error("Script ended with error.");
    //     }
    //   })
    //   .catch((err) => {
    //     console.error("Command execution failed:", err);
    //   });

    // try {
    //   os.execCommand(command)

    // } catch (error) {
    //   console.log(error);

    // }
    console.log('filteredFile.entry:', filteredFile.entry)
  } catch (error) {
    console.error(error)
  }
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
    <embed src="http://127.0.0.1:8080/.tmp/MP3241X1-BA1_Модуль последовательного интерфейса.pdf" type="application/pdf" />
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

  // try {
  //   await filesystem.readDirectory(window.NL_PATH + '/.tmp')
  // } catch (error) {
  //   await filesystem.createDirectory(window.NL_PATH + '/.tmp')
  // }

  // Запись файла в Neutralino
  try {
    await filesystem.writeBinaryFile(window.NL_PATH + '/.tmp/pdf-viewer.html', data)
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  }
  try {
    // Открываем новое окно
    await neuWindow.create('/.tmp/pdf-viewer.html', {
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
// Чтение серийного номера с обрезкой последних 3 символов
const getSerialNumber = (specification: Tsp['specification'], moduleType: ModulesType): string => {
  let snValue: string | undefined
  if (moduleType === 'PowerSupply') {
    snValue = Object.entries(specification).find(([key]) => key.includes('плата 1'))?.[1]?.SN
  } else {
    snValue = Object.entries(specification).find(([key]) => key.includes('плата 2'))?.[1]?.SN
  }

  return snValue && snValue.endsWith('-02') ? snValue.slice(0, -3) : snValue || ''
}

// const openPrintPassportWindow = async (partNumber: string, serialNumber: string) => {
//   const isDev = import.meta.env.MODE === 'development'
//   const baseUrl = isDev ? 'http://localhost:5173' : '/index.html'

//   const part = encodeURIComponent(partNumber)
//   const serial = encodeURIComponent(serialNumber)
//   const hashPath = `#/print-pdf?partNumber=${part}&serialNumber=${serial}`

//   const fullUrl = `${baseUrl}/${encodeURI(hashPath)}`

//   await neuWindow.create("http://localhost:5173/#/print-pdf?partNumber=42&serialNumber=ABC", {
//      x: 0,
//       y: 0,
//     width: 700,
//     height: 950,
//     enableInspector: true,
//     exitProcessOnClose: true,
//   })
// }

const openPrintPassportWindow = async (): Promise<void> => {
  //внутренние данные зависят от модуля
  const partNumber = props.information?.['Артикул изделия']
  if (!partNumber) {
    console.log('нет артикула')
    return
  }
  const serialNumber = getSerialNumber(
    props.product.specification,
    props.information?.['Тип изделия']
  )
  if (serialNumber === '') {
    console.log('нет SN')
    return
  }
  const pdfName = `${partNumber}__${serialNumber}.pdf`
  try {
    await openSecondWindow('./convertFolder', pdfName, '/convertFolder')

    await printPassport(partNumber, serialNumber)
  } catch (error) {
    console.log(error)
  }
}

onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Сборка {{ hasProdductionOperation(stageType) || '' }}</h1>
      </v-col>
    </v-row>
  </v-container>

  <ProductInformation :information="props.product.information" />
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>Документация</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-container>
            <v-row v-if="props.product.checkList?.doc_AssebbleOK">
              <v-col>
                <v-btn
                  @click="openFileFromNet(product.checkList?.doc_AssebbleOK, OK_PATH, '/OK')"
                  color="blue"
                  block
                  >Открыть операционную карту</v-btn
                >
              </v-col>
            </v-row>
            <v-row v-if="props.product.checkList?.doc_ConstructKD">
              <v-col>
                <v-btn
                  @click="openFileFromNet(product.checkList?.doc_ConstructKD, KD_PATH, '/KD')"
                  color="blue"
                  block
                >
                  Открыть КД
                </v-btn>
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-btn @click="openFileFromNet('TSC', OTHER_PATH, '/OTHER')" color="blue" block
                  >Открыть руководство принтером</v-btn
                >
              </v-col>
            </v-row>
          </v-container>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
  <v-container>
    <v-row align="center" justify="center">
      <v-col cols="5">Отсканируйте штрих-код компонента</v-col>
      <v-col cols="6">
        <v-text-field
          :disabled="!!hasProdductionOperation(stageType)"
          ref="serialNumberInput"
          @click:clear="component = null"
          density="compact"
          clearable
          @keyup.enter="checkSerialNumber"
          v-model="serialNumber"
          label="Сканируйте серийный номер"
          variant="solo"
          maxlength="13"
          hide-details
        ></v-text-field>
      </v-col>
      <!-- <v-col cols="1" class="text-right">
        <v-tooltip text="Открыть операционную карту" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn @click="openFile" color="gray" v-bind="activatorProps">
              <v-icon color="blue" left>mdi-information</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col> -->
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <h2>Продукт состоит из компонентов</h2>
    </v-row>
    <v-row v-for="(value, key, index) in props.product.specification" :key="index" align="center">
      <v-col cols="8">{{ key }}</v-col>
      <v-col cols="2">{{ value.PN }}</v-col>
      <v-col cols="2">
        <p v-if="!value.SN">Сканировать SN</p>
        <p class="text-green" v-else>{{ value.SN }}</p>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12">
        <v-btn @click="printLabel(props)" color="grey-lighten-3" block>
          Печать наклейки с SN
        </v-btn>
      </v-col>
      <!-- <v-col cols="1" class="text-right">
        <v-tooltip text="Открыть руководство пользователя принтером" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn @click="openFile" color="gray" v-bind="activatorProps">
              <v-icon left>mdi-printer</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col> -->
    </v-row>
    <v-row>
      <v-col>
        <!-- @click="printPassport(props.information?.['Артикул изделия']!, getSerialNumber(props.product.specification) )" -->
        <v-btn
          openPrintPassportWindow
          @click="openPrintPassportWindow"
          color="grey-lighten-3"
          block
        >
          Печать отгрузочного паспорта
        </v-btn>
      </v-col>
    </v-row>
    <!-- <v-row>
      <v-col>
        <v-btn
          @click="createFile"
          color="grey-lighten-3"
          block
        >
          херня
        </v-btn>
      </v-col>
    </v-row> -->
    <v-row>
      <v-col>
        <v-btn
          @click="assemblyPassedDialog = true"
          :disabled="!disabledAction || !!hasProdductionOperation(stageType)"
          color="green-lighten-3"
          block
        >
          Сборка выполнена
        </v-btn>
      </v-col>
      <v-col>
        <v-btn
          @click="defectDialog = true"
          :disabled="!disabledAction || !!hasProdductionOperation(stageType)"
          color="red-lighten-3"
          block
        >
          Брак
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
  <v-dialog v-model="assemblyPassedDialog" width="auto">
    <v-card class="pa-5" justify="center" min-width="400">
      <v-container>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Подтвердите завершение сборки</h3>
          </v-col>
        </v-row>
        <v-row class="pa-0">
          <v-checkbox
            v-model="checkLable"
            label="Этикетка с серийным номером распечатана"
            hide-details
            class="mb-4"
          />
        </v-row>
        <v-row>
          <v-checkbox
            v-model="checkPasport"
            label="Отгрузочный паспорт распечатан"
            hide-details
            class="mb-4"
          />
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              color="green-lighten-3"
              :disabled="!checkPasport || !checkLable"
              block
              @click="assemblyPassed"
            >
              Сборка завершена
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
  <DefectDialog
    :dialog="defectDialog"
    :product-serial-numbers="props.product.productSerialNumbers"
    :product="props.product"
    :information="props.information"
    @update:dialog="defectDialog = $event"
    @confirmDefect="assemblyFailed"
  />
</template>
