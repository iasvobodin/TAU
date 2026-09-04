// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт из 'vitest' ломается на этапе коллекции.
// safeJson.ts — чистый модуль без Neutralino/DOM → моков не требует.
import { escapeRawControlChars, safeJsonParse } from '../../assets/safeJson'

describe('safeJson', () => {
  it('стандартный JSON.parse падает на «сыром» переносе строки внутри строки (регрессия бага)', () => {
    const badJson =
      '{"id":1,"componentSN":"SN123456","actionType":"DetectDefect","status":"on_hold","description":"\nпервая строка\nвторая","user":"Ivan"}'
    expect(() => JSON.parse(badJson)).toThrow(/Bad control character in string literal in JSON/)
  })

  it('safeJsonParse чинит «сырой» JSON и сохраняет данные', () => {
    const badJson =
      '{"id":1,"componentSN":"SN123456","actionType":"DetectDefect","status":"on_hold","description":"\nпервая строка\nвторая","user":"Ivan"}'
    const parsed = safeJsonParse(badJson)
    expect(parsed.description).toBe('\nпервая строка\nвторая')
    expect(parsed.id).toBe(1)
    expect(parsed.actionType).toBe('DetectDefect')
  })

  it('валидный JSON с переносами строк между токенами не ломается', () => {
    const validJson = '{\n  "a": 1,\n  "b": "текст\\nс экранированным переносом"\n}'
    expect(safeJsonParse(validJson)).toEqual({
      a: 1,
      b: 'текст\nс экранированным переносом'
    })
  })

  it('уже экранированные \\n, \\t, \\r, \\uXXXX не дублируются', () => {
    const alreadyEscaped = '{"d":"a\\nb\\u000ac\\tb\\r"}'
    expect(safeJsonParse(alreadyEscaped)).toEqual({ d: 'a\nb\nc\tb\r' })
  })

  it('сырые табуляция и CR внутри строки экранируются корректно', () => {
    const tabJson = '{"x":"a\tb","y":"c\rd"}'
    const parsed = safeJsonParse(tabJson)
    expect(parsed.x).toBe('a\tb')
    expect(parsed.y).toBe('c\rd')
  })

  it('escapeRawControlChars не трогает символы вне строковых литералов', () => {
    const text = '{"a":\n"x\tz"}'
    const escaped = escapeRawControlChars(text)
    // Перенос между ":" и строкой остаётся "сырым", таб внутри строки — экранирован
    expect(escaped).toBe('{"a":\n"x\\tz"}')
  })

  it('пробрасывает ошибку на заведомо невалидном JSON (не control-char)', () => {
    expect(() => safeJsonParse('{"a": }')).toThrow()
  })
})
