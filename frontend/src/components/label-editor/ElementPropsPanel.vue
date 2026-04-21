<script setup lang="ts">
import { nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { os, filesystem } from '@neutralinojs/lib'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { ensureFontFace, loadFont } from '@/assets/renderToSVG'
import type { FontItem } from '@/assets/renderToSVG'

const store = useLabelEditorStore()
const { selectedElement, selectedId, availableFonts, fontsLoading } = storeToRefs(store)

function onTextInput(value: string) {
  if (selectedElement.value?.type === 'text') {
    selectedElement.value.props.customText = value
  }
}

// Вызывается при выборе шрифта — гарантирует что FontFace зарегистрирован
// и шрифт виден в канвасе
async function onFontChange(value: string) {
  if (!value) return
  console.group(`[font] onFontChange("${value}")`)

  // v-autocomplete эмитит item.value — это либо fileBase либо friendlyName
  // в зависимости от того, успел ли IntersectionObserver обновить item.value
  const item = availableFonts.value.find((f) => f.value === value)
  console.log(
    '[font] item найден:',
    item ? `label="${item.label}" value="${item.value}" loaded=${item.loaded}` : 'НЕ НАЙДЕН'
  )
  console.log(
    '[font] availableFonts первые 5:',
    availableFonts.value.slice(0, 5).map((f) => f.value)
  )

  const ok = await ensureFontFace(value, item)
  console.log('[font] ensureFontFace вернул:', ok)

  const finalValue = item?.value ?? value
  console.log('[font] finalValue для fontFamily:', finalValue)

  if (selectedElement.value?.type === 'text') {
    // Сначала применяем шрифт
    selectedElement.value.props.fontFamily = finalValue

    // <style> инжект в ensureFontFace уже форсировал CSS recompute,
    // но Vue ещё не перерисовал элемент. Делаем "пинг": сбрасываем → nextTick → восстанавливаем.
    // Это заставляет браузер переприменить font-family уже после регистрации шрифта.
    await nextTick()
    selectedElement.value.props.fontFamily = ''
    await nextTick()
    selectedElement.value.props.fontFamily = finalValue

    console.log('[font] fontFamily применён:', selectedElement.value.props.fontFamily)

    // Проверяем computed style после пинга
    await nextTick()
    const canvasEl = document.querySelector(
      '.label-element--selected .element-content'
    ) as HTMLElement | null
    if (canvasEl) {
      console.log(
        '[font] computed fontFamily на канвасе:',
        window.getComputedStyle(canvasEl).fontFamily
      )
    } else {
      console.warn('[font] элемент не найден в DOM')
    }
  }

  console.groupEnd()
}

// Директива v-lazy-font: загружает шрифт когда элемент списка входит во viewport.
// Используется в #item слоте v-autocomplete для ленивого превью.
const vLazyFont = {
  mounted(el: HTMLElement, binding: { value: FontItem }) {
    const item = binding.value
    if (item.loaded) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          ensureFontFace(item.value, item)
          observer.disconnect()
        }
      },
      { threshold: 0 }
    )
    observer.observe(el)
    // Сохраняем observer чтобы отключить при размонтировании
    ;(el as any).__fontObserver = observer
  },
  unmounted(el: HTMLElement) {
    ;(el as any).__fontObserver?.disconnect()
  }
}

