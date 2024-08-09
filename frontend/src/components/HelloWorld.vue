<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { Mode, os, computer, extensions, window as neuWindow, events } from '@neutralinojs/lib'
defineProps({
  msg: String
})

// const localServer = ref(null)
const serverStats = reactive({
  port: 0,
  pid: 0
})

async function startLocalServer() {
  const localServer = await os.spawnProcess(
    'powershell ./server.exe',
    `${window.NL_CWD}/extensions`
  )
  console.log('Процесс запущен, ждём ответа от сервера PID: ' + localServer.pid)
}
async function killProcess(pid: number) {
  os.execCommand(`taskkill /F /PID ${pid}`)
    .then(() => {
      console.log('Процесс завершён успешно.')
    })
    .catch((err) => {
      console.error('Ошибка завершения процесса: ', err)
    })
  let processes = await os.getSpawnedProcesses()
  console.log(processes)
}
// async function closelocalServer() {
//   try {
//     process.kill(pid, 'SIGTERM')
//     console.log(`Процесс с PID ${pid} успешно завершён.`)
//   } catch (err) {
//     console.error(`Ошибка при завершении процесса с PID ${pid}: ${err}`)
//   }
//   // killProcess(10084)
//   // await os.updateSpawnedProcess(0, 'exit');
//   // localServer.value.kill()
//   // console.log(localServer.value.id);
//   let processes = await os.getSpawnedProcesses()
//   console.log(processes)
// }
async function test2() {
  let value = await os.getEnv('USER')
  console.log(`USER = ${value}`)
}
async function fetchJokes() {
  try {
    const response = await fetch('http://localhost:3000/users')
    const jokes = await response.json()
    fff.value = jokes
  } catch (error) {
    console.error(error)
  }
}

async function createPartNumberComponent() {
  const response = await fetch('http://localhost:3000/part-number-component', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      partNumber: 'PN12345',
      descriptionRU: 'Описание на русском',
      descriptionEN: 'Description in English'
    })
  })

  if (response.ok) {
    const data = await response.json()
    console.log('Created PartNumberComponent:', data)
  } else {
    console.error('Failed to create PartNumberComponent:', response.statusText)
  }
}

async function getPartNumberComponents() {
  const response = await fetch('http://localhost:3000/part-number-components')

  if (response.ok) {
    const data = await response.json()
    console.log('PartNumberComponents:', data)
    fff.value = data
  } else {
    console.error('Failed to retrieve PartNumberComponents:', response.statusText)
  }
}
function getModeString(mode: Mode): string {
  return Mode[mode]
}
onMounted(() => {
  console.log(window.NL_MODE)
  // if (getModeString(window.NL_MODE) === 'window' ) {
  events.on('windowClose', () => killProcess(serverStats.pid))
  events.on('spawnedProcess', (evt) => {
    console.log(evt.detail.data)

    serverStats.pid = JSON.parse(evt.detail.data).PID
    serverStats.port = JSON.parse(evt.detail.data).PORT
  })
  ;(async () => {
    let userName = await os.execCommand('powershell $env:USERNAME')
    console.log(userName.stdOut)
    await neuWindow.setTitle(`TAУ ${userName.stdOut}`)
  })()

  // }
})

const count = ref(0)
const fff = ref('')
</script>

<template>
  <h1>{{ msg }}</h1>
  <p>{{ serverStats.pid ? `server starts on port:${serverStats.port}` : 'server is stoped' }}</p>
  <div class="card">
    <v-btn @click="startLocalServer">startLocalServer </v-btn><br /><br />
    <v-btn @click="killProcess(serverStats.pid)">Close localServer </v-btn><br /><br />
    <v-btn @click="createPartNumberComponent">createPartNumberComponent</v-btn><br /><br />
    <v-btn @click="getPartNumberComponents">fetch Some Data </v-btn><br /><br />
    <!-- <button type="button" @click="startLocalServer">startLocalServer</button> <br>
    <button type="button" @click="killProcess(serverStats.pid)">Close localServer</button> <br>
    <button type="button" @click="test2">ttest2</button> <br>
    <button type="button" @click="createPartNumberComponent">createPartNumberComponent</button> <br>
    <button type="button" @click="getPartNumberComponents">fetch Some Data</button> -->

    <p>{{ fff }}</p>
    <p>
      Edit
      <code>components/HelloWorld.vue</code> to test HMR
    </p>
  </div>
</template>

<style scoped>
.read-the-docs {
  color: #888;
}
</style>
