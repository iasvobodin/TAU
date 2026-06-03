import { useSvgEditorStore } from '@/stores/svgEditor'

/**
 * Тонкая обёртка для загрузки файла шрифта из <v-file-input>.
 * Вся логика хранения — в store.
 */
export function useFont() {
  const store = useSvgEditorStore()

  const loadFromFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    const name = file.name.replace(/\.[^.]+$/, '')
    await store.loadFontFromBuffer(buffer, name)
  }

  return { loadFromFile }
}
