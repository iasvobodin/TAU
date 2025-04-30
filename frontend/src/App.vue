<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch, type Ref } from 'vue'
import ToolBar from './components/ToolBar.vue'
import { os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { useErrorStore } from './stores/errorStore'
import { usePartNumberComponents } from './stores/partNumberComponents'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { RouterLink, RouterView } from 'vue-router'
import { io } from 'socket.io-client'
import { get, post, put, patch, del, type ApiResponse } from './api/apiService'
const serverStats = reactive({
  localServer: { id: 0, pid: 0 },
  port: 0,
  pid: 0
})
const ws: Ref<WebSocket | null> = ref(null)
const userCheck = ref(false)
const localServer: Ref<os.SpawnedProcess | null> = ref(null)
const localServerPID: Ref<null | number> = ref(null)
const userStore = useUserStore()
const errorStore = useErrorStore()
const userFullName = ref('')

userStore.$subscribe(async (userExist, state) => {
  if (state.userExist === false) {
    console.log('NEED TO CREATE USER')
    userCheck.value = true
  }
})

// const ws = new WebSocket('ws://10.69.19.59:3000/ws');

const checkIfServerRunning = async () => {
  //   const fetchComponent = async (): Promise<ApiResponse> => {
  //   return get(`http://10.69.19.59:3000/pid`)
  // }
  console.log('checkIfServerRunning')

  try {
    const response = await fetch('http://10.69.19.59:3000/pid', {
      headers: {
        'x-api-key': 'your-secret-api-key-12345'
      }
    })
    if (response.ok) {
      const data = await response.json()
      localServerPID.value = data.pid as number
      console.log('Сервер запущен port:3000 pid:', localServerPID.value)
    }
  } catch (error) {
    throw new Error('сервер не найден')
  }
}
const startServerProcess = async () => {
  console.log('startServerProcess')
  try {
    localServer.value = await os.spawnProcess(
      'powershell ./server.exe',
      `${window.NL_CWD}/extensions`
    )
    //вроде запустили
    console.log('Сервер запущен')
  } catch (error) {
    console.error('Ошибка при запуске локального сервера:', error)
  }
}
// const startLocalServer = async () => {
//   console.log('startLocalServer');

//   try {
//     await checkIfServerRunning()
//     console.log('wait');

//   } catch (error) {
//     //в первый раз всегда не работает
//     (async () => await startServerProcess())()

//     console.error(error)

//     console.log('запускаем сервер')
//   }
// }

const killSpawnProcess = async (pid: number) => {
  console.log('killSpawnProcess')

  try {
    await os.execCommand(`taskkill /F /PID ${pid}`)
    console.log('Процесс завершён успешно.')

    let processes = await os.getSpawnedProcesses()
    console.log(processes, 'active process')
  } catch (err) {
    console.error('Ошибка завершения процесса: ', err)
  }
}

const setEvents = () => {
  events.on('windowClose', () => killSpawnProcess(localServerPID.value!))

  events.on('spawnedProcess', (evt) => {
    // console.log(evt)

    //проверяем ответ сервера, нам нужен его PID
    if (typeof evt.detail.data === 'object' && JSON.parse(evt.detail.data).PID) {
      localServerPID.value = JSON.parse(evt.detail.data).PID
    }
  })
}
const mountServer = async () => {
  try {
    await filesystem.readDirectory(window.NL_PATH + '/.tmp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/.tmp')
    await filesystem.createDirectory('./.tmp')
  }
  try {
    const mounts = await server.getMounts()
    console.log('Mounts:', mounts)
    await server.mount('/.tmp', './.tmp')
    console.log('server is mounted on /.tmp')
    if (Array.isArray(mounts) && mounts.length === 0) {
      console.log('No mounts found')
      await server.mount('/.tmp', window.NL_PATH + '/.tmp')
      console.log('server is mounted on /.tmp')
    }
  } catch (error) {
    console.log(error)
  }
}

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

watch(userCheck, (value) => {
  console.log(value, 'userCheck')
  if (!value) {
    userStore.resetUserExist()
    useUserStore().getUserName()
  }
})

//только если сервер запущен
watch(localServerPID, async (newvalue, oldvalue) => {
  console.log('watch(localServerPID')

  if (newvalue) {
    try {
      await useUserStore().getUserName()
      await setTitle()
      await usePartNumberComponents().getPartNumberComponents()
    } catch (error) {
      console.log(error)
    }
  }
})
// const connect = async () => {
//   const socket = io('ws://10.69.19.59:3000', {
//     extraHeaders: {
//       'x-api-key': 'your-secret-api-key-12345'
//     }
//   });

//   socket.on('connect', () => {
//     console.log('WebSocket соединение установлено');
//     socket.send('Привет, сервер!');
//   });

//   socket.on('message', (data) => {
//     localServerPID.value = data.split(':')[1];
//     console.log('Сообщение от сервера:', data);
//   });

//   socket.on('disconnect', async () => {
//     await startServerProcess();
//     console.log('WebSocket соединение закрыто. Попытка переподключения...');
//     setTimeout(connect, 5000);
//   });

//   socket.on('connect_error', (error) => {
//     console.error('Ошибка WebSocket:', error);
//   });
// }
const connect = async () => {
  const ws = new WebSocket('ws://10.69.19.59:3000/ws')

  ws.onmessage = (event) => {
    localServerPID.value = event.data.split(':')[1]
    console.log('Сообщение от сервера:', event.data)
  }

  ws.onopen = () => {
    errorStore.addInfo('Связь с сервером установлена')
    setTimeout(errorStore.removeInfo, 5000)
    console.log('WebSocket соединение установлено')
    ws!.send('Привет, сервер!')
  }

  ws.onerror = (error) => {
    errorStore.addError('Связь с сервером потеряна')
    setTimeout(errorStore.removeError, 5000)
    console.error('Ошибка WebSocket:', error)
  }

  ws.onclose = async () => {
    // await startServerProcess()
    console.log('WebSocket соединение закрыто. Попытка переподключения...')
    setTimeout(connect, 5000)
  }
}
onMounted(async () => {
  // checkIfServerRunning()
  setEvents()
  connect()
  mountServer()
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
</template>

<style scoped></style>
