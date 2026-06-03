import { defineStore } from 'pinia'
import type { ViewName } from '@/assets/interfaces'

export const useNavigationStore = defineStore('navigation', {
  state: () => ({
    current: 'InputControl' as ViewName,
    payload: {} as Record<string, any>
  }),
  actions: {
    goTo(tab: ViewName, payload: Record<string, any> = {}) {
      this.current = tab
      this.payload = payload
    }
  }
})
