import { defineStore } from 'pinia'
import { createUser, getUser } from '@/api/userServices'
import type { Prisma } from '../../../shared/src'
import { app, os, filesystem, server, events, window as neuWindow } from '@neutralinojs/lib'
import { getCurrentFormattedDate } from '@/assets/utils/getCurrentFormattedDate'
import { requestWindowsAuth } from '@/assets/utils/authWin'
import { loadAuthConfig, saveAuthConfig, type AuthMode } from '@/assets/utils/authConfig'
declare const __BUILD_DATE__: string

const buildDate = getCurrentFormattedDate(__BUILD_DATE__)
export const useUserStore = defineStore('user', {
  state: () => ({
    userName: '', // логин из ОС
    userENV: '',
    userExist: true, // существует ли пользователь в БД
    userFullName: '', // ФИО из БД
    isLoadingUser: false,
    isSystemAuthOpen: false,
    authMode: 'device' as AuthMode // режим авторизации: 'device' | 'login'
  }),
  getters: {
    // Авторизован ли пользователь
    isAuthorized(): boolean {
      return !!this.userName
    },
    // Простой геттер — нужно ли спрашивать ФИО
    needsFullName(): boolean {
      //  пока грузится — не показываем диалог
      return !this.isLoadingUser && (!this.userExist || !this.userFullName)
    },
    isFullNameValid: (state) => {
      const pattern = /^[А-ЯЁ][а-яё]+ [А-ЯЁ]\.[А-ЯЁ]\.$/
      return pattern.test(state.userFullName)
    }
  },
  actions: {
    /**
     * Инициализация авторизации при старте приложения.
     * Загружает конфиг и, если режим 'device', автоматически авторизует.
     */
    async initAuth(): Promise<void> {
      const config = await loadAuthConfig()
      this.authMode = config.mode

      if (config.mode === 'device') {
        // Авторизация по устройству — берём из env Windows
        try {
          const username = await os.getEnv('USERNAME')
          this.userName = username || ''
          if (this.userName) {
            await this.getUserENV()
            await this.getUserName()
          }
        } catch (err) {
          console.error('Ошибка при авторизации по устройству:', err)
        }
      }
      // Если 'login' — ничего не делаем, ждём кнопку Войти
    },
    async getUserENV() {
      try {
        const comp = await os.getEnv('COMPUTERNAME')
        this.userENV = `${this.userName}_${comp}`
      } catch (error) {
        console.log(error)
      }
    },
    /**
     * Вызов окна авторизации Windows Security (только для режима 'login').
     * Вызывается один раз — без цикла.
     * @returns true если авторизация успешна, false если отменена
     */
    async getAuth(): Promise<boolean> {
      this.isLoadingUser = true
      try {
        // Включаем блокировку фронтенда перед запуском окна
        this.isSystemAuthOpen = true

        const login = await requestWindowsAuth()

        // Выключаем блокировку системы
        this.isSystemAuthOpen = false

        if (!login) {
          // Пользователь отменил или ошибка — не авторизован, без повтора
          console.warn('Авторизация отклонена пользователем')
          this.isLoadingUser = false
          return false
        }

        // Успешная авторизация
        this.userName = login
        await this.getUserENV()
        await this.getUserName()
        return true
      } catch (err) {
        console.error('Ошибка при авторизации', err)
        this.isSystemAuthOpen = false
        this.isLoadingUser = false
        return false
      }
    },
    async getUserName() {
      try {
        const result = await getUser(this.userName)
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
    },

    /**
     * Сменить режим авторизации и сохранить в .tmp/authConfig.json
     */
    async setAuthMode(mode: AuthMode): Promise<void> {
      this.authMode = mode
      await saveAuthConfig({ mode })

      if (mode === 'device') {
        // Сразу авторизуем по устройству
        await this.initAuth()
      } else {
        // Сбрасываем авторизацию
        this.userName = ''
        this.userENV = ''
        this.userFullName = ''
        this.userExist = true
      }
    }
  }
})
