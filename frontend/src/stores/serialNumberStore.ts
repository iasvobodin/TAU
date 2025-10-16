// store/serialNumberStore.ts
import { defineStore } from 'pinia'
// import type { SerialNumderData } from '@/assets/interfaces'
import type { SerialNumberData } from '@/assets/interfaces'
// type SerialNumberData = {
//   name: string
//   partNumber: string
// }

export const useSerialNumberStore = defineStore('serialNumberStore', {
  state: () => ({
    sNumbers: [] as SerialNumberData[],
    isDuplicate: false
  }),
  actions: {
    addSerialNumber(serialNumber: SerialNumberData) {
      const isDuplicate = this.sNumbers.some((item) => item.name === serialNumber.name)
      if (!isDuplicate) {
        // this.sNumbers.push(serialNumber)
        this.sNumbers.unshift(serialNumber)
        // this.sNumbers = [serialNumber, ...this.sNumbers]
        this.isDuplicate = false
      } else {
        this.isDuplicate = true
      }
    },
    /** 🔹 Обновить элемент по имени */
    updateSerialNumber(name: string, updates: Partial<SerialNumberData>) {
      const index = this.sNumbers.findIndex((item) => item.name === name)
      if (index !== -1) {
        this.sNumbers[index] = {
          ...this.sNumbers[index],
          ...updates
        }
      }
    }
  }
})
