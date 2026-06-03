<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { os, filesystem } from '@neutralinojs/lib'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { ensureFontFace } from '@/assets/renderToSVG'

const store = useLabelEditorStore()
const { selectedElement, selectedId, availableFonts, fontsLoading } = storeToRefs(store)
const { splitDataField } = store // non-reactive helper — берём напрямую из store

// ── Состояние попапа редактирования текста ────────────────────────────────
const textPopupOpen = ref(false)

// ── Инлайн-редактирование имени поля (dataField prefix) ───────────────────
const renamingField = ref(false)
const renameInput = ref('')

function startRename() {
  if (!selectedElement.value) return
  const { prefix } = store.splitDataField(selectedElement.value.dataField)
  renameInput.value = prefix
  renamingField.value = true
}

function commitRename() {
  if (selectedId.value && renameInput.value.trim()) {
    store.renameField(selectedId.value, renameInput.value)
  }
  renamingField.value = false
}

function cancelRename() {
  renamingField.value = false
}

// Авто-фокус на инпут при открытии
const renameInputEl = ref<HTMLInputElement | null>(null)
watch(renamingField, (v) => {
  if (v) nextTick(() => renameInputEl.value?.select())
})

// ── Autocomplete шрифтов: отдельная search-модель + ref для blur ──────────
// Без этого Vuetify оставляет строку поиска после выбора и не закрывает меню.
const fontSearch = ref('')
const fontAC = ref<any>(null)

// Есть ли выбранный элемент — для disabled-состояния контролов
const hasSelection = computed(() => !!selectedElement.value)
const isText = computed(() => selectedElement.value?.type === 'text')
const isBarcode = computed(() => selectedElement.value?.type === 'barcode')
const isImage = computed(() => selectedElement.value?.type === 'image')

// ── Handlers ──────────────────────────────────────────────────────────────
function onTextInput(value: string) {
  if (isText.value) selectedElement.value!.props.customText = value
}

async function onFontChange(value: string) {
  // Сбрасываем строку поиска и закрываем меню — без этого Vuetify
  // оставляет autocomplete в "полуоткрытом" состоянии после выбора.
  fontSearch.value = ''
  await nextTick()
  fontAC.value?.blur()

  if (!value || !isText.value) return
  await ensureFontFace(value)
  selectedElement.value!.props.fontFamily = value
}

function toggleBold() {
  if (isText.value) selectedElement.value!.props.bold = !selectedElement.value!.props.bold
}

function setAlign(v: 'left' | 'center' | 'right') {
  if (isText.value) selectedElement.value!.props.align = v
}

function setVAlign(v: 'top' | 'middle' | 'bottom') {
  if (isText.value) selectedElement.value!.props.verticalAlign = v
}

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
    const buf = await filesystem.readBinaryFile(path)
    el.props.src = `data:image/svg+xml;base64,${btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))}`
  } else {
    const buf = await filesystem.readBinaryFile(path)
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    el.props.src = `data:${mime};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`
  }
}
</script>

