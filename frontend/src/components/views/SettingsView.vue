<script setup lang="ts">
import { ref } from 'vue'
import { useCounterStore } from '@/stores/counter'
import { useUserStore } from '@/stores/user'
import type { AuthMode } from '@/assets/utils/authConfig'
import LabelPrintMulty from '../LabelPrintMulty.vue'
import PrintPassports from '../printPassports.vue'
import BulkAddComponents from '../BulkAddComponents.vue'

const counterStore = useCounterStore()
const userStore = useUserStore()

const authMode = ref<AuthMode>(userStore.authMode)

async function onAuthModeChange(newMode: AuthMode | null) {
  if (newMode) {
    await userStore.setAuthMode(newMode)
    authMode.value = userStore.authMode
  }
}
</script>

<template>
  <v-container>
    <h1>Настройки приложения</h1>

    <!-- Настройка авторизации -->
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="pa-4 mb-4">
          <v-card-title class="text-h6 pa-0 mb-2">Авторизация</v-card-title>
          <v-card-text class="pa-0">
            <v-radio-group
              :model-value="authMode"
              @update:model-value="onAuthModeChange"
              hide-details
            >
              <v-radio label="По устройству (автоматически)" value="device">
                <template #label>
                  <div>
                    <strong>По устройству</strong>
                    <p class="text-caption text-grey mb-0">
                      Автоматическая авторизация через учётную запись Windows
                    </p>
                  </div>
                </template>
              </v-radio>
              <v-radio label="По логину (вручную)" value="login">
                <template #label>
                  <div>
                    <strong>По логину</strong>
                    <p class="text-caption text-grey mb-0">
                      Ручной ввод логина и пароля при каждом запуске
                    </p>
                  </div>
                </template>
              </v-radio>
            </v-radio-group>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row>
      <v-col align-self="center">
        <p>Разблокировать кнопки на этапе производства</p>
      </v-col>
      <v-col> <v-checkbox hide-details v-model="counterStore.settings"></v-checkbox></v-col>
    </v-row>
    <v-row v-if="userStore.userName === 'NBarnich' || userStore.userName === 'ISvobodin'">
      <v-col align-self="center">
        <p>Функциональное тестирование dev</p>
      </v-col>
      <v-col>
        <v-checkbox hide-details v-model="counterStore.functionalTestDev"></v-checkbox
      ></v-col>
    </v-row>
    <hr />
  </v-container>
  <!-- <LabelPrintMulty /> -->
  <PrintPassports />
  <v-container>
    <v-row>
      <v-col align-self="center">
        <BulkAddComponents />
      </v-col>
    </v-row>
  </v-container>
</template>
