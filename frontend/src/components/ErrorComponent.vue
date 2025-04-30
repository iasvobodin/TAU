<template>
  <Teleport to="body">
    <v-alert 
     class="alert" v-if="errorMessage[0]" title="Ошибка" type="error" >
      <li v-for="(message, index) in errorMessage" :key="index">
        {{ message }}
      </li>
    </v-alert>
    <v-alert class="alert" v-if="infoMessage[0]" title="Инфо" type="info">
      <li v-for="(message, index) in infoMessage" :key="index">
        {{ message }}
      </li>
    </v-alert>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useErrorStore } from '@/stores/errorStore'

const errorStore = useErrorStore()
const errorMessage = computed(() => errorStore.errorMessages)
const infoMessage = computed(() => errorStore.infoMessages)
</script>

<style scoped>
.alert {
  position: fixed;
  top: 40px;
  width: 100%;
  margin: auto;
  z-index: 9999;
  opacity: 0,1;
}
</style>
