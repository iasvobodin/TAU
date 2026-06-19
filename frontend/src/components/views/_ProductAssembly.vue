<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import ProductInformation from '@/components/ProductInformation.vue'
import { updateComponent } from '@/api/componentServices'
import bwipjs from 'bwip-js'
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
import { appConfig } from '@/assets/utils/AppConfig'

const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()
const productionOperationAlarm = ref('') // предупреждение об удалении операции!
const comment = ref('')
const pattern = /^\d{8}(-\d{2})?$/
const serialNumber = ref('')
const defectDialog = ref(false)
const failedComponents: Ref<string[]> = ref([])
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const disabledAction = ref(false) //переменная на блокировку кнопок
const stageType: StageType = 'assembly'

const findPartNumberInSpecification = (item: string) => {
  //ищем совпадающий артикул по спецификации
  return props.product.productPartNumbers.find((e) => e === item)
}

const findSerialNumberInAdded = (item: string) => {
  //ищем совпадающий серийный номер из уже добавленных
  console.log('here', props.product.productSerialNumbers, item)

  return props.product.productSerialNumbers.find((e) => e === item)
}

const checkSerialNumber = async ($event: Event) => {
  const target = $event.target as HTMLTextAreaElement
  // if ((target.value.length === 8 || target.value.length === 11) && pattern.test(target.value)) {
  // запрашиваем компонент по серийнику
  const result = await fetchComponent(target.value)
  if (!result.data) {
    //сбрасываем
    serialNumber.value = ''
    return
  } else if (result.data.status === 'on_hold') {
    // не тот компонент
    errorStore.addError(`Данный компонент забракован`)
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    serialNumber.value = ''
    return
  } else if (!!!findPartNumberInSpecification(result.data.pnComponentId)) {
    // не тот компонент
    errorStore.addError(
      `Данный компонент ${result.data.pnComponentId} не соответствует спецификации ${props.product.productSerialNumbers}`
    )
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    serialNumber.value = ''
  } else if (result.data.snProductId) {
    // запрошенный компонент найден, но уже используется
    errorStore.addError(
      `Данный компонент уже используется в другом модуле ${result.data.snProductId}`
    )
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    serialNumber.value = ''
  } else if (result.data.snProductId === props.product.snProduct) {
    // запрошенный компонент найден, но уже используется
    errorStore.addError(`Данный компонент уже используется в этом модуле`)
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    serialNumber.value = ''
  } else if (findSerialNumberInAdded(serialNumber.value)) {
    // не тот компонент
    console.log('уже добавлен')

    errorStore.addError(`Данный компонент уже добавлен`)
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    serialNumber.value = ''
  } else {
    //вроде то что надо
    //нужно найти артикул который совпадает, и добавить его серийник в объект
    for (const [key, value] of Object.entries(props.product.specification)) {
      if (value.PN === result.data.pnComponentId) {
        // проверяем совпадает ли артикул с найденным в спецификации
        console.log(key, 'консоль ключа, нужно проверить что это плата чтобы забрать серийник')
        if (props.product.information['Тип изделия'] === 'TerminalBlocks') {
          //клеммник!!!!
          if (key.toLowerCase().includes('плата 1')) {
            console.log('то что надо для клеммника')
          }
        }

        value.SN = result.data.snComponent
        props.product.productSerialNumbers.push(value.SN)
        // console.log(props.product)
      }
    }
    console.log('COMPARE')
    errorStore.addInfo(`Компонент ${result.data.snComponent} успешно добавлен`)
    setTimeout(errorStore.removeInfo, 5000)
    //сбрасываем
    serialNumber.value = ''
  }
  // }
}

//смотрим чтобы были все серийники по спецификации, блокируем разблокируем кнопки
watch(props.product.specification, () => {
  if (props.product.specification) {
    disabledAction.value = Object.values(props.product.specification).every(
      (item) => item.SN !== null && item.SN !== undefined && item.SN !== ''
    )
  } else {
    disabledAction.value = false
  }
})
//смотрим бракуем ли мы компонент который уже учавствовал в операциях, если да, то выводим предупреждение
watch(failedComponents, (e) => {
  if (
    failedComponents.value.some((j) => j === props.product.productionOperations[0].usedComponents)
  ) {
    // так как это сборка, то до этого у нас может быть одна удачная операция, это маркировка, типа мы её удаляем
    productionOperationAlarm.value = `${props.product.productionOperations[0].usedComponents} Этот компонент был задействован в 
     "${props.product.productionOperations[0].stageType}"`
  } else {
    productionOperationAlarm.value = ''
  }
})

//чистим состояние после закрытия окна по браку
watch(defectDialog, () => {
  if (defectDialog.value === false) {
    comment.value = ''
    failedComponents.value = []
  }
})

