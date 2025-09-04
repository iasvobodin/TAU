import { defineStore } from 'pinia'
import { createUser, getUser } from '@/api/userServices'
import type { Prisma } from '../../../shared/src'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
declare const __BUILD_DATE__: string
function getCurrentFormattedDate(dateStr: string): string {
  const date = new Date(dateStr)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}.${month}.${year}`
}
const buildDate = getCurrentFormattedDate(__BUILD_DATE__)
export const useUserStore = defineStore('user', {
  state: () => ({
    userName: '', // логин из ОС
    userExist: true, // существует ли пользователь в БД
    userFullName: '', // ФИО из БД
    isLoadingUser: false // 👈 добавили
  }),
  getters: {
    // Простой геттер — нужно ли спрашивать ФИО
    needsFullName(): boolean {
      // 👇 пока грузится — не показываем диалог
      return !this.isLoadingUser && (!this.userExist || !this.userFullName)
    },
    isFullNameValid: (state) => {
      const pattern = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/
      return pattern.test(state.userFullName)
    }
  },
  actions: {
    async getUserName() {
      this.isLoadingUser = true
      try {
        const login = await os.getEnv('USERNAME')
        this.userName = login

        const result = await getUser(login)
        if (result.data) {
          this.userFullName = result.data.Name
          this.userExist = true
          try {
            await neuWindow.setTitle(`TAУ V ${buildDate} ${this.userName}`)
          } catch (err) {
            console.error('Ошибка при обновлении заголовка:', err)
          }
        } else {
          this.userExist = false
        }
      } catch (err) {
        console.error('Ошибка при получении пользователя', err)
        this.userExist = false
      } finally {
        this.isLoadingUser = false // 👈 сброс
      }
    },

    async createUserName(data: Prisma.UserCreateInput) {
      try {
        const result = await createUser(data)
        if (result.data?.Name) {
          this.userFullName = result.data.Name
          this.userExist = true
        } else {
          this.userExist = false
        }
      } catch (error) {
        console.error('Ошибка при создании пользователя:', error)
        this.userExist = false
      }
    },

    resetUserExist() {
      this.userExist = true
    },

    // Упрощённый метод сохранения ФИО (используется в компоненте)
    async saveFullName(name: string) {
      return await this.createUserName({
        Login: this.userName,
        Name: name
      })
    }
  }
})
