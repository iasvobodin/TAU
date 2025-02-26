<script setup lang="ts">
import { reactive, ref, shallowRef, type Ref } from 'vue'
import { fetchProduct } from '@/api/productServices'
import type { ProductType, ProductAllPayload } from '@/assets/interfaces'
import ProductMarking from '@/components/views/ProductMarking.vue'
import ProductAssembly from '@/components/views/ProductAssembly.vue'
import ProductFunctionalTest from '@/components/views/ProductFunctionalTest.vue'
import ProductPackage from '@/components/views/ProductPackage.vue'
import ProductInformation from '@/components/ProductInformation.vue'
import { transformSpecification, type TransformSpecification } from '@/assets/transformSP'
import { generatePasport } from '@/assets/generatePasport'

const productSerialNumber = ref('')
const current = shallowRef(ProductMarking)
const dialog = ref(false)
const currentStep = ref(0)
const tsp: Ref<TransformSpecification | null> = ref(null)

const product: ProductType = reactive({
  specification: null,
  information: null,
  error: null,
  qty: null,
  spPartNumber: null,
  serialNumbers: null,
  failedStage: ''
})
const pattern = /^TAU\d{11}$/
const operationsMap = {
  marking: { name: 'Маркировка', component: ProductMarking },
  assembly: { name: 'Сборка', component: ProductAssembly },
  functionalTest: { name: 'Функциональное тестирование', component: ProductFunctionalTest },
  package: { name: 'Упаковка', component: ProductPackage }
}

const selectOperation = (key: keyof typeof operationsMap) => {
  dialog.value = true

  current.value = operationsMap[key].component || null

  if (!operationsMap[key]) {
    console.warn(`Unknown operation key: ${key}`)
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

const checkProductOnFailed = (data: ProductAllPayload) => {
  const failed = data.productionOperations.find((e) => {
    if (e.status === 'failed') {
      return e
    }
  })
  if (failed) {
    product.failedStage = failed.stageType
    return false
  }
  return true
}

const getProduct = async (cleared: boolean = true) => {
  if (pattern.test(productSerialNumber.value)) {
    //перед новым запросом отчищаем данные
    if (cleared) {
      clear()
    }
    console.log(productSerialNumber.value, 'productSerialNumber.value')

    const result = await fetchProduct(productSerialNumber.value)

    if (result.data) {
      console.log(result.data)
      console.log(tsp.value)
      tsp.value = await transformSpecification(result.data)

      product.information = {
        'SN изделия': result.data.snProduct,
        'Артикул изделия': result.data.specification.productMP,
        'Наименование изделия': result.data.specification.productName
      }
      //проверяем на брак
      checkProductOnFailed(result.data) && (product.specification = result.data)

      currentStep.value = product.specification!.productionOperations.length
    }

    product.error = result.error
  }
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
    failedStage: ''
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
const getButtonColor = (key: string, index: number) => {
  if (hasProdductionOperation(key)) {
    return 'blue'
  } else if (currentStep.value !== index) {
    return 'gray-lighten-3'
  } else {
    return 'green-lighten-3'
  }
}
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
</script>

<template>
  <h1>Сборка</h1>
  <v-divider class="border-opacity-50" color="info"></v-divider>
  <v-container>
    <v-row align="center" justify="center">
      <v-col>Отсканируйте штрих-код c серийным номером продукта и <b>нажмите enter</b></v-col>
      <!-- TAU32243000001 -->
      <v-col>
        <v-text-field
          @keyup.enter="getProduct"
          @click:clear="removeProduct"
          density="compact"
          v-model="productSerialNumber"
          hide-details="auto"
          clearable
          label="пример TAU29243000001"
          variant="solo"
          :rules="[(value) => pattern.test(value) || 'не соответствует шаблону']"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <div v-if="product.error">{{ product.error }}</div>
  <ProductInformation v-else-if="product.information" :information="tsp!.information" />
  <v-container v-if="product.specification">
    <v-row align="center">
      <v-col> <h3>Список операций для данного продукта</h3> </v-col>
    </v-row>
    <v-row v-for="(value, key, index) in tsp!.operation" :key="index">
      <template v-if="value && typeof value === 'boolean'">
        <v-col>
          <v-btn
            :disabled="currentStep !== index"
            @click="selectOperation(key as keyof typeof operationsMap)"
            :color="getButtonColor(key, index)"
            block
          >
            {{ operationsMap[key as keyof typeof operationsMap].name
            }}{{ hasProdductionOperation(key) }}
          </v-btn>
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
  <v-container v-if="product.failedStage">
    <v-row align="center">
      <v-col>
        <h3 class="text-red text-center ma-2 pa-2">
          Продукт забракован на этапе {{ product.failedStage }}
        </h3>
        <v-btn block variant="outlined" @click="dialog = false" rounded="lg" size="large"
          >Определить бракованный компонент</v-btn
        >
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
      ></component>
      <template v-slot:actions> </template>
    </v-card>
  </v-dialog>

  <div>
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