const assemblyPassed = async () => {
  console.log('wee')

  //создаём одну хорошую операцию
  const productionOperatioData: Prisma.ProductionOperationUncheckedCreateInput = {
    stageType,
    status: 'passed',
    user: useUserStore().userFullName,
    productId: props.product.snProduct,
    usedComponents: props.product.productSerialNumbers.join(', ')
  }

  const resultCreate = await createProductionOperationPassed(productionOperatioData)
  console.log(resultCreate, 'resultCreate')

  //если оштбка с сервера не продолжаем!
  if (resultCreate.error) {
    return
  }
  // привязываем все компоненты к продукту
  const promises = props.product.productSerialNumbers.map(async (component) => {
    //обновляем компонент со статусом passed, и привязываем к продукту
    const resultUpdate = await updateComponent(component, {
      status: 'passed',
      snProductId: props.product.snProduct
    })
    console.log(resultUpdate)
    if (resultUpdate.error) {
      return
    }
  })

  await Promise.all(promises)

  emit('done')
}

const assemblyFailed = async () => {
  //если есть операции, и есть компоненты учавствующие в них
  if (productionOperationAlarm.value && props.product.productionOperations.length > 0) {
    //отвязываем операцию от продукта, присваиваем статус rejected
    //ищем id
    const { id } = props.product.productionOperations.find((e) => e.stageType === 'marking') as {
      id: number
    }

    try {
      await updateProductionOperation(id, {
        status: 'rejected',
        productId: null, // отвязываем от продукта
        componentId: props.product.productionOperations[0].usedComponents,
        productSN: props.product.snProduct,
        // comment: 'отклонённая операция из-за брака на сборке',
        usedComponents: null
      })

      // debugger
    } catch (error) {
      console.log(error)
      throw new Error('jopa')
    }
  }
  //создаём новую операцию со статусом брак и привязываем её к компоненту-ам
  //помечаем выбранный компонент как брак, убираем его из списка
  // если продукт содержит операции, надо как то проверить и отвязать их
  // в данном случае может быть только корпус, и операция маркировка

  //подгатавливаем объект

  //проверяем не привязан ли компонент
  // if (props.product.components.some(e => e.snComponent === failedComponents.value)) {
  //   console.log('yap');
  //   return
  // }

  //ЦИКЛ ПО ВЫБРАННОМУ БРАКУ
  const promises = failedComponents.value.map(async (fComponent) => {
    const productionOperatioData = {
      stageType,
      status: 'on_hold',
      user: useUserStore().userFullName,
      componentId: fComponent,
      productSN: props.product.snProduct,
      comment: comment.value
    }

    //создаём бракованную операцию на все выделенные по браку
    try {
      await createProductionOperationFailed(productionOperatioData)
    } catch (error) {
      console.log(error)
      return //если ошибка с сервера не продолжаем!
    }

    //обновляем компонент со статусом брак, и отвязываем от продукта
    try {
      await updateComponent(fComponent, {
        status: 'on_hold',
        snProductId: null //отвязываем бракованный компонент от продукта
      })
    } catch (error) {
      console.log(error)
      return
    }

    //если в базе поправили то удаляем элемент локально из модифицированной спецификации
    for (const key in props.product.specification) {
      // Если значение SN совпадает с нужным значением, удаляем этот ключ
      if (props.product.specification[key].SN === fComponent) {
        props.product.specification[key].SN = ''
      }
    }

    // // Найти индекс первого элемента с указанным значением
    // const indexToRemove = props.product.productSerialNumbers.indexOf(fComponent)
    // // Проверить, найден ли элемент, и удалить его
    // if (indexToRemove > -1) {
    //   props.product.productSerialNumbers.splice(indexToRemove, 1)
    // }
    //вариант выше но через фильтр
    props.product.productSerialNumbers = props.product.productSerialNumbers.filter(
      (serial) => serial !== fComponent
    )
  })

  // Ожидаем завершения всех промисов
  await Promise.all(promises)

  if (productionOperationAlarm.value) {
    console.log('УДАЛИЛИ ОПЕРАЦИЮ МАРКИРОВКИ, ВЫХОДИМ ИЗ СБОРКИ')

    emit('done')
  }
  // сбрасываем состояния по браку
  defectDialog.value = false
  comment.value = ''
  failedComponents.value = []
}

