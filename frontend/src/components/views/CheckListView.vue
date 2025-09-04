<script setup lang="ts">
import { fetchCheckList, updateCheckList } from '@/api/checkListServices'
import type { Specification } from '@/assets/interfaces'
import { fetchSpecifications } from '@/api/specificationServices'
import ChecklistTemplateEditor from '../ChecklistTemplateEditorV2.vue'
import OperationCardBuilder from '../OperationCardBuilder.vue'
import { onMounted, ref, watch } from 'vue'

const specifications = ref<Specification[] | null>(null)
const selectedSP = ref('')
const templateFromServer = ref('')
const checkListFromServer = ref<Specification['checkList'][] | null>(null)
const templateCheckList = ref('')

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
  await getSpecification()
})
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <h2>Создание и редактирование чеклистов для функциональных тестов</h2>
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <p>Выберите артикул модуля для создания\редактирования чек-листа</p>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-autocomplete
          density="compact"
          v-model="selectedSP"
          hide-details="auto"
          :clearable="true"
          label="Артикул"
          :items="specifications?.map((e) => `${e?.productMP} ${e?.productName}`)"
          variant="solo"
        ></v-autocomplete>
      </v-col>
    </v-row>
    <!-- <OperationCardBuilder />  -->

    <v-row v-if="selectedSP">
      <v-col>
        <ChecklistTemplateEditor
          :initial-title="selectedSP.split(' ')[0]"
          :initial-template-string="templateFromServer"
          @template="doTemplate"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
