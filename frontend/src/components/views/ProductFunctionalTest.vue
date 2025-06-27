<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import type { StageType, ProductType, Tsp } from '@/assets/interfaces'
import ProductInformation from '@/components/ProductInformation.vue'
import { updateComponent } from '@/api/componentServices'
import ChecklistViewer from '../ChecklistViewerV2.vue'
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
  const productionOperatioData: Prisma.ProductionOperationUncheckedCreateInput = {
    stageType,
    status: 'passed',
    user: useUserStore().userFullName,
    productId: props.product.snProduct,
    usedComponents: props.product.productSerialNumbers.join(', '),
    comment: checkList.value
  }

  const resultCreate = await createProductionOperationPassed(productionOperatioData)
  console.log(resultCreate, 'resultCreate')

  //если оштбка с сервера не продолжаем!
  if (resultCreate.error) {
    return
  }
  //ничего привязывать не надо просто выходим
  emit('done')
}

const testFailed = async (failedComponents: string[], comment: string) => {
  await testPassed()
  // //в любом случае удаляем сборку
  // const { id } = props.product.productionOperations.find((e) => e.stageType === 'assembly') as {
  //   id: number
  // }
  // const delAssembly = await deleteProductionOperation(id)
  // if (delAssembly.error) {
  //   return
  // }
  // console.log(delAssembly.data, 'dell assembly')

  // //если есть совпадения по marking
  // if (productionOperationAlarm.value && props.product.productionOperations.length > 0) {
  //   console.log('HAS EXIST PRODUCTION OPERATION MARKING')
  //   //удаляем операцию
  //   const { id } = props.product.productionOperations.find((e) => e.stageType === 'marking') as {
  //     id: number
  //   }

  //   const delResult = await deleteProductionOperation(id)
  //   if (delResult.error) {
  //     return
  //   }
  //   console.log(delResult.data, 'dell marking')
  // }

  //теперь отвязываем и помечаем как брак все выбранные компоненты
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

    // const productionOperatioData = {
    //   stageType,
    //   status: 'on_hold',
    //   user: useUserStore().userFullName,
    //   componentId: fComponent,
    //   productSN: props.product.snProduct,
    //   comment: comment.value
    // }

    // //создаём бракованную операцию на все выделеннве по браку
    // const resultCreate = await createProductionOperationFailed(productionOperatioData)
    // console.log(resultCreate, 'resultCreate')

    // //если оштбка с сервера не продолжаем!
    // if (resultCreate.error) {
    //   return
    // }

    // //обновляем компонент со статусом брак, и отвязываем от продукта
    // const resultUpdate = await updateComponent(fComponent, {
    //   status: 'on_hold',
    //   //отвязываем бракованный компонент от продукта
    //   snProductId: null
    // })
    // console.log(resultUpdate)
    // //если ошибка с сервера не продолжаем!
    // if (resultUpdate.error) {
    //   return
    // }
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

const saveCheckList = (e: string) => {
  console.log(e)
  checkList.value = e
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
    </v-row>
  </v-container>

  <ProductInformation :information="props.product.information" />
  <v-container>
    <v-row>
      <v-col>
        <ChecklistViewer
          @checkList="saveCheckList"
          :template-string="props.product.checkList?.checkListTemplate!"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn :disabled="!checkList" @click="testPassed" color="green-lighten-3" block>
          Тестирование выполнено
        </v-btn>
      </v-col>
      <v-col>
        <v-btn @click="defectDialog = true" color="red-lighten-3" block>Брак</v-btn>
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
