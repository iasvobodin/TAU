import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import router from './router'
import App from './App.vue'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { init, events, app } from '@neutralinojs/lib'
import { useWebSocketStore } from './stores/websockets'
import { useUserStore } from './stores/user'
import { usePathsStore } from './stores/paths'
import { checkAllNetworkPaths, logPathCheckResults } from '@/assets/utils/checkPaths'

const vuetify = createVuetify({
  defaults: {
    VContainer: {
      style: 'max-widht: 1200px;'
    },
    global: {}
  },
  components,
  directives
})

const pinia = createPinia()

/**
 * Последовательная инициализация приложения:
 * 1. Загружаем конфиг путей (синхронно до монтирования, чтобы не было race condition)
 * 2. Монтируем Vue-приложение
 * 3. Инициализируем авторизацию
 * 4. Подключаем WebSocket
 */
async function bootstrap() {
  // 1. Загружаем конфиг путей ДО монтирования Vue
  const pathsStore = usePathsStore(pinia)
  await pathsStore.loadPaths()
  console.log('[bootstrap] paths загружены:', pathsStore.paths)

  // 1.1. Проверяем доступность всех сетевых путей из конфига
  const pathResults = await checkAllNetworkPaths(pathsStore.paths)
  logPathCheckResults(pathResults)

  // 2. Монтируем приложение
  const app = createApp(App)
  app.use(router)
  app.use(pinia)
  app.use(vuetify)
  app.mount('#app')

  console.log('we are here')

  // 3. Инициализация авторизации
  const userStore = useUserStore()
  await userStore.initAuth()

  if (userStore.isAuthorized) {
    const wsStore = useWebSocketStore()
    wsStore.connect()
  }
}

bootstrap()

init()
events.on('windowClose', () => {
  app.exit()
})
