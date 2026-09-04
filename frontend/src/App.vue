<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, watch, computed } from 'vue'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { usePartNumberComponents } from './stores/partNumberComponents'
import { useWebSocketStore } from './stores/websockets'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { useCounterStore } from './stores/counter'
import { mountServer } from './assets/utils/mountServer'
import { appConfig } from '@/assets/utils/AppConfig'
import { UpdateChecker } from '@/assets/utils/updateChecker'
import type { ManifestData, ManifestVersion } from '@/assets/utils/updateChecker'
import UpdateDialog from '@/components/UpdateDialog.vue'

const counterStore = useCounterStore()
const userStore = useUserStore()
const wsStore = useWebSocketStore()

const showUserDialog = ref(false)

// ─── Update Checker ────────────────────────────────────────────────────────
const showUpdateDialog = ref(false)
const updateManifest = ref<ManifestData | null>(null)
const updateLatestVersion = ref<ManifestVersion | null>(null)
let updateChecker: UpdateChecker | null = null

function onUpdateAvailable(manifest: ManifestData, latest: ManifestVersion) {
  updateManifest.value = manifest
  updateLatestVersion.value = latest
  showUpdateDialog.value = true
}

async function onUpdateNow() {
  showUpdateDialog.value = false
  if (updateChecker) {
    await updateChecker.requestRestart()
  }
}

function onUpdateLater() {
  showUpdateDialog.value = false
  // Откладываем — будет предложено снова через 5 минут (интервал в UpdateChecker)
}
// ──────────────────────────────────────────────────────────────────────────

watch(
  () => userStore.isLoadingUser,
  (loadingDone) => {
    if (wsStore.connected && !loadingDone && (!userStore.userExist || !userStore.userFullName)) {
      showUserDialog.value = true
    }
  }
)

watch(
  () => wsStore.connected,
  async (newVal, oldVal) => {
    if (newVal) {
      console.log('WebSocket подключён!')
      await usePartNumberComponents().getPartNumberComponents()
    } else {
      console.log('WebSocket отключён!')
    }
  }
)

// При успешной авторизации (login mode) подключаем WebSocket
watch(
  () => userStore.isAuthorized,
  async (authorized) => {
    if (authorized && !wsStore.connected) {
      await userStore.getUserENV()
      wsStore.connect()
    }
  }
)

async function handleSaveFullName(fullName: string) {
  try {
    const saveUser = await userStore.saveFullName(fullName)
    showUserDialog.value = false
    console.log(saveUser, 'user created')
  } catch (error) {
    console.log(error, 'ошибка при регистрации пользователя')
  }
}

const killSpawnProcess = async (pid: number) => {
  try {
    await os.execCommand(`taskkill /F /PID ${pid}`)
    console.log('Процесс завершён успешно.')
  } catch (err) {
    console.error('Ошибка завершения процесса:', err)
  }
}

// const setTitle = async () => {
//   try {
//     await neuWindow.setTitle(`TAУ ${userStore.userName}`)
//   } catch (err) {
//     console.error('Ошибка при обновлении заголовка:', err)
//   }
// }

// events.on('pidReceived', async (event: CustomEvent<number>) => { })

function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.shiftKey && event.key === 'F12') {
    counterStore.adminView = !counterStore.adminView
    console.log('Нажаты Ctrl + Shift + F12')
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  wsStore.initNeutralinoEvents()
  mountServer('./.tmp')

  // Инициализация конфига (загружает config.json)
  await appConfig.load()

  // Инициализация UpdateChecker
  const updatesPath = appConfig.updatesPath
  const currentVersion = appConfig.version
  if (updatesPath) {
    console.log(`[App] Запуск UpdateChecker: updatesPath=${updatesPath}, version=${currentVersion}`)
    updateChecker = new UpdateChecker(updatesPath, currentVersion)
    updateChecker.onUpdate(onUpdateAvailable)
    await updateChecker.start()
  } else {
    console.log('[App] updatesPath не указан — пропускаю проверку обновлений')
  }

  window.addEventListener('online', () => {
    console.log('Доступ в Интернет есть.')
  })

  window.addEventListener('offline', () => {
    console.log('Нет доступа в Интернет.')
  })

  fetch('https://www.yandex.ru/favicon.ico')
    .then(() => {
      console.log('Доступ в Интернет есть (файл загружен).')
    })
    .catch(() => {
      console.log('Нет доступа в Интернет (файл не загружен).')
    })
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  // Останавливаем UpdateChecker
  updateChecker?.stop()
})
</script>

<template>
  <ErrorComponent />

  <RouterView />

  <!-- Update dialog -->
  <UpdateDialog
    v-model:visible="showUpdateDialog"
    :manifest="updateManifest"
    :latest-version="updateLatestVersion"
    @update-now="onUpdateNow"
    @later="onUpdateLater"
  />

  <v-dialog v-model="userStore.isSystemAuthOpen" max-width="500px" persistent>
    <v-card
      class="d-flex flex-column align-center justify-center"
      color="background"
      style="background: rgba(15, 15, 21, 0.85); backdrop-filter: blur(10px)"
    >
      <v-card-text class="text-center">
        <v-progress-circular
          indeterminate
          color="primary"
          size="64"
          class="mb-6"
        ></v-progress-circular>

        <h2 class="text-h4 mb-2" style="color: red">Подтверждение доступа</h2>
        <p class="text-body-1 text-muted" style="color: #b3b3b3; max-width: 400px; margin: 0 auto">
          Пожалуйста, подтвердите вашу учетную запись в появившемся окне Windows Безопасность.
        </p>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog v-model="showUserDialog" max-width="500px" persistent>
    <v-card>
      <v-card-title><span class="text-h5">Введите ФИО</span></v-card-title>
      <v-container>
        <v-row>
          <v-col>
            <p>
              Вы вошли как <b>{{ userStore.userName }}</b>
            </p>
            <p>Добавьте фамилию и инициалы</p>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-text-field
              v-model="userStore.userFullName"
              label="например Иванов И.И."
              :rules="[(v) => userStore.isFullNameValid || 'не соответствует шаблону']"
              clearable
            />
          </v-col>
        </v-row>
      </v-container>
      <v-card-actions>
        <v-btn
          :disabled="!userStore.isFullNameValid"
          color="primary"
          @click="handleSaveFullName(userStore.userFullName)"
        >
          Сохранить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