<template>
  <!--
    Ribbon — фиксированная высота 46px, всегда в DOM, не прыгает.
    Разместить над LabelCanvas: <ElementPropsPanel /> <LabelCanvas />
  -->
  <div class="ribbon-root" :class="{ 'ribbon-root--idle': !hasSelection }">
    <div class="ribbon-row">
      <!-- ══ БЕЗ ВЫБОРА: подсказка ════════════════════════════════════════ -->
      <template v-if="!hasSelection">
        <v-icon size="14" color="#c0c0c0">mdi-cursor-default-click-outline</v-icon>
        <span class="ribbon-idle-hint">Выберите элемент на макете</span>
      </template>

      <!-- ══ ТЕКСТ ══════════════════════════════════════════════════════════ -->
      <template v-else-if="isText">
        <!-- Тип -->
        <div class="ribbon-chip ribbon-chip--text">
          <v-icon size="12">mdi-format-text</v-icon>
          <span>Текст</span>
        </div>
        <div class="ribbon-sep" />

        <!-- Шрифт + размер -->
        <div class="ribbon-group" style="gap: 4px">
          <v-autocomplete
            ref="fontAC"
            v-model="selectedElement!.props.fontFamily"
            v-model:search="fontSearch"
            :items="availableFonts"
            item-title="label"
            item-value="value"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            :loading="fontsLoading"
            class="ribbon-font-select"
            @update:model-value="onFontChange"
          >
            <template #item="{ item, props: ip }">
              <v-list-item v-bind="ip" :title="undefined" min-height="32">
                <img
                  v-if="item.raw.svgPreviewPath"
                  :src="`http://127.0.0.1:8080${item.raw.svgPreviewPath}`"
                  :alt="item.raw.label"
                  style="
                    height: 26px;
                    max-width: 200px;
                    object-fit: contain;
                    display: block;
                    padding: 2px 0;
                  "
                />
                <span v-else style="font-size: 14px">{{ item.raw.label }}</span>
              </v-list-item>
            </template>
            <template #selection="{ item }">
              <span class="ribbon-font-label">{{ item.raw.label }}</span>
            </template>
          </v-autocomplete>

          <div class="ribbon-spinbox" style="width: 62px">
            <input
              v-model.number="selectedElement!.props.fontSize"
              type="number"
              min="4"
              max="999"
              class="ribbon-spinbox-input"
              title="Размер шрифта (px)"
            />
            <span class="ribbon-spinbox-unit">px</span>
          </div>
        </div>

        <div class="ribbon-sep" />

        <!-- Bold -->
        <div class="ribbon-group">
          <v-tooltip text="Жирный" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="['rbn-btn', { 'rbn-btn--active': selectedElement!.props.bold }]"
                style="font-weight: 700; font-size: 14px; font-family: serif; min-width: 28px"
                @click="toggleBold"
              >
                B
              </button>
            </template>
          </v-tooltip>
        </div>

        <div class="ribbon-sep" />

        <!-- Горизонтальное выравнивание -->
        <div class="ribbon-group">
          <v-tooltip text="По левому краю" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  { 'rbn-btn--active': (selectedElement!.props.align ?? 'left') === 'left' }
                ]"
                @click="setAlign('left')"
              >
                <v-icon size="16">mdi-format-align-left</v-icon>
              </button>
            </template>
          </v-tooltip>
          <v-tooltip text="По центру" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  { 'rbn-btn--active': selectedElement!.props.align === 'center' }
                ]"
                @click="setAlign('center')"
              >
                <v-icon size="16">mdi-format-align-center</v-icon>
              </button>
            </template>
          </v-tooltip>
          <v-tooltip text="По правому краю" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  { 'rbn-btn--active': selectedElement!.props.align === 'right' }
                ]"
                @click="setAlign('right')"
              >
                <v-icon size="16">mdi-format-align-right</v-icon>
              </button>
            </template>
          </v-tooltip>
        </div>

        <div class="ribbon-sep" />

        <!-- Вертикальное выравнивание -->
        <div class="ribbon-group">
          <v-tooltip text="К верхнему краю" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  { 'rbn-btn--active': selectedElement!.props.verticalAlign === 'top' }
                ]"
                @click="setVAlign('top')"
              >
                <v-icon size="16">mdi-format-vertical-align-top</v-icon>
              </button>
            </template>
          </v-tooltip>
          <v-tooltip text="По вертикали: по центру" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  {
                    'rbn-btn--active':
                      (selectedElement!.props.verticalAlign ?? 'middle') === 'middle'
                  }
                ]"
                @click="setVAlign('middle')"
              >
                <v-icon size="16">mdi-format-vertical-align-center</v-icon>
              </button>
            </template>
          </v-tooltip>
          <v-tooltip text="К нижнему краю" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="[
                  'rbn-btn',
                  { 'rbn-btn--active': selectedElement!.props.verticalAlign === 'bottom' }
                ]"
                @click="setVAlign('bottom')"
              >
                <v-icon size="16">mdi-format-vertical-align-bottom</v-icon>
              </button>
            </template>
          </v-tooltip>
        </div>

        <div class="ribbon-sep" />

        <!-- Межстрочный -->
        <div class="ribbon-group" style="gap: 5px">
          <v-tooltip text="Межстрочный интервал" location="bottom">
            <template #activator="{ props: tp }">
              <v-icon v-bind="tp" size="15" color="#666">mdi-format-line-spacing</v-icon>
            </template>
          </v-tooltip>
          <div class="ribbon-spinbox" style="width: 54px">
            <input
              v-model.number="selectedElement!.props.lineHeight"
              type="number"
              step="0.1"
              min="0.5"
              max="5"
              class="ribbon-spinbox-input"
              title="Межстрочный интервал"
            />
          </div>
        </div>

        <div class="ribbon-sep" />

        <!-- Отступы -->
        <div class="ribbon-group" style="gap: 5px">
          <v-tooltip text="Горизонтальный отступ (px)" location="bottom">
            <template #activator="{ props: tp }">
              <v-icon v-bind="tp" size="15" color="#666">mdi-arrow-expand-horizontal</v-icon>
            </template>
          </v-tooltip>
          <div class="ribbon-spinbox" style="width: 50px">
            <input
              v-model.number="selectedElement!.props.paddingX"
              type="number"
              min="0"
              max="200"
              class="ribbon-spinbox-input"
              title="Отступ X (px)"
            />
            <span class="ribbon-spinbox-unit">px</span>
          </div>
          <v-tooltip text="Вертикальный отступ (px)" location="bottom">
            <template #activator="{ props: tp }">
              <v-icon v-bind="tp" size="15" color="#666">mdi-arrow-expand-vertical</v-icon>
            </template>
          </v-tooltip>
          <div class="ribbon-spinbox" style="width: 50px">
            <input
              v-model.number="selectedElement!.props.paddingY"
              type="number"
              min="0"
              max="200"
              class="ribbon-spinbox-input"
              title="Отступ Y (px)"
            />
            <span class="ribbon-spinbox-unit">px</span>
          </div>
        </div>

        <div class="ribbon-sep" />

        <!-- isSerial: флаг серийного номера -->
        <div class="ribbon-group">
          <v-tooltip
            :text="
              selectedElement!.props.isSerial
                ? 'Убрать: серийный номер'
                : 'Использовать как серийный номер'
            "
            location="bottom"
          >
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="['rbn-btn', { 'rbn-btn--serial': selectedElement!.props.isSerial }]"
                style="gap: 4px; padding: 0 8px; font-size: 11px"
                @click="store.toggleSerial(selectedId!)"
              >
                <v-icon size="14">mdi-pound</v-icon>
                <span>SN</span>
              </button>
            </template>
          </v-tooltip>
        </div>

        <div class="ribbon-sep" />

        <!-- ── Редактировать текст: иконка → попап ─────────────────────── -->
        <v-menu
          v-model="textPopupOpen"
          :close-on-content-click="false"
          location="bottom start"
          offset="6"
        >
          <template #activator="{ props: mp }">
            <v-tooltip text="Редактировать текст" location="bottom">
              <template #activator="{ props: tp }">
                <button
                  v-bind="{ ...mp, ...tp }"
                  :class="['rbn-btn', { 'rbn-btn--active': textPopupOpen }]"
                  style="gap: 4px; padding: 0 8px; font-size: 11px"
                >
                  <v-icon size="14">mdi-pencil-outline</v-icon>
                  <span>Текст</span>
                </button>
              </template>
            </v-tooltip>
          </template>

          <!-- Попап -->
          <div class="text-popup">
            <div class="text-popup__header">
              <v-icon size="13" color="#1565c0">mdi-pencil-outline</v-icon>
              <span>Содержимое блока</span>
              <button class="text-popup__close" @click="textPopupOpen = false">
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
            <textarea
              :value="store.getDisplayText(selectedElement!)"
              class="text-popup__textarea"
              placeholder="Введите текст…"
              rows="4"
              autofocus
              @input="onTextInput(($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </v-menu>
      </template>

      <!-- ══ ШТРИХКОД ════════════════════════════════════════════════════════ -->
      <template v-else-if="isBarcode">
        <div class="ribbon-chip ribbon-chip--barcode">
          <v-icon size="12">mdi-barcode</v-icon>
          <span>Штрихкод</span>
        </div>
        <div class="ribbon-sep" />

        <div class="ribbon-group" style="gap: 6px">
          <v-select
            v-model="selectedElement!.props.barcodeType"
            :items="['code128', 'datamatrix']"
            label="Тип"
            density="compact"
            variant="outlined"
            hide-details
            style="width: 128px"
            @update:model-value="store.updateBarcode(selectedId!)"
          />
          <template v-if="selectedElement!.props.barcodeType === 'code128'">
            <div class="ribbon-spinbox" style="width: 66px">
              <input
                v-model.number="selectedElement!.props.barcodeHeight"
                type="number"
                min="1"
                class="ribbon-spinbox-input"
                title="Высота штрихкода"
                @change="store.updateBarcode(selectedId!)"
              />
              <span class="ribbon-spinbox-unit">h</span>
            </div>
          </template>
          <template v-if="selectedElement!.props.barcodeType === 'datamatrix'">
            <div class="ribbon-spinbox" style="width: 66px">
              <input
                v-model.number="selectedElement!.props.barcodeScale"
                type="number"
                min="1"
                step="1"
                class="ribbon-spinbox-input"
                title="Масштаб"
                @change="store.updateBarcode(selectedId!)"
              />
              <span class="ribbon-spinbox-unit">×</span>
            </div>
          </template>
        </div>

        <div class="ribbon-sep" />

        <div class="ribbon-group" style="gap: 6px">
          <v-icon size="14" color="#888">mdi-pound</v-icon>
          <input
            v-model="selectedElement!.props.testValue"
            class="ribbon-text-input"
            style="width: 160px"
            placeholder="Тестовое значение"
            @input="store.updateBarcode(selectedId!)"
          />
        </div>
      </template>

      <!-- ══ ИЗОБРАЖЕНИЕ ════════════════════════════════════════════════════ -->
      <template v-else-if="isImage">
        <div class="ribbon-chip ribbon-chip--image">
          <v-icon size="12">mdi-image</v-icon>
          <span>Изображение</span>
        </div>
        <div class="ribbon-sep" />

        <div class="ribbon-group" style="gap: 6px; flex: 1; min-width: 0">
          <v-icon size="14" color="#888">mdi-link</v-icon>
          <input
            v-model="selectedElement!.props.src"
            class="ribbon-text-input"
            placeholder="https://… или <svg>…</svg>"
            style="flex: 1; min-width: 160px; max-width: 360px"
          />
          <v-tooltip text="Выбрать файл" location="bottom">
            <template #activator="{ props: tp }">
              <button v-bind="tp" class="rbn-btn" @click="pickImageFile">
                <v-icon size="15">mdi-folder-open-outline</v-icon>
              </button>
            </template>
          </v-tooltip>
        </div>

        <div class="ribbon-sep" />

        <div class="ribbon-group" style="gap: 5px">
          <v-icon size="14" color="#888">mdi-arrow-expand-horizontal</v-icon>
          <div class="ribbon-spinbox" style="width: 70px">
            <input
              v-model.number="selectedElement!.props.imageWidth"
              type="number"
              min="1"
              class="ribbon-spinbox-input"
              title="Ширина (px)"
            />
            <span class="ribbon-spinbox-unit">px</span>
          </div>
        </div>

        <!-- Превью -->
        <div v-if="selectedElement!.props.src" class="ribbon-img-preview">
          <div
            v-if="selectedElement!.props.src?.trimStart().startsWith('<svg')"
            class="ribbon-img-inner"
            v-html="selectedElement!.props.src"
          />
          <img
            v-else
            :src="selectedElement!.props.src"
            class="ribbon-img-inner"
            style="object-fit: contain"
          />
        </div>
      </template>

      <!-- Spacer + переименование + удаление (всегда справа, только при выборе) -->
      <div style="flex: 1" />
      <template v-if="hasSelection">
        <!-- Инлайн-редактор имени поля -->
        <div class="ribbon-rename-wrap" @keydown.esc="cancelRename">
          <!-- Режим просмотра: клик на бейдж → редактирование -->
          <v-tooltip v-if="!renamingField" text="Переименовать поле" location="bottom">
            <template #activator="{ props: tp }">
              <span
                v-bind="tp"
                class="ribbon-field-name ribbon-field-name--clickable"
                @click="startRename"
                >{{ selectedElement!.dataField }}</span
              >
            </template>
          </v-tooltip>
          <!-- Режим редактирования -->
          <div v-else class="ribbon-rename-editor">
            <input
              ref="renameInputEl"
              v-model="renameInput"
              class="ribbon-rename-input"
              @keydown.enter="commitRename"
              @keydown.esc="cancelRename"
              @blur="commitRename"
            />
            <span class="ribbon-rename-suffix">{{
              splitDataField(selectedElement!.dataField).suffix
            }}</span>
          </div>
        </div>

        <div class="ribbon-sep" style="margin: 0 4px" />

        <v-tooltip text="Удалить элемент" location="bottom">
          <template #activator="{ props: tp }">
            <button
              v-bind="tp"
              class="rbn-btn rbn-btn--danger"
              @click="store.removeElement(selectedId!)"
            >
              <v-icon size="15">mdi-delete-outline</v-icon>
            </button>
          </template>
        </v-tooltip>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   Ribbon — фиксированная высота, всегда видима
