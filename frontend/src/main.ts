import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createVuetify } from 'vuetify'
import router from './router'
import App from './App.vue'
import { VContainer } from 'vuetify/components'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { init, events, app } from '@neutralinojs/lib'

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

init()
events.on('windowClose', () => {
  app.exit()
})
// events.on('clientConnect', (evt) => console.log(evt, 'clientConnect'))
// events.on('clientDisconnect', (evt) => console.log(evt, 'clientDisconnect'))
// events.on('appClientConnect', (evt) => console.log(evt, 'appClientConnect'))
// events.on('appClientDisconnect', (evt) => console.log(evt, 'appClientDisconnect'))
