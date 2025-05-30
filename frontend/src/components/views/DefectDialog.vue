<script setup lang="ts">
import { ref, watch, type Ref } from 'vue'
import type { ProductType, Tsp } from '@/assets/interfaces'

const props = defineProps<{
  dialog: boolean
  productSerialNumbers: string[]
  productionOperationAlarm: string
  product: Tsp
  information: ProductType['information']
}>()

const emit = defineEmits<{
  (e: 'update:dialog', value: boolean): void
  (e: 'confirmDefect', failedComponents: string[], comment: string): void
  (e: 'printDefectLabel'): void
  (e: 'update:productionOperationAlarm', value: string): void
}>()

const comment = ref('')
const failedComponents: Ref<string[]> = ref([])

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
watch(failedComponents, () => {
  if (
    props.product.productionOperations.length > 0 &&
    failedComponents.value.some((j) => j === props.product.productionOperations[0]?.usedComponents)
  ) {
    emit(
      'update:productionOperationAlarm',
      `${props.product.productionOperations[0].usedComponents} Этот компонент был задействован в 
       "${props.product.productionOperations[0].stageType}"`
    )
  } else {
    emit('update:productionOperationAlarm', '')
  }
})

// Обработчик подтверждения брака
const confirmDefect = () => {
  emit('confirmDefect', failedComponents.value, comment.value)
}

// Обработчик печати наклейки брака
const printDefectLabel = () => {
  emit('printDefectLabel')
}
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
            <v-textarea variant="solo" v-model="comment" clearable label="Комментарий"></v-textarea>
          </v-col>
        </v-row>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">Подтвердите действие</h3>
            <br />
            <h3 v-if="productionOperationAlarm" class="text-red text-center">
              {{ productionOperationAlarm }} <br />
              Данная операция будет удалена
            </h3>
            <br />
            <p class="text-center">Брак компонентов SN {{ failedComponents.join(', ') }}</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn @click="printDefectLabel" color="grey-lighten-3" block>
              Печать наклейки Брак
            </v-btn>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              :disabled="!comment || !failedComponents.length"
              color="red-lighten-3"
              @click="confirmDefect"
              block
            >
              OK
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>
