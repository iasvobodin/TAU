<script setup lang="ts">
import { reactive, ref } from 'vue'

import { genSN } from '@/assets/generateSN'
import { createDocWithBarcodes } from '@/assets/generateBarcode'

import type { ModulesType } from '@/assets/interfaces'
import type { Specification } from '../../../../extensions/src'
//api
import { fetchSpecification } from '@/api/specificationServices'
import { fetchProductLastSN, createProduct } from '@/api/productServices'

const specification_qty = ref('')

interface Sp {
  sp: Specification | null
  spPartNumber: string | null
  qty: string | null
  serialNumbers: string[] | null
}

const specification: Sp = reactive({
  sp: null,
  qty: null,
  spPartNumber: null,
  serialNumbers: null
})

const pattern = /^M[PS]\d{4}X1-[A-Z]{2}[123]_\d+$/
// /^M[PS]\d{4}X1-[A-Z]{2}1_\d+$/
const prepareSpecification = async () => {
  if (pattern.test(specification_qty.value)) {
    ;[specification.spPartNumber, specification.qty] = specification_qty.value.split('_')
    const result = await fetchSpecification(specification.spPartNumber)
    specification.sp = result.data
    console.log(specification.sp)
  }
}

const generateSN = async () => {
  const lastSn = await fetchProductLastSN()

  let currentUniqueNumber: number

  if (lastSn.data![0]) {
    currentUniqueNumber = +lastSn.data![0].snProduct.slice(-6)
  } else {
    currentUniqueNumber = 0
  }

  if (specification.sp && specification.sp.type && specification.qty) {
    specification.serialNumbers = genSN(
      specification.sp.type as ModulesType,
      +specification.qty,
      currentUniqueNumber
    )
  }
  saveDocument()
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
      //создаём изделия в базе
      if (specification.serialNumbers) {
        for (const sn of specification.serialNumbers) {
          try {
            await createProduct({
              snProduct: sn,
              specificationProductMP: specification.spPartNumber!
            })
          } catch (error) {
            console.log(error)
          }
          console.log(sn)
        }
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
}
</script>

<template>
  <h1>Подготовка производства</h1>
  <!-- MP3204X1-BA1_3 -->
  <v-divider class="border-opacity-50" color="info"></v-divider>
  <v-container>
    <v-row align="center" justify="center">
      <v-col> Отсканируйте штрих-код на ведомости комплектации и <b>нажмите enter</b></v-col>
      <v-col>
        <v-text-field
          density="compact"
          v-model="specification_qty"
          hide-details="auto"
          clearable
          @click:clear="clearState"
          @keyup.enter="prepareSpecification"
          label="должен содержать артикул_количество"
          variant="solo"
          :rules="[(value) => pattern.test(value) || 'Должен содержать артикул_количество']"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <v-container v-if="specification.sp">
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
  </v-container>
  <v-container class="text-center">
    <v-row justify="center">
      <v-col cols="8">
        <v-btn
          v-if="specification.sp"
          :disabled="!!specification.serialNumbers"
          @click="generateSN"
          block
          color="green-lighten-3"
          >генерировать SN
        </v-btn>
      </v-col>
    </v-row>
    <!-- <v-row v-for="item in specification.serialNumbers" :key="item" align="center">
      <v-col> {{ item }} </v-col>
    </v-row> -->
  </v-container>
  <!-- <v-container v-if="specification.serialNumbers" class="text-center">
    <v-row justify="center">
      <v-col cols="8">
        <v-btn @click="saveDocument" rounded="lg" size="x-large" block>Сохранить документ</v-btn>
      </v-col>
    </v-row>
  </v-container> -->
</template>
