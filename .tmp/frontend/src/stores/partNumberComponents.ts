import { defineStore } from 'pinia'
import type { PartNumberComponent } from '../assets/interfaces'
import { getPNComponents } from '@/api/partNumberComponentsServices'

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
      const result = await getPNComponents()
      this.partNumberComponents = result.data
    }
  }
})
