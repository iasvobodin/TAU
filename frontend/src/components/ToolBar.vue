<script setup lang="ts">
import { shallowRef, ref } from 'vue'
import InputControl from './views/InputControl.vue'
import PreProduction from './views/PreProduction.vue'
import AssemblyView from './views/AssemblyView.vue'
import DevView from './views/DevView.vue'
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()
const current = shallowRef(InputControl)
const tab = ref(null)
</script>

<template>
  <v-tabs align-tabs="title" v-model="current" bg-color="primary">
    <v-tab :value="InputControl">Входной контроль</v-tab>
    <v-tab :value="PreProduction">Подготовка производства</v-tab>
    <v-tab :value="AssemblyView">Производство</v-tab>
    <v-tab v-if="counterStore.adminView" :value="DevView">Администрирование</v-tab>
  </v-tabs>
  <div class="container">
    <!-- <KeepAlive> -->
    <component :is="current"></component>
    <!-- </KeepAlive> -->
  </div>
</template>

<style>
.container {
  display: grid;
  margin: auto;
  margin-top: 3vh;
  width: 95vw;
}
</style>