// ── Выбор SVG-файла изображения через нативный диалог ────────────────────────
async function pickImageFile() {
  const el = selectedElement.value
  if (!el || el.type !== 'image') return

  const entries = await os.showOpenDialog('Выбрать изображение', {
    filters: [
      { name: 'SVG-изображение', extensions: ['svg'] },
      { name: 'Растровое изображение', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  })
  if (!entries?.length) return

  const path = entries[0]
  const ext = path.split('.').pop()?.toLowerCase()

  if (ext === 'svg') {
    // SVG читаем как бинарный файл и кодируем в base64 data URL.
    // Сырой SVG-текст не работает в <img src="...">, data URL — работает везде.
    const buf = await filesystem.readBinaryFile(path)
    const uint8 = new Uint8Array(buf)
    // btoa требует latin1 — перекодируем UTF-8 через escape trick
    const b64 = btoa(Array.from(uint8, (b) => String.fromCharCode(b)).join(''))
    el.props.src = `data:image/svg+xml;base64,${b64}`
  } else {
    // Растровое — читаем как бинарный файл и конвертируем в base64 data URL
    const buf = await filesystem.readBinaryFile(path)
    const uint8 = new Uint8Array(buf)
    const b64 = btoa(String.fromCharCode(...uint8))
    const mime =
      ext === 'svg'
        ? 'image/svg+xml'
        : ext === 'jpg' || ext === 'jpeg'
          ? 'image/jpeg'
          : ext === 'webp'
            ? 'image/webp'
            : 'image/png'
    el.props.src = `data:${mime};base64,${b64}`
  }
}
</script>

<template>
  <div>
    <!-- Заголовок с типом элемента и кнопкой удаления -->
    <div v-if="selectedElement">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px">
        <v-icon size="14" color="primary">
          {{
            selectedElement.type === 'text'
              ? 'mdi-format-text'
              : selectedElement.type === 'barcode'
                ? 'mdi-barcode'
                : 'mdi-image'
          }}
        </v-icon>
        <span style="font-size: 13px; font-weight: 600; color: #444">
          {{
            selectedElement.type === 'text'
              ? 'Текст'
              : selectedElement.type === 'barcode'
                ? 'Штрихкод'
                : 'Изображение'
          }}
        </span>
        <span style="font-size: 11px; color: #aaa">{{ selectedElement.dataField }}</span>
        <v-btn
          icon="mdi-delete-outline"
          size="x-small"
          variant="text"
          color="error"
          style="margin-left: auto"
          @click="store.removeElement(selectedId!)"
        />
      </div>

      <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-start">
        <!-- ── Текст ── -->
        <template v-if="selectedElement.type === 'text'">
          <!-- Шрифт и размер в одной строке -->
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; width: 100%">
            <v-autocomplete
              v-model="selectedElement.props.fontFamily"
              :items="availableFonts"
              item-title="label"
              item-value="value"
              label="Шрифт"
              density="compact"
              style="min-width: 120px; flex: 1"
              hide-details
              auto-select-first
              clearable
              :loading="fontsLoading"
              @update:model-value="onFontChange"
            >
              <!--
                #item слот: каждая строка отображает имя своим шрифтом.
                v-lazy-font запускает IntersectionObserver — шрифт загружается
                только когда строка прокручивается в видимую область.
                После загрузки item.label обновляется на friendlyName реактивно.
              -->
              <template #item="{ item, props: itemProps }">
                <v-list-item v-bind="itemProps" :title="undefined" v-lazy-font="item.raw">
                  <span
                    :style="{
                      fontFamily: item.raw.loaded ? item.raw.value : 'inherit',
                      fontSize: '15px'
                    }"
                  >
                    {{ item.raw.label }}
                  </span>
                  <template v-if="!item.raw.loaded" #append>
                    <v-progress-circular size="12" width="1" indeterminate color="grey-lighten-1" />
                  </template>
                </v-list-item>
              </template>
            </v-autocomplete>
            <v-text-field
              v-model.number="selectedElement.props.fontSize"
              type="number"
              label="Размер"
              suffix="px"
              density="compact"
              style="width: 80px"
              hide-details
            />
            <v-select
              v-model="selectedElement.props.align"
              :items="[
                { title: '←', value: 'left' },
                { title: '↔', value: 'center' },
                { title: '→', value: 'right' }
              ]"
              item-title="title"
              item-value="value"
              density="compact"
              style="width: 70px"
              hide-details
            />
            <v-checkbox
              v-model="selectedElement.props.bold"
              label="Ж"
              density="compact"
              hide-details
              style="flex: none"
            />
          </div>

          <!-- Текстовое содержимое -->
          <div style="width: 100%">
            <v-textarea
              :model-value="store.getDisplayText(selectedElement)"
              label="Текст"
              rows="2"
              density="compact"
              hide-details
              auto-grow
              @update:model-value="onTextInput"
            />
          </div>
        </template>

        <!-- ── Штрихкод ── -->
        <template v-if="selectedElement.type === 'barcode'">
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap; width: 100%">
            <v-select
              v-model="selectedElement.props.barcodeType"
              :items="['code128', 'datamatrix']"
              label="Тип"
              density="compact"
              style="width: 120px"
              hide-details
              @update:model-value="store.updateBarcode(selectedId!)"
            />
            <template v-if="selectedElement.props.barcodeType === 'code128'">
              <v-text-field
                v-model.number="selectedElement.props.barcodeHeight"
                type="number"
                label="Высота"
                density="compact"
                style="width: 80px"
                hide-details
                @update:model-value="store.updateBarcode(selectedId!)"
              />
            </template>
            <template v-if="selectedElement.props.barcodeType === 'datamatrix'">
              <v-text-field
                v-model.number="selectedElement.props.barcodeScale"
                type="number"
                step="1"
                label="Масштаб"
                density="compact"
                style="width: 80px"
                hide-details
                @update:model-value="store.updateBarcode(selectedId!)"
              />
            </template>
          </div>
          <v-text-field
            v-model="selectedElement.props.testValue"
            label="Тестовое значение"
            density="compact"
            style="width: 100%"
            hide-details
            @update:model-value="store.updateBarcode(selectedId!)"
          />
        </template>

        <!-- ── Изображение ── -->
        <template v-if="selectedElement.type === 'image'">
          <div style="display: flex; gap: 8px; align-items: center; width: 100%">
            <v-text-field
              v-model="selectedElement.props.src"
              label="URL или SVG-контент"
              density="compact"
              hide-details
              style="flex: 1; min-width: 0"
              :placeholder="'https://... или <svg>...</svg>'"
            />
            <v-btn
              size="small"
              variant="outlined"
              color="secondary"
              prepend-icon="mdi-folder-open-outline"
              @click="pickImageFile"
            >
              Файл
            </v-btn>
          </div>

          <!-- Превью -->
          <div
            v-if="selectedElement.props.src"
            style="
              width: 100%;
              max-height: 80px;
              display: flex;
              align-items: center;
              justify-content: center;
              background: #f5f5f5;
              border-radius: 4px;
              padding: 4px;
            "
          >
            <div
              v-if="selectedElement.props.src?.trimStart().startsWith('<svg')"
              style="max-width: 100%; max-height: 76px; overflow: hidden"
              v-html="selectedElement.props.src"
            />
            <img
              v-else
              :src="selectedElement.props.src"
              style="max-width: 100%; max-height: 76px; object-fit: contain"
            />
          </div>

          <v-text-field
            v-model.number="selectedElement.props.imageWidth"
            type="number"
            label="Ширина (px)"
            density="compact"
            style="width: 120px"
            hide-details
          />
        </template>
      </div>
    </div>

    <!-- Пустое состояние -->
    <div v-else style="color: #bbb; font-size: 12px; text-align: center; padding: 20px 0">
      <v-icon size="28" color="#ddd">mdi-cursor-default-click-outline</v-icon>
      <div style="margin-top: 6px">Выберите элемент на макете</div>
    </div>
  </div>
</template>