═══════════════════════════════════════════════════════════════════════════ */
.ribbon-root {
  width: 100%;
  height: 46px; /* ФИКСИРОВАННАЯ высота — макет не прыгает */
  flex-shrink: 0;
  background: linear-gradient(180deg, #f8f8f8 0%, #eeeeee 100%);
  border-bottom: 1px solid #c0c0c0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.09);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
  user-select: none;
  transition: opacity 0.15s;
}
/* В idle-состоянии слегка тусклее, но геометрия та же */
.ribbon-root--idle {
  opacity: 0.7;
}

.ribbon-row {
  display: flex;
  align-items: center;
  height: 100%;
  padding: 0 10px;
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.ribbon-row::-webkit-scrollbar {
  display: none;
}

/* ── Подсказка в idle ───────────────────────────────────────────────────── */
.ribbon-idle-hint {
  font-size: 12px;
  color: #b8b8b8;
  font-style: italic;
  padding-left: 6px;
}

/* ── Чип типа элемента ──────────────────────────────────────────────────── */
.ribbon-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
  letter-spacing: 0.1px;
}
.ribbon-chip--text {
  color: #1565c0;
  background: #e8f0fe;
}
.ribbon-chip--barcode {
  color: #e65100;
  background: #fff3e0;
}
.ribbon-chip--image {
  color: #2e7d32;
  background: #e8f5e9;
}

/* ── Разделитель ────────────────────────────────────────────────────────── */
.ribbon-sep {
  width: 1px;
  height: 26px;
  background: #c4c4c4;
  margin: 0 5px;
  flex-shrink: 0;
}

/* ── Группа контролов ───────────────────────────────────────────────────── */
.ribbon-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

/* ── Кнопка риббона ─────────────────────────────────────────────────────── */
.rbn-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 5px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  color: #222;
  line-height: 1;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  outline: none;
}
.rbn-btn:hover {
  background: #dce8f8;
  border-color: #a8c4e0;
}
.rbn-btn--active {
  background: #ccdff5;
  border-color: #5a96cc;
  color: #0d47a1;
}
.rbn-btn--active:hover {
  background: #bad3f0;
}
.rbn-btn--danger:hover {
  background: #fde8e8;
  border-color: #f0b0b0;
  color: #c62828;
}

