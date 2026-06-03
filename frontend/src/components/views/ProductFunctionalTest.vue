<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import type { StageType, ProductType, Tsp } from '@/assets/interfaces'
import ProductInformation from '@/components/ProductInformation.vue'
import { updateComponent } from '@/api/componentServices'
import ChecklistViewer from '../_ChecklistViewerV2.vue'
import { storage } from '@neutralinojs/lib'
import {
  createProductionOperationPassed,
  createProductionOperationFailed,
  deleteProductionOperation
} from '@/api/productionOperationServices'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import type { Component, Prisma } from '../../../../shared/src'
import { useUserStore } from '@/stores/user'
import DefectDialog from '@/components/views/DefectDialog.vue'
const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()
import { createDefectHistory } from '@/api/defectHistoryServices'
import { updateProduct } from '@/api/productServices'
import { openFileFromNet } from '@/assets/utils/openFileFromNet'

const OK_PATH = import.meta.env.VITE_OK_PATH as string
const KD_PATH = import.meta.env.VITE_KD_PATH as string
const OTHER_PATH = import.meta.env.VITE_OTHER_PATH as string
const emit = defineEmits<{
  (e: 'done'): void
}>()
const productionOperationAlarm = ref('')
const comment = ref('')
const defectDialog = ref(false)
const failedComponents: Ref<string[]> = ref([])
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const stageType: StageType = 'functionalTest'
const startTime: Ref<string | null> = ref(new Date().toISOString())

onMounted(() => {
  tryToGetLocalCecklist()

  // // 1. Создаем объект Date (текущий момент времени)
  // const now = new Date();

  // // 2. Используем .toISOString() для преобразования его в нужный формат строки
  // startTime.value = now.toISOString();
  console.log(startTime.value)
})

watch(failedComponents, (e) => {
  console.log(e, productionOperationAlarm.value)
  if (
    failedComponents.value.some((j) => j === props.product.productionOperations[0].usedComponents)
  ) {
    console.log('atatata')
    productionOperationAlarm.value = `${props.product.productionOperations[0].usedComponents} 
    операция ${props.product.productionOperations[0].stageType} будет удалена`
  } else {
    productionOperationAlarm.value = ''
  }
})
console.log(
  props.product.checkList?.checkListTemplate,
  'props.product.checkList?.checkListTemplate'
)

watch(defectDialog, () => {
  if (defectDialog.value === false) {
    comment.value = ''
    failedComponents.value = []
  }
})

const testPassed = async () => {
  //создаём одну хорошую операцию
  if (startTime.value) {
    const productionOperatioData: Prisma.ProductionOperationUncheckedCreateInput = {
      stageType,
      status: 'passed',
      user: useUserStore().userFullName,
      productId: props.product.snProduct,
      usedComponents: props.product.productSerialNumbers.join(', '),
      checkList: checkList.value,
      startTime: startTime.value, // ✅ Используется время, засеченное в onMounted
      endTime: new Date().toISOString()
    }
    console.log(productionOperatioData, 'productionOperatioData')

    const resultCreate = await createProductionOperationPassed(productionOperatioData)
    console.log(resultCreate, 'resultCreate')

    //если оштбка с сервера не продолжаем!
    if (resultCreate.error) {
      return
    }
  }
  //ничего привязывать не надо просто выходим
  emit('done')
}

const testFailed = async (failedComponents: string[], comment: string) => {
  await testPassed()

  //теперь помечаем как брак все выбранные компоненты
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
  })

  try {
    await updateProduct(props.product.snProduct, {
      comment: 'on_hold'
    })
    console.log('что-то обновили')
  } catch (error) {
    console.log(error)
  }

  // Ожидаем завершения всех промисов
  await Promise.all(promises)
  //выходим
  emit('done')
}
const checkList = ref('')

const saveCheckList = async (payload: { checklistString: string; ss: boolean }) => {
  console.log(payload)

  const { checklistString, ss } = payload
  if (!ss) {
    checkList.value = checklistString
  } else {
    checkList.value = ''
  }

  // await storage.setData(`checkList_${props.information?.['SN изделия']}`, checkList.value)
  // console.log('checklist saved');
}

const debugJsonParse = (jsonString: string) => {
  console.log('=== JSON DEBUG START ===')
  console.log('Full string:', jsonString)
  console.log('String length:', jsonString.length)

  // Покажем первые 20 символов с их кодами
  const first20 = jsonString.substring(0, 20)
  console.log('First 20 chars:', first20)
  console.log('Char codes:')
  for (let i = 0; i < first20.length; i++) {
    console.log(`  Position ${i}: '${first20[i]}' (code: ${first20.charCodeAt(i)})`)
  }

  // Особенно посмотрим на позицию 7 (где ошибка)
  if (jsonString.length > 7) {
    console.log(`Problematic position 7: '${jsonString[7]}' (code: ${jsonString.charCodeAt(7)})`)
    console.log(
      'Context around position 7:',
      jsonString.substring(Math.max(0, 5), Math.min(jsonString.length, 15))
    )
  }

  console.log('=== JSON DEBUG END ===')

  try {
    return JSON.parse(jsonString)
  } catch (e) {
    console.error('JSON parse failed after debugging')
    throw e
  }
}

