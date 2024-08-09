import { defineStore } from 'pinia'
import { os } from '@neutralinojs/lib'
import { createUser, getUser } from '@/api/userServices'
import type { Prisma, User } from '../../../extensions/src'
export const useUserStore = defineStore({
  id: 'user',
  state: () => ({
    userName: '',
    userExist: true,
    userFullName: ''
  }),
  actions: {
    setUserName(name: string) {
      this.userName = name
    },
    resetUserExist() {
      this.userExist = true
    },
    async getUserName() {
      try {
        const userName = await os.execCommand('powershell $env:USERNAME')
        const login = userName.stdOut.replace(/\r?\n|\r/g, '')
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
    async createUserName(data: Prisma.UserCreateInput) {
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
