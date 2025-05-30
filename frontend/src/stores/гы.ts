import { defineStore } from 'pinia'
import { os } from '@neutralinojs/lib'
import { createUser, getUser } from '@/api/userServices'
import type { Prisma } from '../../../extensions/src'

export const useUserStore = defineStore('user', {
  state: () => ({
    userName: '', // логин из ОС
    userExist: true, // существует ли пользователь в БД
    userFullName: '' // ФИО из БД
  }),
  getters: {
    // Простой геттер — нужно ли спрашивать ФИО
    needsFullName(): boolean {
      return !this.userExist || !this.userFullName
    },
    isFullNameValid: (state) => {
      const pattern = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/
      return pattern.test(state.userFullName)
    }
  },
  actions: {
    async getUserName() {
      try {
        const login = await os.getEnv('USERNAME')
        this.userName = login

        const result = await getUser(login)

        if (result.data) {
          this.userFullName = result.data.Name
          this.userExist = true
        } else {
          // Пользователь не найден
          this.userExist = false
        }
      } catch (err) {
        console.error('Ошибка при получении имени пользователя:', err)
        this.userExist = false
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
