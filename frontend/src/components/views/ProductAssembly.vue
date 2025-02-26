<script setup lang="ts">
import { onMounted, ref, watch, watchEffect, type Ref } from 'vue'
import type { StageType, ProductType, ProductAllPayload } from '@/assets/interfaces'
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
import { type TransformSpecification } from '@/assets/transformSP'
const props = defineProps<{
  information: ProductType['information']
  product: TransformSpecification
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()
const productionOperationAlarm = ref('')
const comment = ref('')
const pattern = /^\d{8}(-\d{2})?$/
const serialNumber = ref('')
const defectDialog = ref(false)
const failedComponents: Ref<string[]> = ref([])
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const disabledAction = ref(false)
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
    } else if (result.data.status === 'failed') {
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
      //нужно найти артикул который совпа, и добавить его серийник в объект
      for (const [key, value] of Object.entries(props.product.specification)) {
        if (value.PN === result.data.pnComponentId) {
          value.SN = result.data.snComponent
          props.product.productSerialNumbers.push(value.SN)
        }
      }
      console.log('COMPARE')
      errorStore.addInfo(`Компонент ${result.data.snComponent} успешно добавлен`)
      setTimeout(errorStore.removeInfo, 5000)
      serialNumber.value = ''
    }
  // }
}

watch(props.product.specification, () => {
  if (props.product.specification) {
    console.log('watch')

    disabledAction.value = Object.values(props.product.specification).every(
      (item) => item.SN !== null && item.SN !== undefined && item.SN !== ''
    )
  } else {
    disabledAction.value = false
  }
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
  //если есть совпадения по существующим операциям
  if (productionOperationAlarm.value && props.product.productionOperations.length > 0) {
    console.log('HAS EXIST PRODUCTION OPERATION', props.product.productionOperations[0].id)
    //удаляем операцию
    const delResult = await deleteProductionOperation(props.product.productionOperations[0].id)
    console.log(delResult.data)
    if (delResult.error) {
      return
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
  const promises = failedComponents.value.map(async (fComponent) => {
    // if (props.product.productionOperations.length > 0) {
    //   // let index;
    //   //есть операции надо чёто делать
    //   props.product.productionOperations.map(async(e, i) => {
    //     if (
    //       e.usedComponents === fComponent ||
    //       (e.usedComponents &&
    //         e.usedComponents.length > 5 &&
    //         Array.from(e.usedComponents).some((e) => e === fComponent))
    //     ) {
    //       //бракуем компонент из другой операции, удаляем эту операцию
    //       const delResult = await deleteProductionOperation(props.product.productionOperations[0].id)
    //       if (delResult.error) {
    //         return
    //       }

    //       // props.product.productionOperations.splice(i, 1)
    //     }
    //   })

    // }

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

    //если в базе поправили то удаляем элемент
    for (const key in props.product.specification) {
      // Если значение SN совпадает с нужным значением, удаляем этот ключ
      if (props.product.specification[key].SN === fComponent) {
        props.product.specification[key].SN = ''
      }
    }

    // Найти индекс первого элемента с указанным значением
    const indexToRemove = props.product.productSerialNumbers.indexOf(fComponent)
    // Проверить, найден ли элемент, и удалить его
    if (indexToRemove > -1) {
      props.product.productSerialNumbers.splice(indexToRemove, 1)
    }
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
          @click:clear="component = null"
          density="compact"
          clearable
          @keyup.enter="checkSerialNumber"
          v-model="serialNumber"
          :focused="true"
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