/* ── Autocomplete шрифтов ───────────────────────────────────────────────── */
.ribbon-font-select {
  width: 172px;
  flex-shrink: 0;
}
.ribbon-font-select :deep(.v-field) {
  font-size: 12px;
  height: 28px;
  border-radius: 3px;
  background: #fff;
}
.ribbon-font-select :deep(.v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: unset;
  font-size: 12px;
}
.ribbon-font-select :deep(.v-field__outline__start),
.ribbon-font-select :deep(.v-field__outline__end),
.ribbon-font-select :deep(.v-field__outline__notch) {
  border-color: #bbb !important;
}
.ribbon-font-label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

/* ── Спиннер ────────────────────────────────────────────────────────────── */
.ribbon-spinbox {
  display: inline-flex;
  align-items: center;
  height: 28px;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}
.ribbon-spinbox:focus-within {
  border-color: #5a96cc;
}
.ribbon-spinbox-input {
  flex: 1;
  width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  padding: 0 3px 0 5px;
  color: #222;
  text-align: right;
  -moz-appearance: textfield;
}
.ribbon-spinbox-input::-webkit-inner-spin-button,
.ribbon-spinbox-input::-webkit-outer-spin-button {
  opacity: 0.35;
  margin-right: 1px;
}
.ribbon-spinbox-unit {
  font-size: 10px;
  color: #999;
  padding: 0 4px 0 1px;
  white-space: nowrap;
  pointer-events: none;
  flex-shrink: 0;
}

