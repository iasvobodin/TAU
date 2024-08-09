import { defineStore } from 'pinia'
import type { PartNumberComponent } from '../assets/interfaces'
export const usePartNumberComponents = defineStore({
  id: 'partNumberComponents',
  state: () => ({
    partNumberComponents: null as PartNumberComponent[] | null
  }),
  getters: {
    listPartNumbers: (state) =>
      state.partNumberComponents?.map((e) => `${e.partNumber}    ${e.descriptionRU}`)
  },
  actions: {
    async getPartNumberComponents() {
      try {
        const response = await fetch('http://localhost:3000/part-number-components')

        if (response.ok) {
          const data = await response.json()
          this.partNumberComponents = data
        } else {
          console.error('Failed to retrieve PartNumberComponents:', response.statusText)
        }
      } catch (error) {
        console.log(error)
      }
    }
  }
})
