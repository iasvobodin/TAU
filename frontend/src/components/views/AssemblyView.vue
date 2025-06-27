<script setup lang="ts">
import { reactive, ref, shallowRef, onMounted, type Ref } from 'vue'
import { fetchProduct } from '@/api/productServices'
import { fetchComponent } from '@/api/componentServices'
import type { ProductType, ProductAllPayload, Tsp, Information } from '@/assets/interfaces'
import ProductMarking from '@/components/views/ProductMarking.vue'
import ProductAssembly from '@/components/views/ProductAssembly.vue'
import {
  deleteProductionOperation,
  fetchProductionOperationByProductSN
} from '@/api/productionOperationServices'
import ProductFunctionalTest from '@/components/views/ProductFunctionalTest.vue'
import ProductPackage from '@/components/views/ProductPackage.vue'
import ProductInformation from '@/components/ProductInformation.vue'
import { transformSpecification } from '@/assets/transformSP'
import { generatePasport } from '@/assets/generatePasport'
import { useErrorStore } from '@/stores/errorStore'
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()
const errorStore = useErrorStore()

const productSerialNumber = ref('')
const current = shallowRef(ProductMarking)
const dialog = ref(false)
const currentStep = ref(0)
const tsp: Ref<Tsp | null> = ref(null)

const product: ProductType = reactive({
  specification: null,
  information: null,
  error: null,
  qty: null,
  spPartNumber: null,
  serialNumbers: null,
  failed: false
})
const pattern = /^TAU\d{11}$/

const operationsMap = {
  marking: { name: 'Маркировка', component: ProductMarking },
  assembly: { name: 'Сборка', component: ProductAssembly },
  functionalTest: { name: 'Функциональное тестирование', component: ProductFunctionalTest },
  package: { name: 'Передача на склад', component: ProductPackage }
}

const selectOperation = (key: keyof typeof operationsMap) => {
  dialog.value = true

  current.value = operationsMap[key].component || null

  if (!operationsMap[key]) {
    console.warn(`Unknown operation key: ${key}`)
  }
}

const getButtonColor = (key: string, index: number) => {
  if (hasProdductionOperation(key)) {
    return 'blue'
  } else if (currentStep.value !== index) {
    return 'gray-lighten-3'
  } else {
    return 'green-lighten-3'
  }
}

const hasProdductionOperation = (stageType: string) => {
  //ищем по ключу наличие производственных операций
  const stage = product.specification?.productionOperations.some((e) => e.stageType === stageType)
  if (stage) {
    return ' - Операция выполнена'
  }
}

const closeDialogAndCheck = () => {
  dialog.value = false
  getProduct(false)
}

// const checkProductOnFailed = async (data: ProductAllPayload) => {
// // проверяем содержит ли продукт бракованные компоненты, так как поменялась логика, и компоненты теперь не отвязываются
// product.failed = data.components.some(e => e.status === 'on_hold')
// // console.log(promises,data.components,'promisespromisespromisespromises');

//   try {
//     errorStore.disableErrorOutput()

//     // const { data: failedData } = await fetchProductionOperationByProductSN(data.snProduct)
//     const failedData = data.productionOperations
//     // data.comment === 'on_hold'

//     if (Array.isArray(failedData) && failedData.length > 0) {
//       // Ищем первый элемент с status 'on_hold'
//       const failedItem = failedData.find((item) => item.status === 'on_hold')

//       if ( data.comment === 'on_hold') {
//         // Логика для случая, если хотя бы один элемент имеет status 'on_hold'
//         // product.failed = 'on_hold' //failedItem.stageType
//         return false
//       }

//       // Логика, если не найдено элементов с status 'on_hold'
//       const acceptedItem = failedData.find((item) => item.status === 'accepted')
//       if (acceptedItem) {
//         console.log('Продукт принят, можно продолжить.')
//         return true
//       }
//     }
//   } catch (error) {
//     console.error('Error in checkProductOnFailed:', error)
//   } finally {
//     errorStore.enableErrorOutput()
//   }

//   return true
// }

const tryFetchComponentThenProduct = async (snComponent: string) => {
  try {
    // пробуем запросить компонент
    const result = await fetchComponent(snComponent)
    // проверяем привязан ли он к продукту
    const snId = result.data?.snProductId
    if (snId) {
      //если да, то возвращаем сам продукт
      return await fetchProduct(snId)
    }
  } catch (error) {
    console.warn(`Component fetch failed for ${snComponent}:`, error)
  }
  return null
}

const findTauSerialNumber = async (input: string) => {
  if (pattern.test(input)) {
    // это сериёный номер тау TAUSN
    try {
      //если да, то возвращаем сам продукт
      return await fetchProduct(input)
    } catch (error) {
      console.error('Product fetch failed:', error)
    }
  } else {
    // просто какое-то число из инпута думаем что это корпус
    // Отключаем вывод ошибок перед запросом
    errorStore.disableErrorOutput()
    const result = await tryFetchComponentThenProduct(input)
    // Включаем вывод ошибок обратно
    errorStore.enableErrorOutput()
    if (result) return result

    // нефига не корпус, значит уже собрали и это оригинальный серийник пробуем с -02
    return await tryFetchComponentThenProduct(input + '-02')
  }
}

