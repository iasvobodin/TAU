<script setup lang="ts">
import { ref, type Ref } from 'vue'
import AddArticle from './AddArticle.vue'
import type { SerialNumberData } from '@/assets/interfaces'
import { useUserStore } from '@/stores/user'
import { useSerialNumberStore } from '../../stores/serialNumberStore'
import { createDefectHistory } from '@/api/defectHistoryServices'
import { createComponents } from '@/api/componentServices'
import { openFileFromNet } from '@/assets/utils/openFileFromNet'

const OK_PATH = import.meta.env.VITE_OK_PATH as string
const supplier = ref('')
const invoice = ref('')
const dataFromAddArticle: SerialNumberData[] = []
const sendingStatus = ref('')

const prepareDataToSend = (data: SerialNumberData[]) => {
  return data.map((e) => {
    return {
      snComponent: e.name,
      pnComponentId: e.partNumber,
      supplier: e.supplier!,
      invoice: e.invoice!,
      status: e.status ? 'on_hold' : 'accepted',
      comment:
        e.comment || (e.photos && e.photos.length)
          ? JSON.stringify({ comment: e.comment ?? '', photos: e.photos ?? [] })
          : '{}',
      user: useUserStore().userFullName
    }
  })
}

const sendComponents = async () => {
  try {
    const result = await createComponents(prepareDataToSend(useSerialNumberStore().sNumbers))
    result.forEach((response, index) => {
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
  } catch (error) {
    console.log(error)
  }

  const promises = dataFromAddArticle.map(async (component) => {
    console.log('зашли в функцию')
    //отмеченные как брак!!!
    if (component.status) {
      console.log('внутри создания дх', component.name)

      try {
        const dh = await createDefectHistory({
          componentSN: component.name,
          actionType: 'DetectDefect',
          status: 'on_hold',
          user: useUserStore().userFullName,
          // comment: component.comment,
          // partNumber: component.partNumber,
          description: component.comment
        })
        console.log('создали дефект хистори', dh.data)
      } catch (error) {
        console.log(error)
      }
    }
  })
  await Promise.all(promises)
}

const AddArticleEmit = (e: SerialNumberData[]) => {
  //нужно работать со стором, добавляем оставшиеся параметры, пытаемся отправить, меняем флаги
  // console.log(JSON.parse(JSON.stringify(e)))
  dataFromAddArticle.push(...JSON.parse(JSON.stringify(e)))
  console.log(dataFromAddArticle, 'dataFromAddArticle')
  sendComponents()
}
const endTask = () => {
  useSerialNumberStore().sNumbers = []
  invoice.value = ''
  supplier.value = ''
}
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>Входной контроль</h1>
      </v-col>

      <v-col cols="2" class="text-right">
        <v-tooltip text="Открыть операционную карту" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn
              @click="openFileFromNet('Входной контроль', OK_PATH, '/OK')"
              color="gray"
              v-bind="activatorProps"
            >
              <v-icon color="blue" left>mdi-information</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col>
    </v-row>
  </v-container>
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
