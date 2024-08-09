<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch } from 'vue'
import ToolBar from './components/ToolBar.vue'
import { os, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { useErrorStore } from './stores/errorStore'
import { usePartNumberComponents } from './stores/partNumberComponents'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { RouterLink, RouterView } from 'vue-router'

const serverStats = reactive({
  localServer: { id: 0, pid: 0 },
  port: 0,
  pid: 0
})

const userCheck = ref(false)

const userStore = useUserStore()
const errorStore = useErrorStore()
const userFullName = ref('')

userStore.$subscribe(async (userExist, state) => {
  if (state.userExist === false) {
    console.log('NEED TO CREATE USER')
    userCheck.value = true
  }
})

watch(userCheck, (value) => {
  console.log(value, 'userCheck')
  if (!value) {
    userStore.resetUserExist()
    useUserStore().getUserName()
  }
})

const checkIfServerExist = async () => {
  try {
    const response = await fetch('http://localhost:3000/pid')
    if (response.ok) {
      const data = await response.json()
      console.log('Сервер запущен port:3000 pid:', data.pid)
      serverStats.pid = data.pid
      serverStats.port = 3000
      return data.pid
    }
  } catch (error) {
    throw new Error('сервер не найден')
  }
}
const startLocalServer = async () => {
  try {
    await checkIfServerExist()
  } catch (error) {
    //в первый раз всегда не работает
    console.error(error)
    console.error('запускаем сервер')
    try {
      serverStats.localServer = await os.spawnProcess(
        'powershell ./server.exe',
        `${window.NL_CWD}/extensions`
      )
      //вроде запустили
      console.log('Процесс запущен, ждём ответа от сервера PID: ' + serverStats.localServer.pid)
      //проверяем ещё раз
      await checkIfServerExist()
    } catch (error) {
      console.error('Ошибка при запуске локального сервера:', error)
    }
  }
}

const killSpawnProcess = async (pid: number) => {
  try {
    await os.execCommand(`taskkill /F /PID ${pid}`)
    console.log('Процесс завершён успешно.')

    let processes = await os.getSpawnedProcesses()
    console.log(processes)
  } catch (err) {
    console.error('Ошибка завершения процесса: ', err)
  }
}

const setEvents = () => {
  events.on('windowClose', () => killSpawnProcess(serverStats.pid))
  events.on('spawnedProcess', (evt) => {
    if (serverStats.localServer.id === evt.detail.id && evt.detail.data.includes('PID')) {
      serverStats.pid = JSON.parse(evt.detail.data).PID
      serverStats.port = JSON.parse(evt.detail.data).PORT
    }
  })
}
// const getUserName = async () => {
//   try {
//     let userName = await os.execCommand('powershell $env:USERNAME')
//     console.log(`Получено имя пользователя: ${userName.stdOut}`)

//     // Получаем экземпляр хранилища
//     // Сохраняем имя пользователя в хранилище
//     userStore.setUserName(userName.stdOut)

//     return userName.stdOut
//   } catch (err) {
//     console.error('Ошибка при получении имени пользователя:', err)
//   }
// }
// const pattern = /^\d+$/
const pattern = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/
const setTitle = async () => {
  try {
    await neuWindow.setTitle(`TAУ ${useUserStore().userName}`)
    console.log(`Заголовок окна успешно обновлён`)
  } catch (err) {
    console.error('Ошибка при выполнении операций:', err)
  }
}

const createUserFullName = async () => {
  try {
    await userStore.createUserName({
      Login: useUserStore().userName,
      Name: userFullName.value
    })
    errorStore.addInfo('Данные добавлены в базу')
    setTimeout(errorStore.removeInfo, 5000)
    userCheck.value = false
  } catch (error) {
    console.log(error)
  }
}
const isValid = computed(() => pattern.test(userFullName.value))

onMounted(async () => {
  setEvents()
  await startLocalServer()
  await useUserStore().getUserName()
  await setTitle()
  await usePartNumberComponents().getPartNumberComponents()
})
</script>

<template>
  <ErrorComponent />
  <RouterView />
  <v-dialog v-model="userCheck" max-width="500px">
    <v-card>
      <v-card-title><span class="text-h5">Login</span></v-card-title>
      <v-container>
        <v-row>
          <v-col>
            <p>
              Вы вошли под учётной записью <b>{{ useUserStore().userName }}</b>
            </p>
            <p>Добавте фамилию и инициалы в базу данных</p>
          </v-col>
        </v-row>
        <!-- <v-row>
          <v-col>
            
          </v-col>
        </v-row> -->
        <v-row>
          <v-col>
            <v-text-field
              density="compact"
              v-model="userFullName"
              hide-details="auto"
              clearable
              label="например Иванов И.И."
              variant="solo"
              :rules="[(value) => pattern.test(value) || 'не соответствует шаблону']"
            ></v-text-field>
          </v-col>
        </v-row>
      </v-container>
      <v-card-actions>
        <v-btn :disabled="!isValid" color="blue-darken-1" variant="text" @click="createUserFullName"
          >Сохранить</v-btn
        >
      </v-card-actions>
    </v-card>
  </v-dialog>
  <!-- <ToolBar /> -->
  <!-- <HelloWorld /> -->
</template>

<style scoped></style>
