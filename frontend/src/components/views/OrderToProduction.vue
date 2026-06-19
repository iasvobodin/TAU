<script setup lang="ts">
import { fetchAllProduct, fetchProductByOrderToProduction } from '@/api/productServices'
import { onMounted, ref, reactive, computed } from 'vue'
import {
  auditAndFixUserConflicts,
  processMissingOperations
} from '@/assets/processMissingOperations'
import type { Sp } from '@/assets/interfaces'
import { fetchSpecification } from '@/api/specificationServices'
import type { Operation } from '../../../../shared/src'
import type { ProductAllPayload, StageType } from '@/assets/interfaces'
const specification: Sp = reactive({
  sp: null,
  qty: null,
  spPartNumber: null,
  serialNumbers: null,
  orderToProduction: null
})

const ZNP = ref<ProductAllPayload[] | null>(null)
const orderNumber = ref('')
const pattern = /^\d+.\d+.\d+$/
const clearState = () => {
  orderNumber.value = ''
}

type OperationFlags = Pick<
  Operation,
  'issue' | 'preProdaction' | 'assembly' | 'marking' | 'functionalTest' | 'verification' | 'package'
>

interface TableItem {
  snProduct: string
  operation: keyof OperationFlags
  status: 'выполнено' | 'не выполнено'
  date: string | null
  user: string | null
}

const prepareSpecification = async () => {
  //ВХОДНАЯ ТОЧКА

  if (pattern.test(orderNumber.value)) {
    //парсим строку для получения артикула количества и ЗНП
    // ;[specification.orderToProduction, specification.spPartNumber, specification.qty] =
    //   orderNumber.value.split('_')
    // console.log(specification.orderToProduction, specification.spPartNumber, specification.qty)

    // const result = await fetchSpecification(specification.spPartNumber)
    // specification.sp = result.data

    // const { orderToProduction, qty, spPartNumber } = specification
    // // errorStore.disableErrorOutput()
    const znp = await fetchProductByOrderToProduction(orderNumber.value!)
    if (!znp.data) {
      return
    }
    ZNP.value = znp.data
    console.log(znp, 'znp')

    // updateTableData(specification)
    // проверяем есть ли у нас продукты с данным ЗНП
    // await printLabel()
    // console.log(specification.sp)
  }
}

const stageTypes: StageType[] = [
  'issue',
  'preProdaction',
  'assembly',
  'marking',
  'functionalTest',
  'verification',
  'package'
]

const headers = [
  { title: 'SN продукта', key: 'snProduct', sortable: true },
  { title: 'Операция', key: 'operation', sortable: true },
  { title: 'Статус', key: 'status', sortable: false },
  { title: 'Дата выполнения', key: 'date', sortable: true },
  { title: 'Пользователь', key: 'user', sortable: true }
]
function isStageType(key: string): key is StageType {
  return stageTypes.includes(key as StageType)
}
// Пусть products — Ref<ProductAllPayload[]>
const tableItems = computed(() => {
  const result: Array<{
    snProduct: string
    operation: StageType
    status: 'выполнено' | 'не выполнено'
    date: Date | null
    user: string | null
  }> = []
  if (!ZNP.value) {
    return
  }
  ZNP.value.forEach((product) => {
    // operation - это объект с ключами StageType и boolean
    const ops = product.specification.operation as Record<StageType, boolean>

    // productionOperations — массив с операциями, индексируем по stageType
    const doneOps = product.productionOperations.reduce<
      Partial<Record<StageType, (typeof product.productionOperations)[0]>>
    >((acc, op) => {
      if (isStageType(op.stageType)) {
        acc[op.stageType] = op
      }
      return acc
    }, {})

    Object.entries(ops).forEach(([opName, required]) => {
      if (required && isStageType(opName)) {
        const done = doneOps[opName]
        result.push({
          snProduct: product.snProduct,
          operation: opName,
          status: done ? 'выполнено' : 'не выполнено',
          date: done ? done.date : null,
          user: done ? done.user : null
        })
      }
    })
  })

  return result
})

