import { defineStore } from 'pinia'

export const useErrorStore = defineStore('error', {
  state: () => ({
    errorMessages: [] as string[],
    infoMessages: [] as string[]
  }),
  actions: {
    addError(message: string) {
      this.errorMessages.push(message)
    },
    removeError() {
      this.errorMessages.shift()
    },
    addInfo(message: string) {
      this.infoMessages.push(message)
    },
    removeInfo() {
      this.infoMessages.shift()
    }
  }
})
