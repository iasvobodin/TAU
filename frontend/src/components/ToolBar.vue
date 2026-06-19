<script setup lang="ts">
import { shallowRef, watch, computed } from 'vue'
import { useCounterStore } from '@/stores/counter'
import { useNavigationStore } from '@/stores/navigation'
import { useUserStore } from '@/stores/user'
import { views } from '@/assets/interfaces'

const counterStore = useCounterStore()
const nav = useNavigationStore()
const userStore = useUserStore()

const current = shallowRef(views[nav.current])
const bgColor = computed(() => {
  if (import.meta.env.MODE === 'development') return 'pink'
  return 'primary'
})

watch(
  () => nav.current,
  (newVal) => {
    current.value = views[newVal]
  }
)

async function handleLogin() {
  const success = await userStore.getAuth()
  if (success) {
    console.log('Авторизация успешна, пользователь:', userStore.userName)
  }
}
</script>

<template>
  <!-- ШАПКА: плашка авторизации (вместо табов) -->
  <template v-if="userStore.authMode === 'login' && !userStore.isAuthorized">
    <div
      class="d-flex align-center pa-2 px-4"
      style="background: #424242; color: white; gap: 12px; min-height: 40px"
    >
      <v-icon color="white">mdi-shield-off-outline</v-icon>
      <span class="text-body-2 flex-grow-1">ТАУ — необходима авторизация</span>
      <v-btn
        variant="flat"
        color="primary"
        size="small"
        prepend-icon="mdi-login"
        @click="handleLogin"
        :loading="userStore.isLoadingUser"
      >
        Войти
      </v-btn>
    </div>
  </template>

  <!-- ШАПКА: табы (авторизован или device-режим) -->
  <template v-else>
    <v-tabs v-model="current" :bg-color="bgColor" align-tabs="title">
      <v-tab :value="views.InputControl">Входной контроль</v-tab>
      <v-tab :value="views.PreProduction">Подготовка производства</v-tab>
      <v-tab :value="views.AssemblyView">Производство</v-tab>
      <v-tab v-if="counterStore.adminView" :value="views.DevView">Администрирование</v-tab>
    </v-tabs>
  </template>

  <!-- КОНТЕНТ: показывается только если авторизован (или device-режим) -->
  <div v-if="userStore.isAuthorized || userStore.authMode !== 'login'" class="container">
    <component :is="current" :payload="nav.payload" />
  </div>
</template>
