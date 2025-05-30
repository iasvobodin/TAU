<script setup lang="ts">
import { reactive, ref, onMounted, type Ref } from 'vue'

import { genSN } from '@/assets/generateSN'
import { createDocWithBarcodes } from '@/assets/barcodeGenerator'

import { fetchComponent } from '@/api/componentServices'
import { useErrorStore } from '@/stores/errorStore'
import type { ModulesType, ProductAllPayload } from '@/assets/interfaces'
import type { Specification } from '../../../../extensions/src'
import { updateComponent } from '@/api/componentServices'
import { fetchSpecification } from '@/api/specificationServices'
import {
  fetchProductLastSN,
  createProduct,
  fetchProductByOrderToProduction
} from '@/api/productServices'
import { server, filesystem, os, events, window as neuWindow } from '@neutralinojs/lib'

const specification_qty = ref('')
const allMatch = ref(false)

type Barcodes = {
  barcode: string // znp.data.snProduct
  productName: string //znp.data.specification.productName
  partNumber: string //znp.data.specification.productMP
  type: ModulesType //znp.data.specification.type
}[]

const existBarcodes: Ref<Barcodes | null> = ref(null)

interface Sp {
  sp: Specification | null
  spPartNumber: string | null
  qty: string | null
  serialNumbers: string[] | null
  orderToProduction: string | null
}
const errorStore = useErrorStore()
const specification: Sp = reactive({
  sp: null,
  qty: null,
  spPartNumber: null,
  serialNumbers: null,
  orderToProduction: null
})

const pattern = /^\d+.\d+.\d+_M[PS]\d{4}X1-[A-Z]{2}[123]_\d+$/

// Массив для хранения всех серийных номеров
const serialNumbersEnclosure = ref<string[]>([])

// Текущее значение поля ввода
const inputSerial = ref('')

const headers = [
  { title: '№', key: 'index', sortable: false },
  { title: 'Тип корпуса', key: 'enclosureType', sortable: false },
  { title: 'Серийный номер', key: 'serialNumber', sortable: false }
]

// Данные для таблицы
const tableData = ref(
  Array.from({ length: 1000 }, (_, index) => ({
    index: index + 1,
    enclosureType: '',
    serialNumber: ''
  }))
)
function checkComponentElectronicBoard2(data: ProductAllPayload[]) {
  return data.some((item) =>
    item.components.some(
      (component) => component.pnComponentId === item.specification.electronicBoard2
    )
  )
}

const printLabel = async () => {
  allMatch.value = false
  const { orderToProduction, qty, spPartNumber } = specification
  errorStore.disableErrorOutput()
  const znp = await fetchProductByOrderToProduction(orderToProduction!)

  errorStore.enableErrorOutput()
  if (Array.isArray(znp.data)) {
    console.log(znp.data)

    if (znp.data.length === Number(qty)) {
      // Проверяем, все ли продукты нужного артикула
      allMatch.value = znp.data.every((product) => product.specification.productMP === spPartNumber)
      if (allMatch.value) {
        const elb2 = checkComponentElectronicBoard2(znp.data)
        console.log(elb2, 'elb2', znp.data)

        // Дальнейшие действия, если все продукты соответствуют артикулу
        console.log('все продукты соответствуют артикулу, ЗНП и количеству')

        existBarcodes.value = znp.data.map((item) => ({
          barcode: item.snProduct,
          productName: item.specification.productName,
          partNumber: item.specification.productMP,
          type: item.specification.type
        }))
      }
    } else {
      errorStore.addError('В данном З.Н.П. количество модулей не совпадает!')
      setTimeout(errorStore.removeError, 5000)
      clearState()
    }
  }
}
// 2.4.1_MP3221X1-BA1_2

const prepareSpecification = async () => {
  //ВХОДНАЯ ТОЧКА

  if (pattern.test(specification_qty.value)) {
    //парсим строку для получения артикула количества и ЗНП
    ;[specification.orderToProduction, specification.spPartNumber, specification.qty] =
      specification_qty.value.split('_')
    console.log(specification.orderToProduction, specification.spPartNumber, specification.qty)

    const result = await fetchSpecification(specification.spPartNumber)
    specification.sp = result.data
    updateTableData(specification)
    // проверяем есть ли у нас продукты с данным ЗНП
    await printLabel()
    // console.log(specification.sp)
  }
}
const generateCurrentUniqueNumder = async () => {
  const lastSn = await fetchProductLastSN()

  let currentUniqueNumber: number

  if (lastSn.data![0]) {
    currentUniqueNumber = +lastSn.data![0].snProduct.slice(-6)
  } else {
    currentUniqueNumber = 0
  }
  return currentUniqueNumber
}

