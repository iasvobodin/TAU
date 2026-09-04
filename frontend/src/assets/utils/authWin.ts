import { filesystem, os, resources } from '@neutralinojs/lib'

const AUTH_CONFIG = {
  resourcesPath: '/frontend/dist/',
  scriptName: 'auth.exe'
}

/**
 * Версия auth.exe, которая ожидается в ресурсах приложения.
 * Должна совпадать с константой VERSION в auth.cs.
 */
const AUTH_EXE_VERSION = '2.1.0'

/**
 * Получить локальный путь для auth.exe.
 * Используем %TEMP% — это гарантированно локальная папка (не UNC),
 * чтобы CMD.EXE (через который NeutralinoJS запускает процесс) не падал с ошибкой
 * "CMD.EXE не может работать с UNC".
 */
async function getLocalTargetPath(): Promise<string> {
  try {
    const tempDir = await os.getEnv('TEMP')
    if (tempDir) return `${tempDir}\\${AUTH_CONFIG.scriptName}`
  } catch {
    // fallback
  }
  return `C:\\Windows\\Temp\\${AUTH_CONFIG.scriptName}`
}

/**
 * Получить версию локального auth.exe, запустив его с флагом --version
 */
async function getLocalVersion(): Promise<string | null> {
  const targetPath = await getLocalTargetPath()
  try {
    const result = await os.execCommand(`"${targetPath}" --version`)
    return result.stdOut.trim() || null
  } catch {
    return null
  }
}

/**
 * Извлечь auth.exe из ресурсов приложения в локальную temp-папку
 */
async function extractAuthExe(): Promise<string> {
  const targetPath = await getLocalTargetPath()
  console.log(`[authWin] Извлекаю auth.exe ${AUTH_EXE_VERSION} из ресурсов в ${targetPath}...`)
  const fullResourcePath = `${AUTH_CONFIG.resourcesPath}${AUTH_CONFIG.scriptName}`
  const binaryContent = await resources.readBinaryFile(fullResourcePath)
  await filesystem.writeBinaryFile(targetPath, binaryContent)
  console.log(`[authWin] auth.exe ${AUTH_EXE_VERSION} извлечён`)
  return targetPath
}

/**
 * Проверить и при необходимости обновить auth.exe.
 * Если файла нет или версия устарела — извлекает новый из ресурсов.
 */
async function ensureAuthExe(): Promise<string> {
  const localVersion = await getLocalVersion()

  if (localVersion === AUTH_EXE_VERSION) {
    console.log(`[authWin] auth.exe версия ${localVersion} актуальна`)
    return await getLocalTargetPath()
  }

  if (localVersion === null) {
    console.log('[authWin] auth.exe отсутствует — извлекаем...')
  } else {
    console.log(
      `[authWin] auth.exe версия ${localVersion} устарела (нужна ${AUTH_EXE_VERSION}) — обновляем...`
    )
  }

  return await extractAuthExe()
}

/**
 * Основная функция авторизации.
 * Вызывает нативное окно Windows и возвращает ЧИСТЫЙ логин без домена.
 * @returns string - логин пользователя, либо null в случае отмены/ошибки
 */
export async function requestWindowsAuth(): Promise<string | null> {
  try {
    // 1. Гарантируем, что файл auth.exe актуальной версии в ЛОКАЛЬНОЙ temp-папке
    const targetPath = await ensureAuthExe()

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
