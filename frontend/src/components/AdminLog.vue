<template>
  <!-- <KeepAlive> -->
  <v-container>
    <v-expansion-panels>
      <v-expansion-panel>
        <v-expansion-panel-title class="custom-title">Server Log</v-expansion-panel-title>
        <v-expansion-panel-text>
          <v-row>
            <v-col>
              <div class="log-panel">
                <div v-for="(log, index) in counterStore.logs" :key="index" class="log-entry">
                  {{ formatLog(log) }}
                </div>
              </div>
            </v-col>
          </v-row>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-container>
  <!-- </KeepAlive> -->
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { events } from '@neutralinojs/lib'
import { useCounterStore } from '@/stores/counter'

const counterStore = useCounterStore()

function formatLog(log: any) {
  // Проверяем тип данных. Если это строка, возвращаем её напрямую.
  if (typeof log === 'string') {
    return log
  }

  // Если это не объект, возвращаем сообщение об ошибке.
  if (!log || typeof log !== 'object') {
    return 'Неизвестный формат лога'
  }

  // Теперь мы уверены, что log — это объект, и можем безопасно получать свойства.
  const time = log.time ? new Date(log.time).toLocaleTimeString() : 'N/A'
  const hostname = log.hostname || 'N/A'
  const message = log.msg || 'Сообщение отсутствует'

  let requestInfo = ''
  // Проверяем наличие req и res
  if (log.req) {
    requestInfo = `(метод: ${log.req.method}, URL: ${log.req.url})`
  } else if (log.res) {
    requestInfo = `(статус: ${log.res.statusCode})`
  }

  return `[${time}] ${hostname} - ${message} ${requestInfo}`
}

onMounted(() => {
  events.on('serverLog', (event) => {
    // event.detail — объект с ключом detail, в котором лежит строка
    const logStr = event.detail.detail
    console.log('👀 Получен лог:', logStr)
    // Теперь парсим лог и добавляем в массив
    try {
      const logObj = JSON.parse(logStr)
      counterStore.addLogs(logObj)
    } catch {
      // Здесь мы добавляем строку, если парсинг не удался
      counterStore.addLogs('⚠️ Невалидный лог. Возможно, сервер отправил не JSON.')
    }
  })
})
</script>

<style scoped>
.custom-title {
  text-align: center;
  text-transform: capitalize;
}
.log-panel {
  border-radius: 5px;
  font-family: monospace;
  background: black;
  color: #0f0;
  padding: 10px;
  height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
}
.log-entry {
  padding: 2px 0;
}
</style>