const printLabelDeffect = async () => {
  // Создаём глубокую копию с помощью structuredClone
  const modifiedInformation = JSON.parse(
    JSON.stringify(props.information)
  ) as ProductType['information']
  const modifiedProduct = JSON.parse(JSON.stringify(props.product)) as Tsp

  // Изменяем 'Тип изделия' в копии
  // modifiedInformation!['Тип изделия'] = 'Defective';
  modifiedProduct.information['Тип изделия'] = 'Defective'
  const p2 = { product: modifiedProduct, information: modifiedInformation }
  console.log(p2)

  // Вызываем printLabel
  await printLabel(p2)
}
const serialNumberInput = ref<InstanceType<typeof import('vuetify/components').VTextField> | null>(
  null
)
const readFile = async () => {
  const OK = props.product.template.RE
  const pdfData = await filesystem.readBinaryFile(`${appConfig.paths.ok}/${OK}.pdf`)
  console.log(pdfData)
}
const openPdfInHtml = async () => {
  const OK = props.product.template.RE // Номер операционной карты
  const pdfPath = `${appConfig.paths.ok}/${OK}.pdf`

  // 1. Чтение PDF-файла
  let pdfData
  try {
    pdfData = await filesystem.readBinaryFile(pdfPath)
    console.log('PDF-файл успешно прочитан')
  } catch (error) {
    console.error('Ошибка при чтении PDF:', error)
    return
  }

  // 2. Создание временной папки .tmp, если не существует
  try {
    await filesystem.readDirectory(`${window.NL_PATH}/.tmp`)
  } catch (error) {
    await filesystem.createDirectory(`${window.NL_PATH}/.tmp`)
  }

  // 3. Сохранение PDF во временный файл
  const tempPdfPath = `${window.NL_PATH}/.tmp/temp.pdf`
  try {
    await filesystem.writeBinaryFile(tempPdfPath, pdfData)
    console.log('PDF сохранён во временный файл')
  } catch (error) {
    console.error('Ошибка при сохранении PDF:', error)
    return
  }

  // 4. Создание HTML-файла с внедрённым PDF через HTTP
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

  // Конвертация HTML в Uint8Array
  const stringToUint8Array = (str: string) => {
    const encoder = new TextEncoder()
    return encoder.encode(str)
  }
  const htmlData = stringToUint8Array(htmlContent)

  // 5. Запись HTML-файла
  try {
    await filesystem.writeBinaryFile(
      `${window.NL_PATH}/.tmp/pdf-viewer.html`,
      htmlData.buffer as ArrayBuffer
    )
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании HTML-файла:', error)
    return
  }

  // 6. Открытие нового окна с HTML
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
    await filesystem.writeBinaryFile(
      window.NL_PATH + '/temp/pdf-viewer.html',
      data.buffer as ArrayBuffer
    )
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
const openFile = async () => {
  // await readFile()
  await openPdfInHtml()

  const OK = props.product.template.RE
  const okDir = appConfig.paths.ok.replace(/\//g, '\\')
  os.execCommand(`explorer "${okDir}\\${OK}.pdf"`)
}
onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Сборка</h1>
      </v-col>
    </v-row>
  </v-container>

  <ProductInformation :information="props.product.information" />
  <!-- {{ getDescription(value) }} -->
  <v-container>
    <v-row align="center" justify="center">
      <v-col>Отсканируйте штрих-код компонента</v-col>
      <v-col>
        <v-text-field
          ref="serialNumberInput"
          @click:clear="component = null"
          density="compact"
          clearable
          @keyup.enter="checkSerialNumber"
          v-model="serialNumber"
          label="Сканируйте серийный номер"
          variant="solo"
          maxlength="13"
        ></v-text-field>
        <!-- :rules="[(value) => pattern.test(value) || 'Только цифры']" -->
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <h2>Продукт состоит из компонентов</h2>
    </v-row>
    <v-row v-for="(value, key, index) in props.product.specification" :key="index" align="center">
      <v-col>{{ key }} </v-col>
      <v-col> {{ value.PN }} </v-col>
      <v-col>
        <p v-if="!value.SN">Сканировать SN</p>
        <p class="text-green" v-else>{{ value.SN }}</p>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn @click="openPdfInHtml" color="grey-lighten-3" block>
          Открыть операционную карту</v-btn
        >
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn @click="printLabel(props)" color="grey-lighten-3" block>
          Печать наклейки с SN
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
        <v-btn @click="defectDialog = true" :disabled="!disabledAction" color="red-lighten-3" block
          >Брак</v-btn
        >
      </v-col>
    </v-row>
  </v-container>

  <v-dialog v-model="defectDialog" width="auto">
    <v-card class="pa-10" justify="center" min-width="400">
      <v-container>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Выберите бракованный компонент</h3>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-select
              density="compact"
              v-model="failedComponents"
              hide-details="auto"
              label="Серийный номер"
              :items="props.product.productSerialNumbers"
              variant="solo"
              multiple
            ></v-select>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Укажите причину брака</h3>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-textarea variant="solo" v-model="comment" clearable label="Комментарий"></v-textarea>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Подтвердите действие</h3>
            <br />
            <h3 v-if="productionOperationAlarm" class="text-red text-center">
              {{ productionOperationAlarm }} <br />
              Данная операция будет удалена
            </h3>
            <br />
            <p class="text-center">Брак компонентов SN {{ failedComponents.join(', ') }}</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn @click="printLabelDeffect" color="grey-lighten-3" block>
              Печать наклейки Брак
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              :disabled="!!!comment || !!!failedComponents.length"
              color="red-lighten-3"
              @click="assemblyFailed"
              block
              >OK</v-btn
            >
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>
