import { defineStore } from 'pinia'
import { os } from '@neutralinojs/lib'
import { createUser, getUser } from '@/api/userServices'
import type { Prisma, User } from '../../../extensions/src'
export const useUserStore = defineStore('user', {
  state: () => ({
    userName: '',
    userExist: true,
    userFullName: ''
  }),
  actions: {
    setUserName(this: { userName: string }, name: string, userName: string) {
      this.userName = name
    },
    resetUserExist(this: { userExist: boolean }) {
      this.userExist = true
    },
    async getUserName(this: { userName: string; userExist: boolean; userFullName: string }) {
      try {
        const login = await os.getEnv('USERNAME')
        console.log(`login: ${login}`)
        this.userName = login
        const result = await getUser(login)
        if (result.data) {
          this.userFullName = result.data.Name
        }
        if (result.error) {
          //такого пользователя нет, нужно создать
          this.userExist = false
          this.userName = login
        }
      } catch (err) {
        console.error('Ошибка при получении имени пользователя:', err)
      }
    },
    async createUserName(
      this: { userFullName: string; userExist: boolean },
      data: Prisma.UserCreateInput
    ) {
      try {
        const result = await createUser(data)
        this.userFullName = result.data?.Name!
      } catch (error) {
        //не получилось создать юзера БЯДА!!!!
        this.userExist = false
      }
    }
  }
})
