import { defineStore } from 'pinia'
import { getPNComponents } from '@/api/partNumberComponentsServices'
import type { PartNumberComponent } from '../../../shared/src'
export const usePartNumberComponents = defineStore('partNumberComponents', {
  state: () => ({
    partNumberComponents: null as PartNumberComponent[] | null
  }),
  getters: {
    listPartNumbers: (state) =>
      state.partNumberComponents?.map((e) => `${e.partNumber}    ${e.descriptionRU}`),
    enclosuretNumbers: (state) =>
      state.partNumberComponents?.filter((e) => e.descriptionEN.includes('Enclosure'))
  },
  actions: {
    async getPartNumberComponents() {
      try {
        const result = await getPNComponents()
        this.partNumberComponents = result.data
      } catch (error) {
        console.log(error)
      }
    }
  }
})
