// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { events } from '@neutralinojs/lib'
import { useUserStore } from './user'
import { useErrorStore } from './errorStore'
import { useCounterStore } from '@/stores/counter'

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

  // Neutralino события
  function initNeutralinoEvents() {
    events.on('PDFwindowClose', async (evt) => {
      console.log(evt)
      if (evt.detail === 'W_PDF_VIEWER') {
        console.log('Окно PDF Viewer закрыто!')
      }
    })
    events.on('clientDisconnect', async (event) => {
      console.log('Neutralino client Disconnected', event)
    })
    events.on('windowClose', async (event) => {
      console.log('Neutralino windowClose', event)
    })
    events.on('clientConnect', async (event) => {
      console.log('Neutralino client connected', event)
      connected.value && (await userStore.getUserName())
      send({
        command: 'clientConnect',
        timestamp: new Date().toISOString(),
        user: userStore.userName,
        fullName: userStore.userFullName || null
      })
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
