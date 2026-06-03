import { getUser, updateUser } from '@/api/userServices'
import { app, os, storage } from '@neutralinojs/lib'
import type { Token } from '../interfaces'

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID
const CLIENT_SECRET = import.meta.env.VITE_CLIENT_SECRET
const API_URL = import.meta.env.VITE_API_URL

async function updateToken(token: Token) {
  const user = await os.getEnv('USERNAME')
  updateUser(user, {
    access_token: token.access_token,
    refresh_token: token.refresh_token
  }).then((res) => console.log(res.data))
}

export async function exchangeCode(code: string): Promise<Token> {
  // Получаем code_verifier, который мы генерировали заранее
  const codeVerifier = await storage.getData('code_verifier')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier
  })

  const res = await fetch('https://oauth.yandex.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const token = await res.json()

  await updateToken(token)

  //   console.log('TOKEN:', token)

  // Токен выглядит примерно так:
  // { access_token: '...', expires_in: 31536000, refresh_token: '...' }

  return token
}

export async function refreshToken() {
  const user = await os.getEnv('USERNAME')
  const resUser = await getUser(user)

  const refresh_token = resUser.data?.refresh_token
  if (!refresh_token) {
    return
  }

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET
  })

  const res = await fetch('https://oauth.yandex.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const newToken = await res.json()

  await updateToken(newToken)
  //   console.log('Обновлённый токен:', newToken)
}

function generateCodeVerifier(): string {
  const array = new Uint8Array(64) // длина от 43 до 128 символов
  crypto.getRandomValues(array)
  return Array.from(array, (b) => ('0' + b.toString(16)).slice(-2)).join('')
}

async function base64url(buffer: ArrayBuffer): Promise<string> {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier) // data: Uint8Array
  const digest = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  // ⬆️ используем .buffer (ArrayBuffer), который digest точно принимает
  return base64url(digest)
}

interface PKCE {
  codeVerifier: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

async function generatePKCE(): Promise<PKCE> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  }
}

export async function startAuth() {
  const user = await os.getEnv('USERNAME')
  const clientId = CLIENT_ID
  const stateObj = {
    userId: user,
    nonce: crypto.randomUUID() // для защиты от CSRF
  }
  const state = btoa(JSON.stringify(stateObj))

  const redirectUri = `${API_URL}/callback`
  console.log(redirectUri)

  // Генерация PKCE
  const { codeVerifier, codeChallenge } = await generatePKCE()
  await storage.setData('code_verifier', codeVerifier)

  const authUrl = new URL('https://oauth.yandex.com/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  await os.open(authUrl.toString())
}
