<script setup lang="ts">
import { ref } from 'vue'
import { useCounterStore } from '@/stores/counter'
import { useUserStore } from '@/stores/user'
import { usePathsStore } from '@/stores/paths'
import type { AuthMode } from '@/assets/utils/authConfig'
import type { AppPaths } from '@/assets/utils/pathConfig'
import LabelPrintMulty from '../LabelPrintMulty.vue'
import PrintPassports from '../printPassports.vue'
import BulkAddComponents from '../BulkAddComponents.vue'

const counterStore = useCounterStore()
const userStore = useUserStore()
const pathsStore = usePathsStore()

const authMode = ref<AuthMode>(userStore.authMode)

async function onAuthModeChange(newMode: AuthMode | null) {
  if (newMode) {
    await userStore.setAuthMode(newMode)
    authMode.value = userStore.authMode
  }
}

// Метки для полей путей
const pathLabels: Record<keyof AppPaths, string> = {
  ok: 'Операционные карты (родительская папка)',
  okPdf: 'ОК PDF',
  kd: 'Конструкторская документация',
  passports: 'Паспорта',
  marking: 'Наклейки / Гравировка',
  other: 'Прочие документы',
  convertFolder: 'Папка конвертации',
  resourcesPath: 'Путь к ресурсам'
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

    <!-- Настройка сетевых путей -->
    <v-row>
      <v-col cols="12">
        <v-card variant="outlined" class="pa-4 mb-4">
          <v-card-title class="text-h6 pa-0 mb-2">Сетевые пути</v-card-title>
          <v-card-subtitle class="pa-0 mb-3 text-caption">
            Пути к сетевым папкам. Изменения применяются сразу.
          </v-card-subtitle>
          <v-card-text class="pa-0">
            <v-text-field
              v-for="(label, key) in pathLabels"
              :key="key"
              :label="label"
              :model-value="pathsStore.paths[key as keyof AppPaths]"
              @update:model-value="(v: string) => pathsStore.updatePath(key as keyof AppPaths, v)"
              hide-details
              class="mb-2"
              variant="outlined"
              density="compact"
            />
            <v-btn
              variant="text"
              color="warning"
              size="small"
              class="mt-2"
              @click="pathsStore.resetToDefaults()"
            >
              Сбросить на умолчания
            </v-btn>
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
