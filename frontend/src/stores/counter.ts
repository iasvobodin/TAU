import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const settings = ref(false)
  const adminView = ref(false)
  const logs = ref<string[]>([])
  const doubleCount = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  function addLogs(log: string) {
    logs.value.push(log)
  }

  return { count, doubleCount, settings, adminView, logs, addLogs, increment }
})
