<script setup lang="ts">
import { ref, type Ref } from 'vue'
import AddArticle from './AddArticle.vue'
import type { SerialNumberData } from '@/assets/interfaces'
import { useUserStore } from '@/stores/user'
import { useSerialNumberStore } from '../../stores/serialNumberStore'

import { createComponents } from '@/api/componentServices'

const supplier = ref('')
const invoice = ref('')
const dataFromAddArticle: SerialNumberData[] = []
const sendingStatus = ref('')
const selectedPartNumber = ref('')

// const fetchComponent = async (
//   component: Prisma.ComponentUncheckedCreateInput
// ): Promise<Prisma.ComponentUncheckedCreateInput | undefined> => {
//   console.log(component)
//   try {
//     const response = await fetch('http://localhost:3000/components', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       body: JSON.stringify(component)
//     })

//     if (!response.ok) {
//       const errorResponse = await response.json()
//       throw new Error(errorResponse.error || 'Неизвестная ошибка')
//     }

//     const newComponent: Prisma.ComponentUncheckedCreateInput = await response.json()
//     return newComponent
//   } catch (error) {
//     console.log(error, 'ошибка из fetchComponents')

//     throw error
//     // console.log(error, 'ошибка из fetchComponents');
//   }
// }
const prepareDataToSend = (data: SerialNumberData[]) => {
  return data.map((e) => {
    return {
      snComponent: e.name,
      pnComponentId: e.partNumber,
      supplier: e.supplier!,
      invoice: e.invoice!,
      status: 'accepted',
      comment: '{}',
      user: useUserStore().userFullName
    }
  })
}

const sendComponents = async () => {
  const result = await createComponents(prepareDataToSend(useSerialNumberStore().sNumbers))
  result.forEach((response, index) => {
    console.log(response, index)

    if (response.error) {
      useSerialNumberStore().sNumbers[index]._rejected = true
      useSerialNumberStore().sNumbers[index]._added = false
    } else if (response.data) {
      useSerialNumberStore().sNumbers[index]._added = true
      useSerialNumberStore().sNumbers[index]._rejected = false
    }

    sendingStatus.value = `Добавлено ${useSerialNumberStore().sNumbers.filter((e) => e._added === true).length},
        Отклонено ${useSerialNumberStore().sNumbers.filter((e) => e._rejected === true).length} `
    //     }
  })
}

const AddArticleEmit = (e: SerialNumberData[]) => {
  //нужно работать со стором, добавляем оставшиеся параметры, пытаемся отправить, меняем флаги
  // console.log(JSON.parse(JSON.stringify(e)))
  dataFromAddArticle.push(...JSON.parse(JSON.stringify(e)))
  sendComponents()
}
const endTask = () => {
  useSerialNumberStore().sNumbers = []
  invoice.value = ''
  supplier.value = ''
}
</script>

<template>
  <h1>Входной контроль</h1>
  <v-divider class="border-opacity-50" color="info"></v-divider>

  <v-container>
    <v-row align="center" justify="center">
      <v-col class="pa-1"> Введите ТН </v-col>
      <v-col class="pa-1">
        <v-text-field
          density="compact"
          v-model="invoice"
          hide-details="auto"
          clearable
          label="Invoice (ТН)"
          variant="solo"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row align="center" justify="center">
      <v-col class="pa-1"> Выберете поставщика </v-col>
      <v-col class="pa-1">
        <v-select
          density="compact"
          v-model="supplier"
          hide-details="auto"
          :clearable="true"
          label="Поставщик"
          :items="['Amvaje abi', 'Другой поставщик']"
          variant="solo"
        ></v-select>
      </v-col>
    </v-row>
  </v-container>

  <AddArticle :invoice :supplier @some-event="AddArticleEmit" />
  <v-container class="text-center" v-if="sendingStatus">{{ sendingStatus }}</v-container>
  <!-- <v-container class="text-center">
    <v-row justify="center">
      <v-col cols="12" md="6" sm="6">
        <v-btn @click="endTask" rounded="lg" size="x-large" block>Завершить</v-btn>
      </v-col>
    </v-row>
  </v-container> -->
</template>
