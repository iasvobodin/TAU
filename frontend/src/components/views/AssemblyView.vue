<script setup lang="ts">
import { reactive, ref, shallowRef,onMounted, type Ref } from 'vue'
import { fetchProduct } from '@/api/productServices'
import { fetchComponent } from '@/api/componentServices'
import type { ProductType, ProductAllPayload, Tsp, Information } from '@/assets/interfaces'
import ProductMarking from '@/components/views/ProductMarking.vue'
import ProductAssembly from '@/components/views/ProductAssembly.vue'
import { fetchProductionOperationByProductSN } from '@/api/productionOperationServices'
import ProductFunctionalTest from '@/components/views/ProductFunctionalTest.vue'
import ProductPackage from '@/components/views/ProductPackage.vue'
import ProductInformation from '@/components/ProductInformation.vue'
import { transformSpecification } from '@/assets/transformSP'
import { generatePasport } from '@/assets/generatePasport'
import { useErrorStore } from '@/stores/errorStore'

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

const checkProductOnFailed = async (data: ProductAllPayload) => {
  try {
    errorStore.disableErrorOutput()

    const { data: failedData } = await fetchProductionOperationByProductSN(data.snProduct)

    if (Array.isArray(failedData) && failedData.length > 0) {
      // Ищем первый элемент с status 'failed'
      const failedItem = failedData.find((item) => item.status === 'failed')

      if (failedItem) {
        // Логика для случая, если хотя бы один элемент имеет status 'failed'
        product.failedStage = failedItem.stageType
        return false
      }

      // Логика, если не найдено элементов с status 'failed'
      const acceptedItem = failedData.find((item) => item.status === 'accepted')
      if (acceptedItem) {
        console.log('Продукт принят, можно продолжить.')
        return true
      }
    }
  } catch (error) {
    console.error('Error in checkProductOnFailed:', error)
  } finally {
    errorStore.enableErrorOutput()
  }

  return true
}

const findTauSerialNumber = async (input: string) => {
  const tryFetchComponentThenProduct = async (id: string) => {
    try {
      const result = await fetchComponent(id)
      const snId = result.data?.snProductId
      if (snId) {
        return await fetchProduct(snId)
      }
    } catch (error) {
      console.warn(`Component fetch failed for ${id}:`, error)
    }
    return null
  }

  if (pattern.test(input)) {
    // TAUSN
    try {
      return await fetchProduct(input)
    } catch (error) {
      console.error('Product fetch failed:', error)
    }
  } else {
    // NOT TAUSN
    // Отключаем вывод ошибок перед запросом
    errorStore.disableErrorOutput()
    const result = await tryFetchComponentThenProduct(input)
    // Включаем вывод ошибок обратно
    errorStore.enableErrorOutput()
    if (result) return result

    // нефига не корпус, пробуем с -02
    return await tryFetchComponentThenProduct(input + '-02')
  }
}

const getProduct = async (cleared: boolean = true) => {
  if (cleared) {
    clear()
  }
  // console.log(productSerialNumber.value, 'productSerialNumber.value')

  const result = await findTauSerialNumber(productSerialNumber.value)

  if (result && result.data) {
    // console.log(result.data)
    // console.log(tsp.value)
    tsp.value = await transformSpecification(result.data)

    product.information = {
      'SN изделия': result.data.snProduct,
      'Артикул изделия': result.data.specification.productMP,
      'Наименование изделия': result.data.specification.productName,
      'Тип изделия': result.data.specification.type as Information['Тип изделия']
    }
    //проверяем на брак
    ;(await checkProductOnFailed(result.data)) && (product.specification = result.data)
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
// :rules="[(value) => pattern.test(value) || 'не соответствует шаблону']"

const serialNumberInput = ref<InstanceType<typeof import('vuetify/components').VTextField> | null>(null);
onMounted(() => {
  serialNumberInput.value?.$el.querySelector('input')?.focus()
})

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
        ref="serialNumberInput"
          @keyup.enter="getProduct"
          @click:clear="removeProduct"
          density="compact"
          v-model="productSerialNumber"
          hide-details="auto"
          clearable
          label="пример TAU29243000001"
          variant="solo"
        ></v-text-field>
      </v-col>
    </v-row>
  </v-container>
  <div v-if="product.error">{{ product.error }}</div>
  <ProductInformation v-else-if="product.information" :information="tsp!.information" />
  <v-container v-if="product.specification">
    <v-row align="center">
      <v-col>
        <h3>Список операций для данного продукта</h3>
      </v-col>
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
        <h2 class="text-red text-center ma-2 pa-2">
          Продукт забракован на этапе
          {{
            operationsMap[
              product.failedStage as keyof typeof operationsMap
            ].name.toLocaleLowerCase()
          }}. <br />
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
