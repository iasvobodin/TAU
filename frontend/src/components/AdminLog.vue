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

//   const logs = ref<string[]>([])

function formatLog(log: any) {
  if (!log) return ''
  const time = new Date(log.time).toLocaleTimeString()
  return `[${time}] ${log.hostname} - ${log.msg}  - ${JSON.stringify(log.req) ? `method : ${log.req.method} url : ${log.req.url} ` : JSON.stringify(log.res)}`
}

onMounted(() => {
  // events.on('serverLog', (event) => {
  //   // event.detail — объект с ключом detail, в котором лежит строка
  //   const logStr = event.detail.detail // <- вот эта строка
  //   // console.log('👀 Получен лог:', logStr)
  //   // Теперь парсим лог и добавляем в массив
  //   try {
  //     const logObj = JSON.parse(logStr)
  //     // counterStore.logs.push(logObj);
  //     counterStore.addLogs(logObj)
  //   } catch {
  //     // counterStore.logs.push('⚠️ Невалидный лог');
  //     counterStore.addLogs('⚠️ Невалидный лог')
  //   }
  // })
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
