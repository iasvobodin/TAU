// stores/websocket.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { events, os, storage } from '@neutralinojs/lib'
import { useUserStore } from './user'
import { useErrorStore } from './errorStore'
import { useCounterStore } from '@/stores/counter'
import { startHeartbeat, stopHeartbeat } from '@/assets/utils/localHeartbeat'
import { useRoute } from 'vue-router'
import { exchangeCode } from '@/assets/utils/authYandex'
import { updateUser } from '@/api/userServices'
const URL_WS = import.meta.env.VITE_URL_WS as string

export const useWebSocketStore = defineStore('websocket', () => {
  const socket = ref<WebSocket | null>(null)
  const connected = ref(false)
  const reconnectDelay = 5000
  const userStore = useUserStore()
  const errorStore = useErrorStore()
  const counterStore = useCounterStore()

  // async function getUserENV() {
  //   const user = await os.getEnv('USERNAME')
  //   const comp = await os.getEnv('COMPUTERNAME')
  //   return `${user}_${comp}`
  // }
  userStore.getUserENV()

  async function connect() {
    if (socket.value && socket.value.readyState === WebSocket.OPEN) return

    // const user = await getUserENV()

    if (window.location.pathname === '/') {
      socket.value = new WebSocket(`ws://${URL_WS}/ws?userId=${userStore.userENV}`)
      socket.value.onopen = async () => {
        connected.value = true
        errorStore.addInfo('WebSocket соединён')
        setTimeout(errorStore.removeInfo, 1000)
        //отправляем команду о запуске приложении
        // send({
        //   command: 'appStarted'
        //   // в ответ получаем PID
        // })
      }

      socket.value.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.command) {
            case 'shutdown':
              errorStore.addInfo('Приложение закроется через 5 секунд для обновления')
              setTimeout(() => {
                os.execCommand(`taskkill /IM neutralino-win_x64.exe /F`)
                os.execCommand(`taskkill /IM TAU.exe /F`)
              }, 5000)
              break
            case 'ping':
              send({
                command: 'pong',
                userId: userStore.userENV,
                timestamp: new Date().toISOString()
              })
              break
            case 'pid':
              events.dispatch('pidReceived', { detail: data })
              break
            case 'code':
              exchangeCode(data.code)
              break
            case 'server_log':
              events.dispatch('serverLog', { detail: data.log }) // log — это JSON-строка от Pino
              break
            default:
              console.warn('Неизвестная команда получена:', data)
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
  }

  function send(payload: object) {
    if (socket.value?.readyState === WebSocket.OPEN) {
      try {
        // 1. Сериализация в JSON
        const message = JSON.stringify(payload)
        // 2. Отправка
        socket.value.send(message)
      } catch (error) {
        // Обработка ошибок сериализации или сбоя при отправке
        console.error('Ошибка при отправке сообщения WebSocket:', error, 'Payload:', payload)
      }
    } else {
      // Добавление payload в предупреждение может помочь в отладке
      console.warn(
        'WebSocket не готов к отправке. Состояние:',
        socket.value?.readyState,
        'Payload:',
        payload
      )
    }
  }

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
        // startHeartbeat(localUser, () => {
        //   send({
        //     command: 'heartbeat',
        //     timestamp: new Date().toISOString(),
        //     user: localUser
        //   })
        // })
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
