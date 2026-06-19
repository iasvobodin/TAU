import { ref, type Ref, computed, reactive } from 'vue'
import { defineStore } from 'pinia'
import type { InputData } from '@/assets/interfaces'
export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const settings = ref(false)
  const functionalTestDev = ref(false)
  const adminView = ref(false)
  const logs = ref<string[]>([])
  // const inputData: Ref<InputData> = ref({
  //   serverPath: '',
  //   pdfName: '',
  //   convertDone: false
  // })
  const inputData = ref({
    serverPath: '',
    pdfName: '',
    convertDone: false
  } as InputData)
  const doubleCount = computed(() => count.value * 2)
  function increment() {
    count.value++
  }
  function addLogs(log: string) {
    logs.value.push(log)
  }
  function setInputData(data: InputData) {
    inputData.value = { ...inputData.value, ...data }
  }

  return {
    count,
    inputData,
    doubleCount,
    settings,
    functionalTestDev,
    adminView,
    logs,
    addLogs,
    increment,
    setInputData
  }
})