const getProduct = async (cleared: boolean = true) => {
  // с отчисткой стэйта
  if (cleared) {
    clear()
  }

  const result = await findTauSerialNumber(productSerialNumber.value)

  if (result && result.data) {
    console.log(result.data, 'product')
    // console.log(tsp.value)
    tsp.value = await transformSpecification(result.data)

    product.information = {
      'SN изделия': result.data.snProduct,
      'Артикул изделия': result.data.specification.productMP,
      'Наименование изделия': result.data.specification.productName,
      'Тип изделия': result.data.specification.type as Information['Тип изделия']
    }
    //проверяем на брак
    product.failed = result.data.components.some((e) => e.status === 'on_hold')
    product.specification = result.data

    if (product.specification) {
      if (Array.isArray(product.specification!.productionOperations)) {
        currentStep.value = product.specification!.productionOperations.length
      }
    }
  }

  result && result.error && (product.error = result.error)
  // }
}

const clear = () => {
  currentStep.value = 0
  Object.assign(product, {
    specification: null,
    information: null,
    error: null,
    qty: null,
    spPartNumber: null,
    serialNumbers: null,
    failed: false
  })
}

const removeProduct = () => {
  productSerialNumber.value = ''
  clear()
}

// Хранение текущего шага

// Обработчик нажатия кнопок
// const handleButtonClic2k = (step: number) => {
//   currentStep.value = step + 1
// }

// Данные о кнопках
const buttons = [
  { label: 'Button 1', step: 1 },
  { label: 'Button 2', step: 2 },
  { label: 'Button 3', step: 3 },
  { label: 'Button 4', step: 4 }
]
// Обработчик нажатия кнопок
const handleButtonClick = (step: number) => {
  // Обновляем currentStep, если кнопка нажата последовательно
  if (step === currentStep.value + 1) {
    currentStep.value = step
  }
}
// :rules="[(value) => pattern.test(value) || 'не соответствует шаблону']"

//настройка автофокуса в компоненте

const serialNumberInput = ref<InstanceType<typeof import('vuetify/components').VTextField> | null>(
  null
)
const deleteCurrentOperation = async (operation: string) => {
  // находим операцию маркировки, тоже меняем он холд
  const id = product.specification?.productionOperations.find((e) => e.stageType === operation)?.id

  try {
    id && (await deleteProductionOperation(id))
  } catch (error) {
    console.log(error)
  }
  getProduct()
}

onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})
</script>

<template>
  <h1>Сборка</h1>
  <v-divider class="border-opacity-50" color="info"></v-divider>
  <v-container>
    <v-row align="center" justify="center">
      <v-col
        >Отсканируйте штрих-код c серийным номером полуфабриката,или корпуса и
        <b>нажмите enter</b></v-col
      >
      <!-- TAU32243000001 -->
      <v-col>
        <v-text-field
          ref="serialNumberInput"
          @keyup.enter="getProduct"
          @click:clear="removeProduct"
          density="compact"
          v-model="productSerialNumber"
          hide-details="auto"
          clearable
          label="TAU29243000001 или SN компонента"
          variant="solo"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <div v-if="product.error">{{ product.error }}</div>
  <ProductInformation v-else-if="product.information" :information="tsp!.information" />
  <v-container v-if="product.specification && !product.failed">
    <v-row align="center">
      <v-col>
        <h3>Список операций для данного продукта</h3>
      </v-col>
    </v-row>
    <!-- кнопки с операциями -->
    <v-row v-for="(value, key, index) in tsp!.operation" :key="index">
      <template v-if="value && typeof value === 'boolean'">
        <v-col>
          <v-btn
            :disabled="!counterStore.settings ? currentStep !== index : false"
            @click="selectOperation(key as keyof typeof operationsMap)"
            :color="getButtonColor(key, index)"
            block
          >
            {{ operationsMap[key as keyof typeof operationsMap].name
            }}{{ hasProdductionOperation(key) }}
          </v-btn>
        </v-col>
        <v-col v-if="counterStore.settings" cols="2">
          <v-btn
            small
            color="red"
            v-if="hasProdductionOperation(key)"
            @click="deleteCurrentOperation(key)"
            >Удалить</v-btn
          >
        </v-col>
      </template>
    </v-row>
    <v-row>
      <v-col>
        <v-btn
          block
          v-if="tsp && currentStep === 4"
          @click="
            generatePasport(
              tsp.information['Наименование изделия'],
              tsp.information['Артикул изделия'],
              tsp.information['SN изделия'],
              tsp.specification,
              tsp.productionOperations
            )
          "
        >
          Паспорт технологический
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
  <v-container v-if="product.failed">
    <v-row align="center">
      <v-col>
        <h2 class="text-red text-center ma-2 pa-2">
          Продукт забракован <br />
          Обратитесь к инженеру по качеству!
        </h2>
        <!-- <v-btn block variant="outlined" @click="dialog = true" rounded="lg" size="large"
          >Определить бракованный компонент</v-btn
        > -->
      </v-col>
    </v-row>
  </v-container>
  <v-dialog :fullscreen="true" v-model="dialog" width="100%">
    <v-toolbar color="white" density="compact">
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialogAndCheck">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card v-if="tsp">
      <component
        @done="closeDialogAndCheck"
        :is="current"
        :product="tsp"
        :information="product.information"
      >
      </component>
      <template v-slot:actions> </template>
    </v-card>
  </v-dialog>

  <div v-show="false">
    <v-btn
      v-for="button in buttons"
      :key="button.step"
      :disabled="currentStep !== button.step - 1"
      @click="handleButtonClick(button.step)"
    >
      {{ button.label }}
    </v-btn>
  </div>
</template>

<style>
.active {
  color: red;
}
</style>