const totalUnfinishedOperations = computed(() => {
  let count = 0

  if (!ZNP.value) {
    return
  }
  ZNP.value.forEach((product) => {
    const ops = product.specification.operation as Record<StageType, boolean>

    const doneOps = product.productionOperations.reduce<
      Partial<Record<StageType, (typeof product.productionOperations)[0]>>
    >((acc, op) => {
      if (isStageType(op.stageType)) {
        acc[op.stageType] = op
      }
      return acc
    }, {})

    Object.entries(ops).forEach(([opName, required]) => {
      if (required && isStageType(opName)) {
        const done = doneOps[opName]
        if (!done) count++
      }
    })
  })

  return count
})

const checkOperations = async (dry: boolean = true) => {
  const result = await fetchAllProduct()
  // console.log(result.data)

  try {
    await processMissingOperations(result.data!, dry)
    console.log('allDone')
  } catch (error) {
    console.log(error)
  }
}

const checkUserConflicts = async (dry: boolean = true) => {
  const result = await fetchAllProduct()
  console.log(result.data)

  try {
    await auditAndFixUserConflicts(result.data!, dry)
    console.log('allDone')
  } catch (error) {
    console.log(error)
  }
}

onMounted(async () => {})
</script>

<template>
  <v-container>
    <v-row class="mb-6">
      <h2>Прверка заказа на производство перед передачей на склад</h2>
      <br />
    </v-row>
    <v-row class="mb-4">
      <v-btn block @click="checkOperations(true)">Проверка операций по всем ордерам</v-btn>
    </v-row>
    <v-row class="mb-4">
      <v-btn block @click="checkUserConflicts(true)"
        >Проверка операций конфликт пользователей</v-btn
      >
    </v-row>

    <v-row align="center" justify="center">
      <v-col> <h3>Введите номер заказа на производство</h3></v-col>
      <v-col>
        <v-text-field
          ref="serialNumberInput"
          density="compact"
          v-model="orderNumber"
          hide-details="auto"
          clearable
          @click:clear="clearState"
          @keyup.enter="prepareSpecification"
          label="Затем нажмите ENTER"
          variant="solo"
          :rules="[(value) => pattern.test(value) || 'Должен содержать $$.$$.$$']"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <v-container class="border rounded elevation-0" v-if="ZNP">
    <v-row align="center">
      <v-col class="text-center">
        <h3 class="text-h5">Детали заказа на производство {{ specification.orderToProduction }}</h3>
      </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Артикул изделия </v-col>
      <v-col> {{ ZNP[0].specification.productMP }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Наименование изделия </v-col>
      <v-col> {{ ZNP[0].specification.productName }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Тип </v-col>
      <v-col> {{ ZNP[0].specification.type }}</v-col>
    </v-row>
    <v-row align="center">
      <v-col> Количество собранных изделий </v-col>
      <v-col> {{ ZNP.length }} </v-col>
    </v-row>
    <v-row>
      <v-col> Количество невыполненных операций </v-col>
      <v-col> {{ totalUnfinishedOperations }} </v-col>
      <!-- 55.55.55_MP3222X1-BA1_1 -->
    </v-row>
  </v-container>

  <v-container class="pa-0 mt-4">
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title class="custom-title">Подробно</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <v-container v-if="ZNP">
                <v-card elevation="2" class="pa-4">
                  <v-card-title>Детали</v-card-title>
                  <v-data-table
                    :headers="headers"
                    :items="tableItems"
                    item-value="operation"
                    class="elevation-1"
                    :items-per-page="-1"
                    :hide-default-footer="true"
                  >
                    <template #item.status="{ item }">
                      <v-chip
                        :color="
                          item.status === 'не выполнено' ? 'red lighten-2' : 'green lighten-2'
                        "
                        dark
                      >
                        {{ item.status }}
                      </v-chip>
                    </template>

                    <template #item.date="{ item }">
                      {{ item.date ? new Date(item.date).toLocaleString() : '-' }}
                    </template>
                  </v-data-table>
                </v-card>
              </v-container>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
</template>