/* ── Текстовый инпут (barcode / image URL) ──────────────────────────────── */
.ribbon-text-input {
  height: 28px;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #fff;
  padding: 0 8px;
  font-size: 12px;
  font-family: inherit;
  color: #222;
  outline: none;
  transition: border-color 0.1s;
}
.ribbon-text-input:focus {
  border-color: #5a96cc;
}
.ribbon-text-input::placeholder {
  color: #c0c0c0;
}

/* ── Имя поля ───────────────────────────────────────────────────────────── */
.ribbon-field-name {
  font-size: 10px;
  color: #b0b0b0;
  padding: 2px 6px;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
  background: #f0f0f0;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
}

/* ── Превью изображения ─────────────────────────────────────────────────── */
.ribbon-img-preview {
  height: 34px;
  width: 44px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: #fafafa;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  margin: 0 4px;
}
.ribbon-img-inner {
  max-width: 100%;
  max-height: 100%;
}

/* ── Попап редактирования текста ─────────────────────────────────────────── */
.text-popup {
  width: 280px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  border: 1px solid #d0d0d0;
  overflow: hidden;
  font-family: 'Segoe UI', system-ui, sans-serif;
}
.text-popup__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: linear-gradient(180deg, #f0f4fb 0%, #e8eef8 100%);
  border-bottom: 1px solid #d4ddf0;
  font-size: 12px;
  font-weight: 600;
  color: #1565c0;
}
.text-popup__close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  color: #888;
  transition:
    background 0.1s,
    color 0.1s;
}
.text-popup__close:hover {
  background: #fde8e8;
  color: #c62828;
}
.text-popup__textarea {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  min-height: 90px;
  border: none;
  outline: none;
  resize: vertical;
  font-size: 13px;
  font-family: inherit;
  color: #222;
  line-height: 1.5;
  background: #fff;
}
.text-popup__textarea::placeholder {
  color: #ccc;
}

/* ── Serial-флаг ────────────────────────────────────────────────────────────── */
.rbn-btn--serial {
  background: #fff3e0;
  border-color: #ffb74d;
  color: #e65100;
  font-weight: 600;
}
.rbn-btn--serial:hover {
  background: #ffe0b2;
  border-color: #fb8c00;
}

/* ── Инлайн-переименование поля ─────────────────────────────────────────────── */
.ribbon-field-name--clickable {
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s;
}
.ribbon-field-name--clickable:hover {
  background: #e8eef8;
  border-color: #aac4e8;
  color: #1565c0;
}
.ribbon-rename-wrap {
  display: flex;
  align-items: center;
}
.ribbon-rename-editor {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border: 1px solid #5a96cc;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
}
.ribbon-rename-input {
  height: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-size: 11px;
  font-family: 'Consolas', monospace;
  padding: 0 4px;
  color: #1565c0;
  min-width: 60px;
  max-width: 120px;
}
.ribbon-rename-suffix {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: #999;
  padding: 0 5px 0 0;
  white-space: nowrap;
  pointer-events: none;
}
</style>
