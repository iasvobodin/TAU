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
  <h1>Hello ABOUT</h1>
  <button @click="goBack">Back</button>
</template>
