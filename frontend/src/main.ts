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

createApp(App).use(router).use(createPinia()).use(vuetify).mount('#app')

const wsStore = useWebSocketStore()
const userStore = useUserStore()
console.log('we are here')

userStore.getUserENV().then(() => {
  wsStore.connect()
  userStore.getUserName()
})

init()
events.on('windowClose', () => {
  // wsStore.send({
  //   command: 'appClientDisconnect',
  //   timestamp: new Date().toISOString(),
  //   user: userStore.userName,
  //   fullName: userStore.userFullName || null
  // })
  app.exit()
})
