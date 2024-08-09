<script setup lang="ts">
import { ref } from 'vue'
import type { StageType, ProductType, ProductAllPayload } from '@/assets/interfaces'
import ProductInformation from '@/components/ProductInformation.vue'
import type { Ref } from 'vue'
import type { Component, Prisma } from '../../../../extensions/src'
import {
  createProductionOperationPassed,
  createProductionOperationFailed
} from '@/api/productionOperationServices'
import { updateComponent } from '@/api/componentServices'
import { useUserStore } from '@/stores/user'
import { useErrorStore } from '@/stores/errorStore'
import { fetchComponent } from '@/api/componentServices'
import { type TransformSpecification } from '@/assets/transformSP'
const props = defineProps<{
  information: ProductType['information']
  product: TransformSpecification
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()
const failedComponents: Ref<string[]> = ref([])
const serialNumber = ref('')
const information = ref('')
const pattern = /^\d+$/
const component: Ref<Component | null> = ref(null)
const errorStore = useErrorStore()
const defectDialog = ref(false)
const comment = ref('')

const checkSerialNumber = async ($event: Event) => {
  const target = $event.target as HTMLTextAreaElement
  if (target.value.length === 8 && pattern.test(target.value)) {
    clearState()
    const result = await fetchComponent(target.value)
    if (!result.data) {
      //ошибка с сервера, сьрасываем
      serialNumber.value = ''
      return
    } else if (result.data.snProductId) {
      errorStore.addError(`Данный компонент уже используется в ${result.data.snProductId}`)
      setTimeout(errorStore.removeError, 5000)
      serialNumber.value = ''
    } else if (result.data.status === 'failed') {
      errorStore.addError(`Данный компонент забракован`)
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
  }
}

const markingPassed = async () => {
  //создать новоую операцию по маркировке и привязать её к продукту
  const productionOperatioData: Prisma.ProductionOperationUncheckedCreateInput = {
    stageType: 'marking',
    status: 'passed',
    user: useUserStore().userFullName,
    productId: props.product.snProduct,
    usedComponents: component.value!.snComponent
  }

  const resultCreate = await createProductionOperationPassed(productionOperatioData)
  console.log(resultCreate.data)
  if (resultCreate.error) {
    return
  }
  //привязать кмопонент корпуса к продукту
  const componentData = {
    status: 'passed',
    snProductId: props.product.snProduct
  }

  const resultUpdate = await updateComponent(component.value!.snComponent, componentData)
  console.log(resultUpdate.data)

  if (resultUpdate.error) {
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
    status: 'failed',
    user: useUserStore().userFullName,
    componentId: serialNumber.value,
    productSN: props.product.snProduct,
    comment: comment.value,
    usedComponents: failedComponents.value.join(', ')
    // productId: props.product.snProduct
  }
  const resultCreate = await createProductionOperationFailed(productionOperatioData)
  console.log(resultCreate.data)
  if (resultCreate.error) {
    return
  }
  //обновляем компонент со статусом брак
  const resultUpdate = await updateComponent(component.value!.snComponent, {
    status: 'failed'
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
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Маркировка</h1>
      </v-col>
    </v-row>
  </v-container>
  <v-divider class="mb-4"></v-divider>
  <ProductInformation :information="props.product.information" />
  <v-container>
    <v-row align="center" justify="center">
      <v-col>Отсканируйте штрих-код c заводским номером корпуса</v-col>
      <v-col>
        <v-text-field
          @click:clear="clearState"
          density="compact"
          clearable
          @input="checkSerialNumber"
          v-model="serialNumber"
          :focused="true"
          label="Сканируйте серийный номер"
          variant="solo"
          maxlength="8"
          :rules="[(value) => pattern.test(value) || 'Только цифры']"
        ></v-text-field>
      </v-col>
    </v-row>
    <v-row
      v-if="component"
      justify="center"
      align="center"
      class="text-red text-decoration-underline"
    >
      <p class="text-center text-green">
        Необходимо нанести маркировку на лазере,<br />
        затем наклеить SN {{ props.product.snProduct }} на корпус с SN
        {{ component?.snComponent }}
        <br /></p
    ></v-row>
    <v-row> <h2>Для маркировки данного типа оборудования необходимо использовать</h2></v-row>
  </v-container>
  <v-container v-if="product">
    <v-row align="center">
      <v-col> Оснастка </v-col>
      <v-col> {{ product.template.markingEquipment }} </v-col>
    </v-row>
    <v-row align="center">
      <v-col> Шаблон для печати </v-col>
      <v-col> {{ product.template.markingTemplate }} </v-col>
    </v-row>
    <v-row>
      <v-col>
        <v-btn :disabled="!!!component" @click="markingPassed" color="green-lighten-3" block>
          Маркировка выполнена
        </v-btn>
      </v-col>
      <v-col>
        <v-btn :disabled="!!!component" @click="defectDialog = true" color="red-lighten-3" block
          >Брак</v-btn
        >
      </v-col>
    </v-row>
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
              <v-textarea
                variant="solo"
                v-model="comment"
                clearable
                label="Комментарий"
              ></v-textarea>
            </v-col>
          </v-row>
          <v-row justify="center">
            <v-col>
              <h3 class="text-center">Подтвердите действие</h3>
              <br />
              <p class="text-center">Брак компонентов SN {{ failedComponents.join(', ') }}</p>
            </v-col>
          </v-row>
          <v-row>
            <v-col>
              <v-btn
                :disabled="!!!comment || !!!failedComponents.length"
                color="red-lighten-3"
                @click="markingFailed"
                block
                >OK</v-btn
              >
            </v-col>
          </v-row>
        </v-container>
      </v-card>
    </v-dialog>
    <!-- <v-dialog v-model="defectDialog" width="auto">
      <v-card class="pa-10" justify="center" min-width="400">
        <v-container>
          <v-row align="center" justify="center">
            <v-col class="pa-1"><p>Комментарий</p></v-col>
            <v-col class="pa-1">
              <v-textarea
                variant="solo"
                v-model="comment"
                clearable
                label="Причина брака"
              ></v-textarea>
            </v-col>
          </v-row>
          <v-row>
            <v-col><p class="text-red text-center">Подтвердить действие</p></v-col>
            <v-col>
              <v-btn
                :disabled="!!!component || !!!comment"
                @click="markingFailed"
                color="red-lighten-3"
                block
                >OK</v-btn
              >
            </v-col>
          </v-row>
        </v-container>
      </v-card>
    </v-dialog> -->
  </v-container>
</template>
