import { defineStore } from 'pinia'
import { getPNComponents } from '@/api/partNumberComponentsServices'
import type { PartNumberComponent } from '../../../extensions/src'
export const usePartNumberComponents = defineStore('partNumberComponents', {
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
