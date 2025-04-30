<script setup lang="ts">
import ProductInformation from '@/components/ProductInformation.vue'
import type { Prisma } from '../../../../extensions/src'
import { createProductionOperationPassed } from '@/api/productionOperationServices'
import { useUserStore } from '@/stores/user'
import type { StageType, ProductType, Tsp } from '@/assets/interfaces'

const stageType: StageType = 'package'
const props = defineProps<{
  information: ProductType['information']
  product: Tsp
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const packagePassed = async () => {
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
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col>
        <h1 class="text-center">Упаковка</h1>
      </v-col>
    </v-row>
    <v-row justify="center">
      <v-col>
        <ProductInformation :information="props.information" />
      </v-col>
    </v-row>
    <v-row justify="center">
      <v-col>
        <v-btn @click="packagePassed" color="green-lighten-3" block> Упаковано </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
