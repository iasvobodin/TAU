// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { events } from '@neutralinojs/lib'
import { useUserStore } from './user'
import { useErrorStore } from './errorStore'

const URL_WS = import.meta.env.VITE_URL_WS as string

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<WebSocket | null>(null)
  const connected = ref(false)
  const reconnectDelay = 5000

  const userStore = useUserStore()
  const errorStore = useErrorStore()

  function connect() {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) return

    socket.value = new WebSocket(`ws://${URL_WS}/ws`)

    socket.value.onopen = async () => {
      connected.value = true
      errorStore.addInfo('WebSocket соединён')
      setTimeout(errorStore.removeInfo, 1000)
      // получаем имя пользователя
      await userStore.getUserName()

      // отправляем информацию о подключении
      send({
        command: 'clientConnect',
        timestamp: new Date().toISOString(),
        user: userStore.userName,
        fullName: userStore.userFullName || null
      })
    }

    socket.value.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        if (data.command === 'shutdown') {
          events.dispatch('shutdown', { detail: data })
        } else {
          console.log('Сообщение от сервера:', data)
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
    events.on('clientConnect', async (event) => {
      console.log('Neutralino client connected:', event)

      // повторная проверка пользователя
      await userStore.getUserName()

      send({
        command: 'clientConnect',
        timestamp: new Date().toISOString(),
        user: userStore.userName,
        fullName: userStore.userFullName || null
      })
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
