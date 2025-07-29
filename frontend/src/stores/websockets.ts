// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { events } from '@neutralinojs/lib'
import { useUserStore } from './user'
import { useErrorStore } from './errorStore'
import { useCounterStore } from '@/stores/counter'
import { startHeartbeat, stopHeartbeat } from '@/assets/utils/localHeartbeat'
import { useRoute } from 'vue-router'

const URL_WS = import.meta.env.VITE_URL_WS as string

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<WebSocket | null>(null)
  const connected = ref(false)
  const reconnectDelay = 5000
  const userStore = useUserStore()
  const errorStore = useErrorStore()
  const counterStore = useCounterStore()

  function connect() {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) return

    socket.value = new WebSocket(`ws://${URL_WS}/ws`)

    socket.value.onopen = async () => {
      connected.value = true
      errorStore.addInfo('WebSocket соединён')
      setTimeout(errorStore.removeInfo, 1000)
      //отправляем команду о запуске приложении
      send({
        command: 'appStarted'
        // в ответ получаем PID
      })
    }

    socket.value.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.command === 'shutdown') {
          events.dispatch('shutdown', { detail: data })
        }

        if (data.command === 'convertDone') {
          console.log(data, 'законвертилось')
        }
        if (data.command === 'pid') {
          events.dispatch('pidReceived', { detail: data })
        }
        // 💬 Лог с сервера
        if (data.type === 'server_log') {
          events.dispatch('serverLog', { detail: data.log }) // log — это JSON-строка от Pino
        }
      } catch (e) {
        console.warn('Ошибка парсинга сообщения:', event.data)
      }
    }

    socket.value.onerror = (err) => {
      connected.value = false
      errorStore.addError('Ошибка WebSocket соединения')
      setTimeout(() => errorStore.removeError(), 3000)
    }

    socket.value.onclose = () => {
      connected.value = false
      errorStore.addError('WebSocket отключён. Переподключение...')
      setTimeout(() => {
        connect()
        errorStore.removeError()
      }, reconnectDelay)
    }
  }

  function send(payload: object) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      socket.value.send(JSON.stringify(payload))
    } else {
      console.warn('WebSocket не готов к отправке')
    }
  }
  // let userOrder = ''
  // let user = ''
  // let heartbeatInterval: ReturnType<typeof setInterval> | null = null

  // function startHeartbeat(user: string) {
  //   if (heartbeatInterval) return // Уже запущено

  //   heartbeatInterval = setInterval(() => {
  //     if (connected.value && userStore.userName) {
  //       send({
  //         command: 'heartbeat',
  //         user,
  //         timestamp: new Date().toISOString()
  //       })
  //       console.log('💓 Отправлен heartbeat', user)
  //     }
  //   }, 10000) // каждые 10 секунд
  // }

  // Neutralino события
  function initNeutralinoEvents() {
    events.on('spawnedProcess', async (event) => {
      console.log(event, 'spawnedProcess')
    })
    events.on('appClientDisconnect', async (event) => {
      connected.value && (await userStore.getUserName())
      const clientId = `${userStore.userName}_${+event.detail + 1}`
      stopHeartbeat(clientId)

      // console.log('Neutralino client Disconnected', event)
      send({
        command: 'appClientDisconnect',
        timestamp: new Date().toISOString(),
        pid: window.NL_PID,
        user: clientId,
        fullName: userStore.userFullName || null
      })
    })
    events.on('windowClose', async (event) => {
      console.log(event, 'windowClose')
      const clientId = `${userStore.userName}_${event.detail}`
      stopHeartbeat(clientId)
      console.log('Neutralino windowClose', event)
      send({
        command: 'appClientDisconnect',
        timestamp: new Date().toISOString(),
        user: userStore.userName,
        fullName: userStore.userFullName || null
      })
    })

    // ✅ Пропускаем инициализацию, если не в основном окне
    if (window.location.pathname === '/') {
      console.log(
        '📄 Инициализируем appConnect только на стартовой странице:',
        window.location.pathname
      )
      events.on('appClientConnect', async (event) => {
        console.log('Neutralino client connected', event)
        await userStore.getUserName()
        const localUserOrder = event.detail
        const localUser = `${userStore.userName}_${localUserOrder}`

        // Отправляем начальное подключение
        send({
          command: 'appClientConnect',
          timestamp: new Date().toISOString(),
          pid: window.NL_PID,
          user: localUser,
          fullName: userStore.userFullName || null
        })

        // Стартуем heartbeat с передачей задачи
        startHeartbeat(localUser, () => {
          send({
            command: 'heartbeat',
            timestamp: new Date().toISOString(),
            user: localUser
          })
        })
      })
    }

    console.log('🚀 Инициализация событий Neutralino')

    events.on('PDFwindowClose', async (evt) => {
      console.log(evt)
      if (evt.detail === 'W_PDF_VIEWER') {
        console.log('Окно PDF Viewer закрыто!')
      }
    })

    events.on('myTestEvent', (event) => {
      console.log(event.detail)
    })
    events.on('serverLog', (event) => {
      // event.detail — объект с ключом detail, в котором лежит строка
      const logStr = event.detail.detail // <- вот эта строка
      // console.log('👀 Получен лог:', logStr)

      // Теперь парсим лог и добавляем в массив
      try {
        const logObj = JSON.parse(logStr)
        // counterStore.logs.push(logObj);
        counterStore.addLogs(logObj)
      } catch {
        // counterStore.logs.push('⚠️ Невалидный лог');
        counterStore.addLogs('⚠️ Невалидный лог')
      }
    })
  }

  return {
    socket,
    connected,
    connect,
    send,
    initNeutralinoEvents
  }
})
