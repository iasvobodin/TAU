import { storage } from '@neutralinojs/lib'
import type { Token } from '../interfaces'
export async function exchangeCode(code: string): Promise<Token> {
  // Получаем code_verifier, который мы генерировали заранее
  const codeVerifier = await storage.getData('code_verifier')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: 'e6e17b4cbbb6476d940403b2b1057da2',
    code_verifier: codeVerifier
  })

  const res = await fetch('https://oauth.yandex.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })

  const token = await res.json()
  console.log('TOKEN:', token)

  // Токен выглядит примерно так:
  // { access_token: '...', expires_in: 31536000, refresh_token: '...' }

  return token
}
