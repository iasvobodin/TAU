<script setup lang="ts">
import { onMounted, reactive, ref, computed, watch, type Ref } from 'vue'
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
const ws:Ref<WebSocket|null> = ref(null)
const userCheck = ref(false)
const localServer:Ref<os.SpawnedProcess|null> = ref(null)
const localServerPID:Ref<null|number> = ref(null)
const userStore = useUserStore()
const errorStore = useErrorStore()
const userFullName = ref('')

userStore.$subscribe(async (userExist, state) => {
  if (state.userExist === false) {
    console.log('NEED TO CREATE USER')
    userCheck.value = true
  }
})

// const ws = new WebSocket('ws://localhost:3000/ws');



const checkIfServerRunning = async () => {
  console.log('checkIfServerRunning');


  // try {
  //   const response = await fetch('http://localhost:3000/pid')
  //   if (response.ok) {
  //     const data = await response.json()
  //     localServerPID.value = data.pid as number
  //     console.log('Сервер запущен port:3000 pid:', localServerPID.value)
  //   }
  // } catch (error) {
  //   throw new Error('сервер не найден')
  // }
}
const startServerProcess = async ()=>{
  console.log('startServerProcess');
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
  console.log('killSpawnProcess');
  
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
  // events.on('windowClose', () => killSpawnProcess(localServerPID.value!))

  events.on('spawnedProcess', (evt) => {
   //проверяем ответ сервера, нам нужен его PID
    if (JSON.parse(evt.detail.data).PID) {
      localServerPID.value = JSON.parse(evt.detail.data).PID
    }
  })
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
  console.log('watch(localServerPID');
  
  if (newvalue) {
    try {
    await useUserStore().getUserName()
    await setTitle()
    await usePartNumberComponents().getPartNumberComponents()
    } catch (error) {
      console.log(error);
      
    }
   
  }
})



const connect = async () => {

  const ws = new WebSocket('ws://localhost:3000/ws');

  ws.onmessage = (event) => {
    localServerPID.value = event.data.split(':')[1]
    console.log('Сообщение от сервера:', event.data);
  };

  ws.onopen = () => {
    console.log('WebSocket соединение установлено');
    ws!.send('Привет, сервер!');
  };

  ws.onerror = (error) => {
    console.error('Ошибка WebSocket:', error);
  };

  ws.onclose = async () => {
    await startServerProcess();
    console.log('WebSocket соединение закрыто. Попытка переподключения...');
    setTimeout(connect, 5000);
  };

}

onMounted(async () => {
  setEvents()
  connect()

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
