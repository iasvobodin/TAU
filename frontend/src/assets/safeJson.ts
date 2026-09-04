/**
 * Утилиты для устойчивого к «сырым» управляющим символам парсинга JSON.
 *
 * Некоторые бэкенды/прокси не экранируют переносы строк, табуляцию и другие
 * управляющие символы внутри строковых полей (например, description/supplierResponse
 * типа @db.Text в SQL Server). Из-за этого стандартный JSON.parse падает с ошибкой
 * "Bad control character in string literal in JSON at position N".
 */

// Короткие JSON-экранирования для известных управляющих символов.
const CONTROL_ESCAPES: Record<number, string> = {
  0x08: '\\b',
  0x09: '\\t',
  0x0a: '\\n',
  0x0c: '\\f',
  0x0d: '\\r'
}

/**
 * Экранирует «сырые» управляющие символы (код < 0x20 или 0x7F) только внутри
 * строковых литералов JSON. Уже экранированные последовательности
 * (\n, \t, \r, \uXXXX и т.п.) не затрагиваются, а переносы строк между
 * JSON-токенами (валидные пробельные символы) остаются нетронутыми.
 */
export function escapeRawControlChars(text: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      // Пропускаем экранированную пару, чтобы не сломать уже корректные \n, \uXXXX и т.п.
      if (ch === '\\') {
        out += ch
        if (i + 1 < text.length) {
          out += text[i + 1]
          i++
        }
        continue
      }
      if (ch === '"') {
        inString = false
        out += ch
        continue
      }
      const code = ch.charCodeAt(0)
      if (code < 0x20 || code === 0x7f) {
        out += CONTROL_ESCAPES[code] ?? '\\u' + code.toString(16).padStart(4, '0')
        continue
      }
      out += ch
    } else {
      if (ch === '"') inString = true
      out += ch
    }
  }
  return out
}

/** Парсер JSON, устойчивый к «сырым» управляющим символам в строковых литералах. */
export function safeJsonParse(text: string): any {
  try {
    return JSON.parse(text)
  } catch (err) {
    return JSON.parse(escapeRawControlChars(text))
  }
}
