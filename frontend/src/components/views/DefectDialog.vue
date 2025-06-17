<script setup lang="ts">
import { ref, watch, computed, type Ref } from 'vue'
import type { ProductType, Tsp } from '@/assets/interfaces'
import { printLabel } from '@/assets/printLabel'

const props = defineProps<{
  dialog: boolean
  productSerialNumbers: string[]
  // productionOperationAlarm: string
  product: Tsp
  information: ProductType['information']
}>()

const emit = defineEmits<{
  (e: 'update:dialog', value: boolean): void
  (e: 'confirmDefect', failedComponents: string[], comment: string): void
  (e: 'printDefectLabel'): void
  // (e: 'update:productionOperationAlarm', value: string): void
}>()

const comment = ref('')
const failedComponents: Ref<string[]> = ref([])
const printLabelDone = ref(false)
// Сбрасываем состояние при закрытии диалога
watch(
  () => props.dialog,
  (newValue) => {
    if (!newValue) {
      comment.value = ''
      failedComponents.value = []
    }
  }
)

// Наблюдаем за failedComponents и обновляем productionOperationAlarm
// watch(failedComponents, () => {
//   if (
//     props.product.productionOperations.length > 0 &&
//     failedComponents.value.some((j) => j === props.product.productionOperations[0]?.usedComponents)
//   ) {
//     emit(
//       'update:productionOperationAlarm',
//       `${props.product.productionOperations[0].usedComponents} Этот компонент был задействован в
//        "${props.product.productionOperations[0].stageType}"`
//     )
//   } else {
//     emit('update:productionOperationAlarm', '')
//   }
// })

// Обработчик подтверждения брака
const confirmDefect = () => {
  emit('confirmDefect', failedComponents.value, comment.value)
}

// // Обработчик печати наклейки брака
// const printDefectLabel = () => {
//   emit('printDefectLabel')
// }

const printLabelDeffect = async () => {
  const modifiedInformation = JSON.parse(
    JSON.stringify(props.information)
  ) as ProductType['information']
  const modifiedProduct = JSON.parse(JSON.stringify(props.product)) as Tsp
  modifiedProduct.information['Тип изделия'] = 'Defective'
  const p2 = { product: modifiedProduct, information: modifiedInformation }
  console.log(p2)
  await printLabel(p2)
}

const isButtonDisabled = computed(() => {
  return !(failedComponents.value.length > 0 && comment.value && printLabelDone.value)
})
</script>

<template>
  <v-dialog :model-value="dialog" width="auto" @update:model-value="emit('update:dialog', $event)">
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
              :items="productSerialNumbers"
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
              hide-details
              rows="2"
              variant="solo"
              v-model="comment"
              clearable
              label="Комментарий"
            ></v-textarea>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn @click="printLabelDeffect" color="grey-lighten-3" block>
              Печать наклейки Брак
            </v-btn>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Подтвердите действие</h3>
            <!-- <h3 v-if="productionOperationAlarm" class="text-red text-center">
              {{ productionOperationAlarm }} <br />
              Данная операция будет удалена
            </h3>
            <br /> -->
            <p class="text-center">Брак компонентов SN {{ failedComponents.join(', ') }}</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col align-self="center" cols="9">
            <h4 class="text-red">Наклейка брак, распечатана</h4>
          </v-col>
          <v-col align-self="center" cols="3">
            <v-checkbox hide-details v-model="printLabelDone"></v-checkbox>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn :disabled="isButtonDisabled" color="red-lighten-3" @click="confirmDefect" block>
              OK
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>
