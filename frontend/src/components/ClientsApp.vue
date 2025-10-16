<template>
  <!-- <KeepAlive> -->
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title class="custom-title"
          >Активные пользователи</v-expansion-panel-title
        >
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <v-btn @click="checkActiveUser">Проверка активных пользователей</v-btn><br />
              <v-btn @click="stopProcess">Закрыть все активные приложения</v-btn><br />
              <v-btn @click="startAuth">открыть авторизацию</v-btn><br />
              <v-btn @click="checkAuth">проверить авторизацию</v-btn><br />
              <v-btn @click="refreshToken">обновить токен</v-btn>

              <v-container v-if="clientsData">
                <v-card elevation="2" class="pa-4">
                  <v-card-title>Клиенты (Всего: {{ clientsData.count }})</v-card-title>
                  <v-data-table
                    :headers="headers"
                    :items="clientsData.clients"
                    class="elevation-1"
                    :items-per-page="-1"
                    :hide-default-footer="true"
                  >
                    <template v-slot:item.lastActive="{ item }">
                      {{ formatDate(item.lastActive) }}
                    </template>
                    <!-- <template v-slot:item.pid="{ item }">
                      {{ item.pid }}
                    </template> -->
                  </v-data-table>
                </v-card>
              </v-container>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
  <!-- </KeepAlive> -->
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getClients } from '@/api/userServices'
import type { ClientsResponse } from '@/assets/interfaces'
import { useWebSocketStore } from '@/stores/websockets'
import {
  app,
  os,
  storage,
  filesystem,
  server,
  events,
  window as neuWindow
} from '@neutralinojs/lib'
import { useUserStore } from '@/stores/user'
import { startAuth, refreshToken } from '@/assets/utils/authYandex'
const clientsData = ref<ClientsResponse | null>(null)
const wsStore = useWebSocketStore()

// Заголовки таблицы
const headers = [
  { title: 'ID Клиента', key: 'clientId' },
  { title: 'Последняя активность', key: 'lastActive' }
  // { title: 'id процесса', key: 'pid' }
]

// Форматирование даты
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}
const checkActiveUser = () => {
  wsStore.send({
    command: 'checkActiveUser'
  })
}

const stopProcess = () => {
  wsStore.send({
    command: 'stopProcess'
  })
}
const userStore = useUserStore()

async function checkAuth() {
  const access_token = await storage.getData('access_token')
  const res = await fetch('https://login.yandex.ru/info', {
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  })
  const profile = await res.json()
  console.log('Профиль:', profile)
}

// Функция для загрузки данных
const fetchData = async () => {
  try {
    const result = await getClients()
    if (result.data) {
      clientsData.value = result.data
      // console.log(result.data)
    }
  } catch (error) {
    console.error('Ошибка загрузки данных:', error)
  }
}

// Установка интервала для запросов каждые 10 секунд
let intervalId: NodeJS.Timeout | null = null
onMounted(() => {
  fetchData() // Первоначальная загрузка данных
  intervalId = setInterval(fetchData, 10000) // Запрос каждые 10 секунд
})

// Очистка интервала при уничтожении компонента
onUnmounted(() => {
  console.log('отчистим интервал на запрос к серверу')

  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<style scoped></style>
