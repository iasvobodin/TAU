<script setup lang="ts">
import { fetchAllProduct } from '@/api/productServices';
import { onMounted } from 'vue';
import type { ProductAllPayload } from '@/assets/interfaces';

// const getProducts = async () =>{


// }
// getProducts()
onMounted(async() =>{
const result = await fetchAllProduct()
console.log(result.data);

const REQUIRED_STAGES = ['marking', 'assembly', 'functionalTest', 'package'] as const;
const ALLOWED_TYPES = ['Controller', 'PowerSupply', 'Modules', 'PAZ', 'TerminalBlocks'] as const;

type StageType = typeof REQUIRED_STAGES[number];
type AllowedType = typeof ALLOWED_TYPES[number];

interface ProductWithMissingStages {
  id: number;
  snProduct: string;
  type: AllowedType;
  existingStages: StageType[];
  missingStages: StageType[];
}

// products: ProductAllPayload[]
function findProductsWithMissingOperations(products: ProductAllPayload[]): ProductWithMissingStages[] {
  return products
    .filter(product => ALLOWED_TYPES.includes(product.specification?.type as AllowedType))
    .map(product => {
      const existingStages = product.productionOperations.map(op => op.stageType as StageType);
      const missingStages = REQUIRED_STAGES.filter(stage => !existingStages.includes(stage));

      if (missingStages.length > 0) {
        return {
          id: product.id,
          snProduct: product.snProduct,
          type: product.specification.type as AllowedType,
          existingStages,
          missingStages
        };
      }

      return null;
    })
    .filter((item): item is ProductWithMissingStages => item !== null);
}


const ddd = findProductsWithMissingOperations(result.data!)
console.log(ddd,'DDD');














})
</script>

<template>
  <h1>Hello ZNP</h1>
</template>
