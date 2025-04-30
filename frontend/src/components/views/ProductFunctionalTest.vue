<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import type { StageType, ProductType, Tsp } from '@/assets/interfaces'
import ProductInformation from '@/components/ProductInformation.vue'
import { updateComponent } from '@/api/componentServices'
import {
  createProductionOperationPassed,
  createProductionOperationFailed,
  deleteProductionOperation
} from '@/api/productionOperationServices'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import type { Component, Prisma } from '../../../../extensions/src'
import { useUserStore } from '@/stores/user'
const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

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
    usedComponents: props.product.productSerialNumbers.join(', ')
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

const testFailed = async () => {
  //в любом случае удаляем сборку
  const { id } = props.product.productionOperations.find((e) => e.stageType === 'assembly') as {
    id: number
  }
  const delAssembly = await deleteProductionOperation(id)
  if (delAssembly.error) {
    return
  }
  console.log(delAssembly.data, 'dell assembly')

  //если есть совпадения по marking
  if (productionOperationAlarm.value && props.product.productionOperations.length > 0) {
    console.log('HAS EXIST PRODUCTION OPERATION MARKING')
    //удаляем операцию
    const { id } = props.product.productionOperations.find((e) => e.stageType === 'marking') as {
      id: number
    }

    const delResult = await deleteProductionOperation(id)
    if (delResult.error) {
      return
    }
    console.log(delResult.data, 'dell marking')
  }

  //теперь отвязываем и помечаем как брак все выбранные компоненты
  const promises = failedComponents.value.map(async (fComponent) => {
    const productionOperatioData = {
      stageType,
      status: 'failed',
      user: useUserStore().userFullName,
      componentId: fComponent,
      productSN: props.product.snProduct,
      comment: comment.value
    }

    //создаём бракованную операцию на все выделеннве по браку
    const resultCreate = await createProductionOperationFailed(productionOperatioData)
    console.log(resultCreate, 'resultCreate')

    //если оштбка с сервера не продолжаем!
    if (resultCreate.error) {
      return
    }

    //обновляем компонент со статусом брак, и отвязываем от продукта
    const resultUpdate = await updateComponent(fComponent, {
      status: 'failed',
      //отвязываем бракованный компонент от продукта
      snProductId: null
    })
    console.log(resultUpdate)
    //если ошибка с сервера не продолжаем!
    if (resultUpdate.error) {
      return
    }
  })

  // Ожидаем завершения всех промисов
  await Promise.all(promises)
  //выходим
  emit('done')
}
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Функциональное тестирование</h1>
      </v-col>
    </v-row>
  </v-container>

  <ProductInformation :information="props.product.information" />
  <v-container>
    <v-row>
      <v-col>
        <v-btn @click="testPassed" color="green-lighten-3" block> Тестирование выполнено </v-btn>
      </v-col>
      <v-col>
        <v-btn @click="defectDialog = true" color="red-lighten-3" block>Брак</v-btn>
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
            <p class="text-red">{{ productionOperationAlarm }}</p>
            <br />
            <p class="text-center">Брак компонентов SN {{ failedComponents.join(', ') }}</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              :disabled="!!!comment || !!!failedComponents.length"
              color="red-lighten-3"
              @click="testFailed"
              block
              >OK</v-btn
            >
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>