function fillServerTemplateFromStrings(
  localCheckListStr: string,
  serverCheckListStr: string
): string {
  // Умный санитизатор, который лечит кавычки ТОЛЬКО внутри "comment":"..."
  const sanitizeJsonStr = (str: string): string => {
    if (!str) return str

    try {
      // Шаг 1: Ищем блоки "comment":"..." или "comment":""...""
      return str.replace(/"comment"\s*:\s*"(.*?)"\s*([,}\]])/g, (match, commentValue, nextChar) => {
        // Если внутри комментария есть грязь вроде "" или незаэкранированные кавычки
        if (commentValue.includes('"')) {
          // Очищаем: убираем дубликаты кавычек, оставляем просто текст
          let cleanComment = commentValue
            .replace(/^"+|"+$/g, '') // Срезаем кавычки на границах самого значения
            .replace(/"/g, "'") // Все внутренние кавычки превращаем в безопасные одинарные

          return `"comment":"${cleanComment}"${nextChar}`
        }
        return match
      })
    } catch (e) {
      return str // Если регулярка почему-то споткнулась, возвращаем оригинал
    }
  }

  try {
    // Аккуратно лечим строки
    const cleanLocalStr = sanitizeJsonStr(localCheckListStr)
    const cleanServerStr = sanitizeJsonStr(serverCheckListStr)

    const localCheckList = JSON.parse(cleanLocalStr)
    const serverCheckList = JSON.parse(cleanServerStr)

    const localFieldMap = new Map()
    if (localCheckList?.fields) {
      localCheckList.fields.forEach((field: any) => {
        localFieldMap.set(field.name, field)
      })
    }

    const filledTemplate = {
      title: serverCheckList?.title || '',
      fields: (serverCheckList?.fields || []).map((serverField: any) => {
        const localField = localFieldMap.get(serverField.name)

        if (localField) {
          return {
            ...serverField,
            status: localField.status || null,
            comment: localField.comment || ''
          }
        }

        return serverField
      })
    }

    return JSON.stringify(filledTemplate)
  } catch (error) {
    console.error('Ошибка при парсинге JSON или заполнении шаблона:', error)
    return serverCheckListStr
  }
}

const finalcheckListTemplate = ref('')

const tryToGetLocalCecklist = async () => {
  try {
    const serverCheckList = props.product.checkList?.checkListTemplate!

    console.log('СЕРВЕРНЫЙ ЧЕКЛИСТ!!!!!!!!!!!!!!', serverCheckList)

    const localCheckList = await storage.getData(
      `checkList_${props.information?.['Инв. № изделия']}`
    )
    finalcheckListTemplate.value = fillServerTemplateFromStrings(localCheckList, serverCheckList)
  } catch (error) {
    finalcheckListTemplate.value = props.product.checkList?.checkListTemplate!
    console.log(error)
  }
}
const hasProdductionOperation = (stageType: string) => {
  //ищем по ключу наличие производственных операций
  const stage = props.product.productionOperations.some((e) => e.stageType === stageType)
  if (stage) {
    return ' - Операция выполнена'
  }
  return false
}
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">
          Функциональное тестирование {{ hasProdductionOperation(stageType) || '' }}
        </h1>
      </v-col>
      <!-- <v-col cols="2" class="text-right">
        <v-tooltip text="Открыть операционную карту" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn
              @click="openFileFromNet(product.checkList?.doc_TestOK, OK_PATH, '/OK')"
              color="gray"
              v-bind="activatorProps"
            >
              <v-icon color="blue" left>mdi-information</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col> -->
    </v-row>
  </v-container>

  <ProductInformation :information="props.information" />
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title>Документация</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-container>
            <v-row v-if="props.product.checkList?.doc_AssebbleOK">
              <v-col>
                <v-btn
                  @click="openFileFromNet(product.checkList?.doc_TestOK, OK_PATH, '/OK')"
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
            <!-- <v-row>
              <v-col>
                <v-btn @click="openFileFromNet('TSC', OTHER_PATH, '/OTHER')" color="blue" block
                  >Открыть руководство принтером</v-btn
                >
              </v-col>
            </v-row> -->
          </v-container>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
  <v-container class="pa-0 pt-10 mt-5">
    <v-row>
      <v-col>
        <ChecklistViewer
          :sn="props.information?.['Инв. № изделия']!"
          @checkList="saveCheckList"
          :template-string="finalcheckListTemplate"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn
          :disabled="!checkList || !!hasProdductionOperation(stageType)"
          @click="testPassed"
          color="green-lighten-3"
          block
        >
          Тестирование выполнено
        </v-btn>
      </v-col>
      <v-col>
        <v-btn
          :disabled="!!hasProdductionOperation(stageType)"
          @click="defectDialog = true"
          color="red-lighten-3"
          block
          >Брак</v-btn
        >
      </v-col>
    </v-row>
  </v-container>
  <DefectDialog
    :dialog="defectDialog"
    :product-serial-numbers="props.product.productSerialNumbers"
    :product="props.product"
    :information="props.information"
    @update:dialog="defectDialog = $event"
    @confirmDefect="testFailed"
  />
</template>
