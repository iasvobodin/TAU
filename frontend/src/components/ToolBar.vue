<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import { useCounterStore } from '@/stores/counter'
import { useNavigationStore } from '@/stores/navigation'
import { views } from '@/assets/interfaces'

// import InputControl from './views/InputControl.vue'
// import PreProduction from './views/PreProduction.vue'
// import AssemblyView from './views/AssemblyView.vue'
// import DevView from './views/DevView.vue'

const counterStore = useCounterStore()
const nav = useNavigationStore()

const current = shallowRef(views[nav.current])
const bgColor = import.meta.env.MODE === 'development' ? 'red' : 'primary'

watch(
  () => nav.current,
  (newVal) => {
    current.value = views[newVal]
  }
)
</script>

<template>
  <v-tabs v-model="current" :bg-color="bgColor" align-tabs="title">
    <v-tab :value="views.InputControl">Входной контроль</v-tab>
    <v-tab :value="views.PreProduction">Подготовка производства</v-tab>
    <v-tab :value="views.AssemblyView">Производство</v-tab>
    <v-tab v-if="counterStore.adminView" :value="views.DevView">Администрирование</v-tab>
  </v-tabs>

  <div class="container">
    <component :is="current" :payload="nav.payload" />
  </div>
</template>
