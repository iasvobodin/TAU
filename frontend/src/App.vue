<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch, type Ref } from 'vue'
import ToolBar from './components/ToolBar.vue'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { useUserStore } from './stores/user'
import { useErrorStore } from './stores/errorStore'
import { usePartNumberComponents } from './stores/partNumberComponents'
import ErrorComponent from '@/components/ErrorComponent.vue'
import { RouterLink, RouterView } from 'vue-router'
import {useWebSocketStore} from './stores/websockets.ts'

const API_URL = import.meta.env.VITE_API_URL as string
const URL_WS = import.meta.env.VITE_URL_WS as string
const wsStore = useWebSocketStore()


// РАБОТА С ПОЛЬЗОВАТЕЛЯМИ
const userStore = useUserStore()

const showUserDialog = ref(false) // 👈 контроль показа вручную

// следим за состоянием после загрузки данных
watch(
  () => userStore.isLoadingUser,
  (loadingDone) => {
    if (!loadingDone && (!userStore.userExist || !userStore.userFullName)) {
      showUserDialog.value = true
    }
  }
)


const fullNameInput = ref('')
const isValid = computed(() => /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/.test(fullNameInput.value))

async function handleSaveFullName() {
  await userStore.saveFullName(fullNameInput.value)
  fullNameInput.value = ''
}



const serverStats = reactive({
  localServer: { id: 0, pid: 0 },
  port: 0,
  pid: 0
})

// const ws = new WebSocket(`ws://${URL_WS}/ws`) 


// const ws: Ref<WebSocket | null> = ref(null)
// const userCheck = ref(false)
const localServer: Ref<os.SpawnedProcess | null> = ref(null)
const localServerPID: Ref<null | number> = ref(null)

const errorStore = useErrorStore()
const userFullName = ref('')

// userStore.$subscribe(async (userExist, state) => {
//   if (state.userExist === false) {
//     console.log('NEED TO CREATE USER')
//     userCheck.value = true
//   }
// })


const checkIfServerRunning = async () => {
  //   const fetchComponent = async (): Promise<ApiResponse> => {
  //   return get(`${API_URL}/pid`)
  // }
  console.log('checkIfServerRunning')

  try {
    const response = await fetch(`${API_URL}/pid`, {
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
const activeClients = new Map()

const setEvents = () => {
  // ПО МОЕМУ НЕ НУЖНО БОЛЬШЕ УБИВАТЬ СЕРВЕР
  // events.on('windowClose', () => killSpawnProcess(localServerPID.value!))

  events.on('spawnedProcess', (evt) => {
    console.log(evt,'ПРОВЕРКА НА СПОРНОЕ EVT')

    //проверяем ответ сервера, нам нужен его PID
    if (typeof evt.detail.data === 'object' && JSON.parse(evt.detail.data).PID) {
      localServerPID.value = JSON.parse(evt.detail.data).PID
    }
  })

  events.on('clientConnect', (client) => {
    const clientId = client.target // уникальный id клиента (обычно генерируется самим Neutralino)
    const connectedAt = Date.now()

    activeClients.set(clientId, { connectedAt })

    console.log(`Client connected: ${clientId}, всего клиентов: ${activeClients.size}`)
  })

  events.on('clientDisconnect', (client) => {
    const clientId = client
    activeClients.delete(clientId)
    console.log(`Client disconnected: ${clientId}, осталось клиентов: ${activeClients.size}`)
  })



  events.on('shutdown', () => {
    console.log('Получена команда на завершение работы');
    app.exit(); // Закрытие приложения
});

events.on('pidReceived', (event: CustomEvent<number>) => {
  localServerPID.value = event.detail
  console.log('Получен PID от сервера:', event.detail)
})
}





const mountServer = async () => {
  try {
    const dirTAU = await filesystem.readDirectory(
      '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ'
      // {recursive: true}
    )
    // console.log(dirTAU)
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

const pattern = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/
const setTitle = async () => {
  try {
    await neuWindow.setTitle(`TAУ ${useUserStore().userName}`)
    console.log(`Заголовок окна успешно обновлён`)
  } catch (err) {
    console.error('Ошибка при выполнении операций:', err)
  }
}

// const createUserFullName = async () => {
//   try {
//     await userStore.createUserName({
//       Login: useUserStore().userName,
//       Name: userFullName.value
//     })
//     errorStore.addInfo('Данные добавлены в базу')
//     setTimeout(errorStore.removeInfo, 5000)
//     // userCheck.value = false
//   } catch (error) {
//     console.log(error)
//   }
// }
// const isValid = computed(() => pattern.test(userFullName.value))

// watch(userCheck, (value) => {
//   console.log(value, 'userCheck')
//   if (!value) {
//     userStore.resetUserExist()
//     useUserStore().getUserName()
//   }
// })

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


const connect = async (ws: WebSocket) => {
  ws.onopen = () => {
    errorStore.addInfo('Связь с сервером установлена');
    setTimeout(errorStore.removeInfo, 1000);
    console.log('WebSocket соединение установлено');
    ws.send(
      JSON.stringify({
        command: 'appStarted',
        timestamp: new Date().toISOString(),
        user: useUserStore().userName,
      })
    );

    // Периодическое отправление heartbeat
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            command: 'heartbeat',
            timestamp: new Date().toISOString(),
          })
        );
      }
    }, 30000); // Каждые 30 секунд
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.command === 'pid') {
        localServerPID.value = data.value;
        console.log('Сообщение от сервера: PID =', data.value);
      } else if (data.command === 'shutdown') {
        console.log('Получена команда на завершение работы');
        events.dispatch('shutdown', data);
      } else {
        console.log('Неизвестная команда:', data.command);
      }
    } catch (err) {
      // Обратная совместимость для старого формата "PID:123"
      if (typeof event.data === 'string' && event.data.startsWith('PID:')) {
        localServerPID.value = parseInt(event.data.split(':')[1]);
        console.log('Сообщение от сервера: PID =', localServerPID.value);
      } else {
        console.error('Ошибка обработки сообщения:', err);
      }
    }
  };

  ws.onerror = (error) => {
    errorStore.addError('Связь с сервером потеряна');
    setTimeout(errorStore.removeError, 5000);
    console.error('Ошибка WebSocket:', error);
  };

  ws.onclose = async () => {
    console.log('WebSocket соединение закрыто. Попытка переподключения...');
    setTimeout(() => connect(new WebSocket(`ws://${URL_WS}/ws`)), 5000);
  };
};
onMounted(async () => {
  userStore.getUserName()
  wsStore.connect()
  wsStore.initNeutralinoEvents()
  mountServer()
})
</script>

<template>
  <ErrorComponent />
  <RouterView />
  <v-dialog v-model="showUserDialog" max-width="500px">
  <v-card>
    <v-card-title><span class="text-h5">Введите ФИО</span></v-card-title>
    <v-container>
      <v-row>
        <v-col>
          <p>Вы вошли как <b>{{ userStore.userName }}</b></p>
          <p>Добавьте фамилию и инициалы</p>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-text-field
            v-model="userStore.userFullName"
            label="например Иванов И.И."
            :rules="[v => /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/.test(v) || 'не соответствует шаблону']"
            clearable
          />
        </v-col>
      </v-row>
    </v-container>
    <v-card-actions>
      <v-btn
        :disabled="!userStore.isFullNameValid"
        color="primary"
        @click="handleSaveFullName"
      >
        Сохранить
      </v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
</template>

<style scoped></style>
