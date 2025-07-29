<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { StageType, ProductType, ProductAllPayload, Tsp } from '@/assets/interfaces'
import ProductInformation from '@/components/ProductInformation.vue'
import type { Ref } from 'vue'
import type { Component, Prisma } from '../../../../shared/src'
import {
  createProductionOperationPassed,
  createProductionOperationFailed
} from '@/api/productionOperationServices'
import { updateComponent } from '@/api/componentServices'
import { useUserStore } from '@/stores/user'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import DefectDialog from '@/components/views/DefectDialog.vue'
import { os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { usePartNumberComponents } from '@/stores/partNumberComponents'
import { openFileFromNet } from '@/assets/utils/openFileFromNet'

const OK_PATH = import.meta.env.VITE_OK_PATH as string
const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()
const failedComponents: Ref<string[]> = ref([])
const serialNumber = ref('')
// const information = ref('')
// const pattern = /^\d+$/
// const pattern = /^\d{8}(-\d{2})?$/
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const defectDialog = ref(false)
const comment = ref('')
const partNumberComponents = usePartNumberComponents()

const stageType: StageType = 'marking'

const hasProdductionOperation = (stageType: string) => {
  //ищем по ключу наличие производственных операций
  const stage = props.product.productionOperations.some((e) => e.stageType === stageType)
  if (stage) {
    return ' - Операция выполнена'
  }
  return false
}

const checkSerialNumber = async ($event: Event | string) => {
  //преобразуем тип входещей переменной
  const target = () => {
    if (typeof $event === 'string') {
      const target = $event
      return target
    } else {
      const target = $event.target as HTMLTextAreaElement
      return target.value
    }
  }

  // if ((target.value.length === 8 || target.value.length === 11) && pattern.test(target.value)) {
  // if (target.value.length === 8 && pattern.test(target.value)) {
  clearState()
  const result = await fetchComponent(target())
  if (!result.data) {
    //ошибка с сервера, сьрасываем
    serialNumber.value = ''
    return
  } else if (result.data.status === 'on_hold') {
    errorStore.addError(`Данный компонент забракован`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else if (result.data.snProductId) {
    if (result.data.snProductId === props.product.snProduct) {
      //вот туе уже все компоненты привязаны, надо проверять именно корпус!
      errorStore.addInfo(`Корпус уже привязан`)
      setTimeout(errorStore.removeInfo, 5000)
      serialNumber.value = result.data.snComponent
      component.value = result.data
      props.product.productSerialNumbers.push(result.data.snComponent)
      return
    }
    errorStore.addError(`Данный компонент уже используется в ${result.data.snProductId}`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else if (!findPartNumberInSpecification(result.data.pnComponentId)) {
    errorStore.addError(`Данный компонент ${result.data?.pnComponentId} не корпус`)
    setTimeout(errorStore.removeError, 5000)
    serialNumber.value = ''
  } else {
    console.log('COMPARE')
    errorStore.addInfo(`Компонент ${result.data.snComponent} успешно добавлен`)
    setTimeout(errorStore.removeInfo, 5000)
    component.value = result.data
    props.product.productSerialNumbers.push(result.data.snComponent)
  }
  console.log(result.data)
  // }
}

const failedMarking = (failedComponents: string[], cc: string) => {
  comment.value = cc
  console.log(comment.value)
  debugger
  marking('on_hold')
}

const marking = async (status: string) => {
  //создать новоую операцию по маркировке и привязать её к продукту
  const productionOperatioData: Prisma.ProductionOperationUncheckedCreateInput = {
    stageType: 'marking',
    status,
    user: useUserStore().userFullName,
    productId: props.product.snProduct,
    comment: comment.value || '{}',
    usedComponents: component.value!.snComponent
  }

  try {
    await createProductionOperationPassed(productionOperatioData)
  } catch (error) {
    console.log(error)
    return
  }

  //привязать кмопонент корпуса к продукту
  const componentData = {
    status,
    snProductId: props.product.snProduct,
    comment: comment.value || '{}'
  }
  try {
    await updateComponent(component.value!.snComponent, componentData)
  } catch (error) {
    console.log(error)
    return
  }

  errorStore.addInfo(`Операция выполнена успешно`)
  setTimeout(errorStore.removeInfo, 5000)
  emit('done')
}

//defective
//должна принимать SN продукта и SN компонента
//ищем операцию с браком, сохраняем её в компонент, вместе с SN продукта
const markingFailed = async () => {
  //создаём новую операцию со статусом брак и привязываем её к компоненту
  //подгатавливаем объект
  const productionOperatioData = {
    stageType: 'marking',
    status: 'on_hold',
    user: useUserStore().userFullName,
    componentId: serialNumber.value,
    productSN: props.product.snProduct,
    comment: comment.value,
    usedComponents: failedComponents.value.join(', ')
    // productId: props.product.snProduct
  }
  console.log(productionOperatioData, 'productionOperatioData')

  const resultCreate = await createProductionOperationFailed(productionOperatioData)
  console.log(resultCreate.data)
  if (resultCreate.error) {
    return
  }
  //обновляем компонент со статусом брак
  const resultUpdate = await updateComponent(component.value!.snComponent, {
    status: 'on_hold'
  })
  console.log(resultUpdate.data)
  if (resultUpdate.error) {
    return
  }
  //сбрасываем состояние
  clearState()
}
const findPartNumberInSpecification = (item: string) => {
  console.log(props.product.productPartNumbers.some((e) => e === item))
  //ищем совпадающий артикул по спецификации
  for (const [key, value] of Object.entries(props.product.specification)) {
    console.log(key, value.PN)
    if (key.includes('Комплект деталей корпуса')) {
      if (value.PN === item) {
        return true
      }
      return false
    }
  }
}
const clearState = () => {
  serialNumber.value = ''
  defectDialog.value = false
  failedComponents.value = []
  props.product.productSerialNumbers = []
  component.value = null
  comment.value = ''
}

onMounted(() => {
  if (!hasProdductionOperation(stageType)) {
    // если заходим в режиме администрирования то запрашивает 4 раза
    props.product.components.forEach((element) => {
      if (
        partNumberComponents.enclosuretNumbers &&
        partNumberComponents.enclosuretNumbers.some((e) => e.partNumber === element.pnComponentId)
      ) {
        checkSerialNumber(element.snComponent!)
      }
    })
  }
})
const openFolder = () => {
  os.execCommand(
    'explorer "\\\\rucekaspinffs05.metran.local\\Dept-MP\\Production\\Internal\\Продукты\\ТАУ\\Наклейки\\Гравировка"'
  )
}
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Маркировка {{ hasProdductionOperation(stageType) }}</h1>
      </v-col>
      <v-col cols="2" class="text-right">
        <v-tooltip text="Открыть операционную карту" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn
              @click="openFileFromNet('Гравировка корпуса', OK_PATH, '/OK')"
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
  <v-divider class="mb-4"></v-divider>
  <ProductInformation :information="props.product.information" />
  <v-container>
    <v-row v-if="!component" align="center" justify="center">
      <v-col>Отсканируйте штрих-код c заводским номером корпуса</v-col>
      <v-col>
        <v-text-field
          :disabled="!!hasProdductionOperation(stageType)"
          @click:clear="clearState"
          density="compact"
          clearable
          @keyup.enter="checkSerialNumber"
          v-model="serialNumber"
          :focused="true"
          label="Сканируйте серийный номер"
          variant="solo"
          maxlength="13"
        ></v-text-field>
      </v-col>
    </v-row>
    <!-- :rules="[(value) => pattern.test(value) || 'Только цифры']" -->
  </v-container>
  <v-container
    v-if="
      props.information?.['Тип изделия'] === 'Controller' ||
      props.information?.['Тип изделия'] === 'PowerSupply' ||
      props.information?.['Тип изделия'] === 'Modules' ||
      props.information?.['Тип изделия'] === 'PAZ'
    "
  >
    <v-row
      v-if="component"
      justify="center"
      align="center"
      class="text-red text-decoration-underline"
    >
      <p class="text-center text-green">
        Необходимо нанести маркировку на лазере,
        <!-- <br />
        затем наклеить SN {{ props.product.snProduct }} на корпус с SN
        {{ component?.snComponent }}
        <br /> -->
      </p>
    </v-row>
    <v-row align="center">
      <h2 class="text-center">
        Для маркировки данного типа оборудования необходимо использовать
      </h2></v-row
    >
    <v-row align="center">
      <v-col> Оснастка </v-col>
      <v-col> {{ product.template.markingEquipment }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Шаблон для печати </v-col>
      <v-col> <v-btn @click="openFolder" color="gray-lighten-3" block>Открыть папку</v-btn> </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col>
        <v-btn :disabled="!!!component" @click="marking('passed')" color="green-lighten-3" block>
          Маркировка выполнена
        </v-btn>
      </v-col>
      <v-col>
        <v-btn :disabled="!!!component" @click="defectDialog = true" color="red-lighten-3" block
          >Брак</v-btn
        >
      </v-col>
    </v-row>

    <DefectDialog
      :dialog="defectDialog"
      :product-serial-numbers="props.product.productSerialNumbers"
      :product="props.product"
      :information="props.information"
      @update:dialog="defectDialog = $event"
      @confirmDefect="failedMarking"
    />
  </v-container>
</template>
