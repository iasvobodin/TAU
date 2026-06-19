import { filesystem, os, resources } from '@neutralinojs/lib'
const AUTH_CONFIG = {
  resourcesPath: '/frontend/dist/',
  scriptName: 'auth.exe'
}

/**
 * Внутренняя функция для проверки и извлечения бинарника из ресурсов .neu
 */
async function ensureAuthExe(targetPath: string): Promise<void> {
  try {
    await filesystem.getStats(targetPath)
  } catch {
    console.log('auth.exe отсутствует на диске — извлекаем из ресурсов...')
    const fullResourcePath = `${AUTH_CONFIG.resourcesPath}${AUTH_CONFIG.scriptName}`
    const binaryContent = await resources.readBinaryFile(fullResourcePath)
    await filesystem.writeBinaryFile(targetPath, binaryContent)
    console.log('auth.exe успешно извлечен')
  }
}

/**
 * Основная функция авторизации.
 * Вызывает нативное окно Windows и возвращает ЧИСТЫЙ логин без домена.
 * @returns string - логин пользователя, либо null в случае отмены/ошибки
 */
export async function requestWindowsAuth(): Promise<string | null> {
  const targetPath = `${window.NL_PATH}/.tmp/${AUTH_CONFIG.scriptName}`

  try {
    // 1. Гарантируем, что файл auth.exe на диске
    await ensureAuthExe(targetPath)

    // 2. Вызываем окно авторизации
    console.log('Ожидание подтверждения учетных данных Windows...')
    const response = await os.execCommand(`"${targetPath}"`)
    // Логируем stderr от auth.exe (диагностические сообщения)
    if (response.stdErr) {
      response.stdErr.split('\n').forEach((line) => {
        const trimmed = line.trim()
        if (trimmed) console.log(`[auth.exe] ${trimmed}`)
      })
    }
    const authResult = response.stdOut.trim()

    // 3. Обрабатываем отмену или ошибку окна
    if (!authResult || authResult === 'CANCELED' || authResult.startsWith('ERROR')) {
      return null
    }

    // 4. Отрезаем "metran\", если винда его вернула, и отдаем чистый логин
    const cleanLogin = authResult.includes('\\') ? authResult.split('\\')[1] : authResult
    return cleanLogin
  } catch (error) {
    console.error('Критическая ошибка модуля winAuth:', error)
    return null
  }
}
