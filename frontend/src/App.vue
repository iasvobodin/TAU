<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, watch, computed } from 'vue'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { usePartNumberComponents } from './stores/partNumberComponents'
import { useWebSocketStore } from './stores/websockets'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { useCounterStore } from './stores/counter'
import { mountServer } from './assets/utils/mountServer'

const counterStore = useCounterStore()
const userStore = useUserStore()
const wsStore = useWebSocketStore()

const showUserDialog = ref(false)

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

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  wsStore.initNeutralinoEvents()
  mountServer('./.tmp')

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
})
</script>

<template>
  <ErrorComponent />

  <RouterView />

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
