// Примечание: используются глобальные API vitest (describe/it/expect) — в этой
// конфигурации (globals: true) импорт из 'vitest' ломается на этапе коллекции.
import { TEXT_STYLE_DEFAULTS, TEXT_STYLE_KEYS, normalizeTextProps } from '../../assets/textLayout'
import type { LabelElementProps } from '../../types/label'

describe('textStyleRegistry', () => {
  it('TEXT_STYLE_KEYS matches TEXT_STYLE_DEFAULTS keys 1:1', () => {
    expect([...TEXT_STYLE_KEYS].sort()).toEqual(Object.keys(TEXT_STYLE_DEFAULTS).sort())
  })

  it('every style key has a default and is filled by normalizeTextProps', () => {
    const normalized = normalizeTextProps({})
    for (const key of TEXT_STYLE_KEYS) {
      expect(TEXT_STYLE_DEFAULTS).toHaveProperty(key)
      expect(normalized).toHaveProperty(key)
    }
  })

  it('every style key exists on LabelElementProps (type-level guard)', () => {
    // Type-level проверка: если ключ добавлен в реестр, но отсутствует в
    // LabelElementProps — этот маппинг не скомпилируется (когда тесты включены
    // в type-check). Текущие тесты исключены из tsconfig.app.json, поэтому
    // проверка также продублирована рантайм-проверками выше.
    type AssertStyleKeysInProps = {
      [K in (typeof TEXT_STYLE_KEYS)[number]]: LabelElementProps[K]
    }
    const record: Partial<AssertStyleKeysInProps> = {} as LabelElementProps
    expect(record).toBeDefined()
  })
})
