// Этот файл будет запускаться перед всеми тестами
import { config } from '@vue/test-utils'

// Глобальные настройки для тестов
config.global.stubs = {
  // Заглушка для компонентов, если нужно
}

// Мок для opentype.js (чтобы не загружать реальный шрифт в тестах)
vi.mock('opentype.js', () => ({
  default: {
    load: vi.fn(() =>
      Promise.resolve({
        charToGlyph: vi.fn(() => ({ advanceWidth: 500 })),
        unitsPerEm: 1000,
        getPath: vi.fn(() => ({ toPathData: vi.fn(() => '') }))
      })
    ),
    parse: vi.fn(() =>
      Promise.resolve({
        charToGlyph: vi.fn(() => ({ advanceWidth: 500 })),
        unitsPerEm: 1000
      })
    )
  }
}))