const generateSNforOthers = async () => {
  const currentUniqueNumber = await generateCurrentUniqueNumder()

  if (specification.sp && specification.sp.type && specification.qty) {
    specification.serialNumbers = genSN(
      specification.sp.type as ModulesType,
      +specification.qty,
      currentUniqueNumber
    )
  }
  saveDocument()
}

const createProductInDB = async (specification: Sp, enclosure: boolean = true) => {
  // Создаём локальную копию объекта specification, чтобы избежать мутаций снаружи
  const localSpec: Sp = {
    ...specification,
    serialNumbers: [...(specification.serialNumbers ?? [])]
  }

  for (const [index, sn] of localSpec.serialNumbers!.entries()) {
    console.log(`Iteration ${index}:`)
    console.log('Current spPartNumber:', localSpec.spPartNumber)

    try {
      // создаём продукт в базе
      console.log(
        '//создаём продукт в базе',
        sn,
        localSpec.spPartNumber!,
        localSpec.orderToProduction
      )
      await createProduct({
        snProduct: sn,
        specificationProductMP: localSpec.spPartNumber!,
        orderToProduction: localSpec.orderToProduction
      })
    } catch (error) {
      console.log(
        error,
        'ошибка создания продукта',
        sn,
        localSpec.spPartNumber!,
        localSpec.orderToProduction
      )
    }

    if (enclosure) {
      console.log(serialNumbersEnclosure.value[index], 'enclosure update')
      try {
        // обновляем корпус, привязываем к продукту в базе
        await updateComponent(serialNumbersEnclosure.value[index], {
          status: 'passed',
          snProductId: sn
        })
      } catch (error) {
        console.log(error, 'ошибка обновления корпуса', serialNumbersEnclosure.value[index])
      }
    }

    console.log(`Index: ${index}, SN: ${sn}`)
  }
}

const saveDocument = async () => {
  if (specification.serialNumbers) {
    console.log(specification.serialNumbers)

    try {
      await createDocWithBarcodes(
        specification.serialNumbers,
        specification.sp?.productName!,
        specification.spPartNumber!,
        specification.sp!.type as ModulesType
      )
      //создаём изделия в базе, если их там нет
      if (!allMatch.value) {
        await createProductInDB(specification, false)
      }

      clearState()
    } catch (error) {
      console.log(error, 'и вот тут тоже ошибка')
      return
    }
  }
}
const clearState = () => {
  specification.sp = null
  specification.qty = null
  specification.spPartNumber = null
  specification.serialNumbers = null
  specification_qty.value = ''
  serialNumbersEnclosure.value = []
}

// "Controller" | "PowerSupply" | "Modules" | "PAZ"

// Обновление данных таблицы при изменении specification
const updateTableData = (spec: Sp) => {
  tableData.value = Array.from({ length: +spec.qty! }, (_, index) => ({
    index: index + 1,
    enclosureType: spec.sp!.enclosureType,
    serialNumber: serialNumbersEnclosure.value[index] || ''
  }))
}
// Проверка серийного номера (заглушка для вашей реализации)
async function validateSerialNumber(serial: string): Promise<boolean> {
  const result = await fetchComponent(serial)
  if (!result.data) {
    //сбрасываем
    // errorStore.addError(`Данный компонент забракован`)
    // setTimeout(errorStore.removeError, 5000)
    inputSerial.value = ''
    return false
  } else if (result.data.pnComponentId !== specification.sp!.enclosureType) {
    // не тот компонент
    errorStore.addError(`Данный компонент не соответствует спецификации`)
    setTimeout(errorStore.removeError, 5000)
    inputSerial.value = ''
    return false
  } else if (result.data.snProductId) {
    // запрошенный компонент найден, но уже используется
    errorStore.addError(`Данный компонент уже используется в другом модуле`)
    setTimeout(errorStore.removeError, 5000)
    //сбрасываем
    inputSerial.value = ''
  } else {
    return true
  }
  return true
}

