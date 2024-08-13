<script setup lang="ts">
import type { ProductType } from '@/assets/interfaces'
const props = defineProps<{
  information: ProductType['information']
}>()
</script>

<template>
  <v-container class="border rounded-lg pa-4">
    <v-row align="center">
      <v-col class="pa-1"> <h2>Информация</h2> </v-col>
    </v-row>
    <v-row v-for="(value, key, index) in props.information" :key="index">
      <v-col class="pa-1">{{ key }} </v-col>
      <v-col class="pa-1"> {{ value }} </v-col>
    </v-row>
  </v-container>
</template>
