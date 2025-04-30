// import { defineStore } from 'pinia'

// export const useErrorStore = defineStore('error', {
//   state: () => ({
//     errorMessages: [] as string[],
//     infoMessages: [] as string[]
//   }),
//   actions: {
//     addError(message: string) {
//       this.errorMessages.push(message)
//     },
//     removeError() {
//       this.errorMessages.shift()
//     },
//     addInfo(message: string) {
//       this.infoMessages.push(message)
//     },
//     removeInfo() {
//       this.infoMessages.shift()
//     }
//     //добавить ведение журнала ошибок
//   }
// })

import { defineStore } from 'pinia'

export const useErrorStore = defineStore('error', {
  state: () => ({
    errorMessages: [] as string[],
    infoMessages: [] as string[],
    isErrorDisabled: false // Флаг для отключения вывода ошибок
  }),
  actions: {
    addError(message: string) {
      if (!this.isErrorDisabled) {
        this.errorMessages.push(message)
      }
    },
    removeError() {
      this.errorMessages.shift()
    },
    addInfo(message: string) {
      this.infoMessages.push(message)
    },
    removeInfo() {
      this.infoMessages.shift()
    },
    // Метод для временного отключения вывода ошибок
    disableErrorOutput() {
      this.isErrorDisabled = true
    },
    // Метод для включения вывода ошибок
    enableErrorOutput() {
      this.isErrorDisabled = false
    }
  }
})
