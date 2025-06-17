<script setup lang="ts">
import { onMounted, onUnmounted, ref, reactive, watch, computed } from 'vue'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { usePartNumberComponents } from './stores/partNumberComponents'
import { useWebSocketStore } from './stores/websockets'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { useCounterStore } from './stores/counter'

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

const mountServer = async () => {
  try {
    const dirTAU = await filesystem.readDirectory(
      '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ'
      // {recursive: true}
    )
    console.log(dirTAU)
    const dirTMP = await filesystem.readDirectory(window.NL_PATH + '/.tmp')
    console.log(dirTMP)
  } catch (error) {
    const createDir = await filesystem.createDirectory(window.NL_PATH + '/.tmp')
    console.log(createDir)
  }
  try {
    await server.mount('/.tmp', './.tmp')
    console.log('server is mounted on /.tmp')
    const mounts = await server.getMounts()
    console.log('Mounts:', mounts)
    if (Array.isArray(mounts) && mounts.length === 0) {
      console.log('No mounts found')
      await server.mount('/.tmp', window.NL_PATH + '/.tmp')
      console.log('server is mounted on /.tmp')
    }
  } catch (error) {
    console.log(error)
  }
}
function handleKeydown(event: KeyboardEvent) {
  if (event.ctrlKey && event.shiftKey && event.key === 'F12') {
    counterStore.adminView = !counterStore.adminView
    console.log('Нажаты Ctrl + Shift + F12')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  // wsStore.connect()
  wsStore.initNeutralinoEvents()
  mountServer()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <ErrorComponent />
  <RouterView />
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