// Добавление серийного номера с проверкой
const addSerialNumber = async () => {
  if (!inputSerial.value.trim() || serialNumbersEnclosure.value.length >= tableData.value.length) {
    return
  }

  const serial = inputSerial.value.trim()

  // serialNumbersEnclosure.value.push(serial)
  // updateTableData(specification)
  // inputSerial.value = ''

  try {
    const isValid = await validateSerialNumber(serial)
    if (isValid) {
      serialNumbersEnclosure.value.push(serial)
      console.log(serialNumbersEnclosure.value, 'here, we are pushed')

      updateTableData(specification)
      inputSerial.value = ''
    } else {
      // errorMessage.value = 'Серийный номер не прошел проверку или артикул неверный';
    }
  } catch (error) {
    // errorMessage.value = error instanceof Error ? error.message : 'Ошибка при проверке серийного номера';
  }
}

const generateSNforModules = async () => {
  //проверяем последний номер для создания ТАУ

  const currentUniqueNumber = await generateCurrentUniqueNumder()
  //создаём серийные номера
  if (specification.sp && specification.qty) {
    console.log('генерируем номера')

    specification.serialNumbers = genSN(
      specification.sp.type as ModulesType,
      +specification.qty,
      currentUniqueNumber
    )
  }
  console.log(specification.serialNumbers, 'сгенерированные номера')

  try {
    await createProductInDB(specification)
    clearState()
  } catch (error) {
    console.log(error, 'ошибка при создании продукта')
  }
}
const serialNumberInput = ref<InstanceType<typeof import('vuetify/components').VTextField> | null>(
  null
)
const openFile = async () => {
  os.execCommand(
    `explorer "\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\Софт\\прикладные документы\\TSC 300 руководство пользователя.pdf"`
  )
}
onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})
</script>

<template>
  <h1>Подготовка производства</h1>
  <v-divider class="border-opacity-50" color="info"></v-divider>
  <v-container>
    <v-row align="center" justify="center">
      <v-col> Отсканируйте штрих-код на заказе на производство <b>нажмите enter</b></v-col>
      <v-col>
        <v-text-field
          ref="serialNumberInput"
          density="compact"
          v-model="specification_qty"
          hide-details="auto"
          clearable
          @click:clear="clearState"
          @keyup.enter="prepareSpecification"
          label="должен содержать артикул_количество_ЗНП"
          variant="solo"
          :rules="[(value) => pattern.test(value) || 'Должен содержать артикул_количество_ЗНП']"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <v-container class="border rounded elevation-0" v-if="specification.sp">
    <v-row align="center">
      <v-col class="text-center">
        <h3 class="text-h5">Детали заказа на производство {{ specification.orderToProduction }}</h3>
      </v-col>
      <v-col class="text-right">
        <v-tooltip text="Открыть руководство пользователя принтером" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn @click="openFile" color="gray" v-bind="activatorProps">
              <v-icon left>mdi-printer</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Артикул изделия </v-col>
      <v-col> {{ specification.spPartNumber }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Наименование изделия </v-col>
      <v-col> {{ specification.sp?.productName }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Тип </v-col>
      <v-col> {{ specification.sp?.type }}</v-col>
    </v-row>
    <v-row align="center">
      <v-col> Количество изделий </v-col>
      <v-col> {{ specification.qty }} </v-col>
    </v-row>
    <v-row> </v-row>
  </v-container>
  <v-container v-if="specification.sp">
    <v-row v-if="!allMatch">
      <v-col>
        Отсканируйте серийные номера на корпусах изделий
        <b>{{ specification.sp.enclosureType }}</b> в количестве
        <b>{{ specification.qty }} шт</b></v-col
      >
      <v-container>
        <v-row
          ><v-col>
            <VTextField
              density="compact"
              v-model="inputSerial"
              label="Введите серийный номер"
              variant="outlined"
              @keyup.enter="addSerialNumber"
              class="mr-2" /></v-col
        ></v-row>
        <VDataTable
          :headers="headers"
          :items-per-page="500"
          :items="tableData"
          hide-default-footer
          class="elevation-1"
        />
      </v-container>
    </v-row>
    <v-row v-if="!allMatch" align="center">
      <v-col>
        <v-btn
          :disabled="+specification.qty! !== serialNumbersEnclosure.length"
          @click="generateSNforModules"
          block
          color="green-lighten-3"
          >Добавить корпуса в заказ на производство
        </v-btn>
      </v-col>
    </v-row>
  </v-container>

  <!-- MP3241X1-EA1_3_1.1.2 -->
</template>
