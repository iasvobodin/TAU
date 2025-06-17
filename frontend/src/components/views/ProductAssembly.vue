<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import ProductInformation from '@/components/ProductInformation.vue'
import DefectDialog from '@/components/views/DefectDialog.vue'
import { updateComponent } from '@/api/componentServices'
import bwipjs from 'bwip-js'
import { updateProduct } from '@/api/productServices'
import {
  createProductionOperationPassed,
  createProductionOperationFailed,
  deleteProductionOperation,
  updateProductionOperation
} from '@/api/productionOperationServices'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import type { Component, Prisma } from '../../../../shared/src'
import { useUserStore } from '@/stores/user'
import type { ModulesType, Barcodes, ProductType, StageType, Tsp } from '@/assets/interfaces'
import { printLabel } from '@/assets/printLabel'
import { server, filesystem, os, events, window as neuWindow } from '@neutralinojs/lib'
import { createDefectHistory } from '@/api/defectHistoryServices'

const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const productionOperationAlarm = ref('') // предупреждение об удалении операции!
const pattern = /^\d{8}(-\d{2})?$/
const serialNumber = ref('')
const defectDialog = ref(false)
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const disabledAction = ref(false) //переменная на блокировку кнопок
const stageType: StageType = 'assembly'

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

watch(props.product.specification, () => {
  if (props.product.specification) {
    disabledAction.value = Object.values(props.product.specification).every(
      (item) => item.SN !== null && item.SN !== undefined && item.SN !== ''
    )
  } else {
    disabledAction.value = false
  }
})

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
        actionType: 'detected',
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
  const OK = props.product.checkList?.doc_ConstructKD
  os.execCommand(
    `explorer "\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\КД\\${OK}.pdf"`
  )
}

onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Сборка {{ hasProdductionOperation(stageType) }}</h1>
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
            <v-row>
              <v-col>
                <v-btn color="blue" block>Открыть операционную карту</v-btn>
              </v-col>
            </v-row>
            <v-row v-if="props.product.checkList?.doc_ConstructKD">
              <v-col>
                <v-btn @click="openFileKD" color="blue" block> Открыть КД </v-btn>
              </v-col>
            </v-row>
            <v-row>
              <v-col>
                <v-btn color="blue" block>Открыть руководство принтером</v-btn>
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
        <v-btn @click="printLabel(props)" color="grey-lighten-3" block>
          Печать отгрузочного паспорта
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn @click="assemblyPassed" :disabled="!disabledAction" color="green-lighten-3" block>
          Сборка выполнена
        </v-btn>
      </v-col>
      <v-col>
        <v-btn @click="defectDialog = true" :disabled="!disabledAction" color="red-lighten-3" block>
          Брак
        </v-btn>
      </v-col>
    </v-row>
  </v-container>

  <DefectDialog
    :dialog="defectDialog"
    :product-serial-numbers="props.product.productSerialNumbers"
    :product="props.product"
    :information="props.information"
    @update:dialog="defectDialog = $event"
    @confirmDefect="assemblyFailed"
  />
</template>
