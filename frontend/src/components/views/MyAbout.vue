<script setup lang="ts">
import { useRouter } from 'vue-router'
import { app, window as neuWindow } from '@neutralinojs/lib'
const router = useRouter()
const goBack = () => {
  // router.go(-1)
  // neuWindow.show()
  // app.killProcess()
  router.push('/')
}
</script>

<template>
  <!-- <h1>Hello ABOUT</h1>
  <button @click="goBack">Back</button> -->
  <embed :src="`http://127.0.0.1:8080/test/19.5389.101.00 СБ.pdf`" type="application/pdf" />
</template>

<style scoped>
body,
html {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}
embed {
  width: 100vw;
  height: 99vh;
}
</style>
