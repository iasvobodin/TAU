/**
 * Клиент для серверной конвертации паспортов (через LibreOffice).
 *
 * Используется как альтернатива локальной конвертации через ps1 + Word COM.
 * Позволяет не ломая существующую логику, добавить возможность конвертации на сервере.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'

export interface PassportConvertRequest {
  partNumber: string
  serialNumbers: string[]
}

export interface PassportConvertResponse {
  success: boolean
  pdfUrl?: string
  pdfName?: string
  pagesCount?: number
  error?: string
  code?: string
}

export interface SofficeCheckResponse {
  available: boolean
  version?: string
  error?: string
}

/**
 * Проверить доступность LibreOffice (soffice) на сервере
 */
export async function checkSoffice(): Promise<SofficeCheckResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/passport/check-soffice`)
    if (!res.ok) {
      return { available: false, error: `HTTP ${res.status}: ${res.statusText}` }
    }
    return await res.json()
  } catch (err: any) {
    return { available: false, error: err.message || 'Ошибка соединения с сервером' }
  }
}

/**
 * Конвертировать паспорт на сервере.
 * Сервер сам ищет шаблон на сетевой папке.
 */
export async function convertPassportOnServer(
  partNumber: string,
  serialNumbers: string[]
): Promise<PassportConvertResponse> {
  return convertPassportWithTemplate(partNumber, serialNumbers)
}

/**
 * Конвертировать паспорт на сервере, передавая шаблон в Base64.
 * Клиент (Neutralino) сам находит и читает шаблон, т.к. у сервера
 * может не быть доступа к сетевой папке.
 *
 * @param partNumber - артикул изделия
 * @param serialNumbers - массив серийных номеров
 * @param templateBase64 - содержимое .docx шаблона в Base64
 */
export async function convertPassportWithTemplate(
  partNumber: string,
  serialNumbers: string[],
  templateBase64?: string
): Promise<PassportConvertResponse> {
  try {
    const body: Record<string, any> = { partNumber, serialNumbers }
    if (templateBase64) {
      body.templateBase64 = templateBase64
    }

    const res = await fetch(`${API_BASE}/api/passport/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const data: PassportConvertResponse = await res.json()

    if (!res.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${res.status}`,
        code: data.code
      }
    }

    return data
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Ошибка соединения с сервером',
      code: 'NETWORK_ERROR'
    }
  }
}

/**
 * Получить полный URL для открытия PDF в браузере.
 * Если pdfUrl уже абсолютный — возвращаем как есть.
 */
export function getPdfFullUrl(pdfUrl: string): string {
  if (pdfUrl.startsWith('http://') || pdfUrl.startsWith('https://')) {
    return pdfUrl
  }
  return `${API_BASE}${pdfUrl}`
}
