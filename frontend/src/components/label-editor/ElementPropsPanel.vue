<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { os, filesystem } from '@neutralinojs/lib'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { ensureFontFace } from '@/assets/renderToSVG'

const store = useLabelEditorStore()
const { selectedElement, selectedId, availableFonts, fontsLoading, positions } = storeToRefs(store)
const { splitDataField } = store

const selectedPos = computed(() =>
  selectedId.value ? (positions.value[selectedId.value] ?? null) : null
)
function updatePos(field: 'x' | 'y' | 'w' | 'h', raw: string) {
  if (!selectedId.value || !selectedPos.value) return
  const v = parseFloat(raw)
  if (!isNaN(v)) store.updatePosition(selectedId.value, { ...selectedPos.value, [field]: v })
}

const textPopupOpen = ref(false)
const renamingField = ref(false)
const renameInput = ref('')
const renameInputEl = ref<HTMLInputElement | null>(null)

function startRename() {
  if (!selectedElement.value) return
  renameInput.value = splitDataField(selectedElement.value.dataField).prefix
  renamingField.value = true
}
function commitRename() {
  if (selectedId.value && renameInput.value.trim())
    store.renameField(selectedId.value, renameInput.value)
  renamingField.value = false
}
function cancelRename() {
  renamingField.value = false
}
watch(renamingField, (v) => {
  if (v) nextTick(() => renameInputEl.value?.select())
})

const fontSearch = ref('')
const fontAC = ref<any>(null)

const hasSelection = computed(() => !!selectedElement.value)
const isText = computed(() => selectedElement.value?.type === 'text')
const isBarcode = computed(() => selectedElement.value?.type === 'barcode')
const isImage = computed(() => selectedElement.value?.type === 'image')

function onTextInput(v: string) {
  if (isText.value) selectedElement.value!.props.customText = v
}
async function onFontChange(value: string) {
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
      { name: 'SVG', extensions: ['svg'] },
      { name: 'Растр', extensions: ['png', 'jpg', 'jpeg', 'webp'] },
      { name: 'Все файлы', extensions: ['*'] }
    ]
  })
  if (!entries?.length) return
  const path = entries[0]
  const ext = path.split('.').pop()?.toLowerCase()
  const buf = await filesystem.readBinaryFile(path)
  if (ext === 'svg') {
    el.props.src = `data:image/svg+xml;base64,${btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))}`
  } else {
    const mime =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png'
    el.props.src = `data:${mime};base64,${btoa(String.fromCharCode(...new Uint8Array(buf)))}`
  }
}
</script>

<template>
  <!--
    Структура: два ряда.

    Строка 1  .rbn-type      — форматирование (flex, прокрутка если не влезает)
    Строка 2  .rbn-secondary — паддинги + геометрия + хвост
                               grid-template-columns: repeat(auto-fill, minmax(260px, 1fr))
                               на широком экране — одна горизонтальная полоса,
                               на узком — ячейки сами переносятся на следующую строку.
  -->
  <div class="ribbon-root" :class="{ 'ribbon-root--idle': !hasSelection }">
    <!-- ══ Строка 1: тип-специфичные контролы ════════════════════════════ -->
    <div class="rbn-type">
      <!-- Idle -->
      <template v-if="!hasSelection">
        <v-icon size="14" color="#c0c0c0">mdi-cursor-default-click-outline</v-icon>
        <span class="idle-hint">Выберите элемент на макете</span>
      </template>

      <!-- Текст -->
      <template v-else-if="isText">
        <div class="chip chip--text">
          <v-icon size="12">mdi-format-text</v-icon><span>Текст</span>
        </div>
        <div class="sep" />

        <div class="ctrl-group" style="gap: 4px">
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
            class="font-select"
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
              <span class="font-label">{{ item.raw.label }}</span>
            </template>
          </v-autocomplete>

          <div class="spinbox" style="width: 64px">
            <input
              v-model.number="selectedElement!.props.fontSize"
              type="number"
              min="4"
              max="999"
              class="spinbox__in"
              title="Размер шрифта (px)"
            />
            <span class="spinbox__un">px</span>
          </div>
        </div>
        <div class="sep" />

        <div class="ctrl-group">
          <v-tooltip text="Жирный" location="bottom">
            <template #activator="{ props: tp }">
              <button
                v-bind="tp"
                :class="['btn', { 'btn--on': selectedElement!.props.bold }]"
                style="font-weight: 700; font-size: 14px; font-family: serif; min-width: 28px"
                @click="toggleBold"
              >
                B
              </button>
            </template>
          </v-tooltip>
        </div>
        <div class="sep" />

        <div class="ctrl-group">
          <v-tooltip text="По левому краю" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="['btn', { 'btn--on': (selectedElement!.props.align ?? 'left') === 'left' }]"
                @click="setAlign('left')"
              >
                <v-icon size="16">mdi-format-align-left</v-icon>
              </button></template
            ></v-tooltip
          >
          <v-tooltip text="По центру" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="['btn', { 'btn--on': selectedElement!.props.align === 'center' }]"
                @click="setAlign('center')"
              >
                <v-icon size="16">mdi-format-align-center</v-icon>
              </button></template
            ></v-tooltip
          >
          <v-tooltip text="По правому краю" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="['btn', { 'btn--on': selectedElement!.props.align === 'right' }]"
                @click="setAlign('right')"
              >
                <v-icon size="16">mdi-format-align-right</v-icon>
              </button></template
            ></v-tooltip
          >
        </div>
        <div class="sep" />

        <div class="ctrl-group">
          <v-tooltip text="К верхнему краю" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="['btn', { 'btn--on': selectedElement!.props.verticalAlign === 'top' }]"
                @click="setVAlign('top')"
              >
                <v-icon size="16">mdi-format-vertical-align-top</v-icon>
              </button></template
            ></v-tooltip
          >
          <v-tooltip text="По вертикали: по центру" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="[
                  'btn',
                  { 'btn--on': (selectedElement!.props.verticalAlign ?? 'middle') === 'middle' }
                ]"
                @click="setVAlign('middle')"
              >
                <v-icon size="16">mdi-format-vertical-align-center</v-icon>
              </button></template
            ></v-tooltip
          >
          <v-tooltip text="К нижнему краю" location="bottom"
            ><template #activator="{ props: tp }"
              ><button
                v-bind="tp"
                :class="['btn', { 'btn--on': selectedElement!.props.verticalAlign === 'bottom' }]"
                @click="setVAlign('bottom')"
              >
                <v-icon size="16">mdi-format-vertical-align-bottom</v-icon>
              </button></template
            ></v-tooltip
          >
        </div>
        <div class="sep" />

        <div class="ctrl-group" style="gap: 5px">
          <v-tooltip text="Межстрочный интервал" location="bottom">
            <template #activator="{ props: tp }"
              ><v-icon v-bind="tp" size="15" color="#666">mdi-format-line-spacing</v-icon></template
            >
          </v-tooltip>
          <div class="spinbox" style="width: 56px">
            <input
              v-model.number="selectedElement!.props.lineHeight"
              type="number"
              step="0.1"
              min="0.5"
              max="5"
              class="spinbox__in"
              title="Межстрочный интервал"
            />
          </div>
        </div>
        <div class="sep" />

        <div class="ctrl-group">
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
                :class="['btn', 'btn--lbl', { 'btn--serial': selectedElement!.props.isSerial }]"
                @click="store.toggleSerial(selectedId!)"
              >
                <v-icon size="14">mdi-pound</v-icon><span>SN</span>
              </button>
            </template>
          </v-tooltip>
        </div>
        <div class="sep" />

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
                  :class="['btn', 'btn--lbl', { 'btn--on': textPopupOpen }]"
                >
                  <v-icon size="14">mdi-pencil-outline</v-icon><span>Текст</span>
                </button>
              </template>
            </v-tooltip>
          </template>
          <div class="popup">
            <div class="popup__head">
              <v-icon size="13" color="#1565c0">mdi-pencil-outline</v-icon>
              <span>Содержимое блока</span>
              <button class="popup__close" @click="textPopupOpen = false">
                <v-icon size="14">mdi-close</v-icon>
              </button>
            </div>
            <textarea
              :value="store.getDisplayText(selectedElement!)"
              class="popup__body"
              placeholder="Введите текст…"
              rows="4"
              autofocus
              @input="onTextInput(($event.target as HTMLTextAreaElement).value)"
            />
          </div>
        </v-menu>
      </template>

      <!-- Штрихкод -->
      <template v-else-if="isBarcode">
        <div class="chip chip--barcode">
          <v-icon size="12">mdi-barcode</v-icon><span>Штрихкод</span>
        </div>
        <div class="sep" />
        <div class="ctrl-group" style="gap: 6px">
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
          <div
            v-if="selectedElement!.props.barcodeType === 'code128'"
            class="spinbox"
            style="width: 66px"
          >
            <input
              v-model.number="selectedElement!.props.barcodeHeight"
              type="number"
              min="1"
              class="spinbox__in"
              title="Высота штрихкода"
              @change="store.updateBarcode(selectedId!)"
            /><span class="spinbox__un">h</span>
          </div>
          <div
            v-if="selectedElement!.props.barcodeType === 'datamatrix'"
            class="spinbox"
            style="width: 66px"
          >
            <input
              v-model.number="selectedElement!.props.barcodeScale"
              type="number"
              min="1"
              step="1"
              class="spinbox__in"
              title="Масштаб"
              @change="store.updateBarcode(selectedId!)"
            /><span class="spinbox__un">×</span>
          </div>
        </div>
        <div class="sep" />
        <div class="ctrl-group" style="gap: 6px">
          <v-icon size="14" color="#888">mdi-pound</v-icon>
          <input
            v-model="selectedElement!.props.testValue"
            class="text-in"
            style="width: 160px"
            placeholder="Тестовое значение"
            @input="store.updateBarcode(selectedId!)"
          />
        </div>
      </template>

      <!-- Изображение -->
      <template v-else-if="isImage">
        <div class="chip chip--image">
          <v-icon size="12">mdi-image</v-icon><span>Изображение</span>
        </div>
        <div class="sep" />
        <div class="ctrl-group" style="gap: 6px; flex: 1; min-width: 0">
          <v-icon size="14" color="#888">mdi-link</v-icon>
          <input
            v-model="selectedElement!.props.src"
            class="text-in"
            style="flex: 1; min-width: 160px; max-width: 360px"
            placeholder="https://… или <svg>…</svg>"
          />
          <v-tooltip text="Выбрать файл" location="bottom">
            <template #activator="{ props: tp }">
              <button v-bind="tp" class="btn" @click="pickImageFile">
                <v-icon size="15">mdi-folder-open-outline</v-icon>
              </button>
            </template>
          </v-tooltip>
        </div>
        <div class="sep" />
        <div class="ctrl-group" style="gap: 5px">
          <v-icon size="14" color="#888">mdi-arrow-expand-horizontal</v-icon>
          <div class="spinbox" style="width: 70px">
            <input
              v-model.number="selectedElement!.props.imageWidth"
              type="number"
              min="1"
              class="spinbox__in"
              title="Ширина (px)"
            /><span class="spinbox__un">px</span>
          </div>
        </div>
        <div v-if="selectedElement!.props.src" class="img-prev">
          <div
            v-if="selectedElement!.props.src?.trimStart().startsWith('<svg')"
            v-html="selectedElement!.props.src"
            style="max-width: 100%; max-height: 100%"
          />
          <img
            v-else
            :src="selectedElement!.props.src"
            style="max-width: 100%; max-height: 100%; object-fit: contain"
          />
        </div>
      </template>
    </div>
    <!-- /rbn-type -->

    <!-- ══ Строка 2: паддинги + геометрия + хвост ════════════════════════
         repeat(auto-fill, minmax(260px, 1fr)) — ячейки перетекают сами.
         На широком экране — одна строка, на узком — несколько.
    ════════════════════════════════════════════════════════════════════ -->
    <div v-if="hasSelection" class="rbn-secondary">
      <!-- Паддинги (только текст) -->
      <div v-if="isText" class="sec-cell">
        <v-tooltip text="Внутренние отступы блока (мм)" location="bottom">
          <template #activator="{ props: tp }"
            ><v-icon v-bind="tp" size="13" color="#7a8a9a">mdi-crop-square</v-icon></template
          >
        </v-tooltip>
        <div class="spinbox" style="width: 58px">
          <input
            v-model.number="selectedElement!.props.paddingTop"
            type="number"
            step="0.1"
            min="0"
            max="50"
            class="spinbox__in"
            title="Сверху (мм)"
          /><span class="spinbox__un">↑</span>
        </div>
        <div class="spinbox" style="width: 58px">
          <input
            v-model.number="selectedElement!.props.paddingRight"
            type="number"
            step="0.1"
            min="0"
            max="50"
            class="spinbox__in"
            title="Справа (мм)"
          /><span class="spinbox__un">→</span>
        </div>
        <div class="spinbox" style="width: 58px">
          <input
            v-model.number="selectedElement!.props.paddingBottom"
            type="number"
            step="0.1"
            min="0"
            max="50"
            class="spinbox__in"
            title="Снизу (мм)"
          /><span class="spinbox__un">↓</span>
        </div>
        <div class="spinbox" style="width: 58px">
          <input
            v-model.number="selectedElement!.props.paddingLeft"
            type="number"
            step="0.1"
            min="0"
            max="50"
            class="spinbox__in"
            title="Слева (мм)"
          /><span class="spinbox__un">←</span>
        </div>
      </div>

      <!-- Геометрия X / Y / W / H -->
      <div class="sec-cell sec-cell--geo">
        <span class="geo-lbl">X</span>
        <div class="spinbox" style="width: 64px">
          <input
            :value="selectedPos?.x.toFixed(1)"
            type="number"
            step="0.1"
            min="0"
            class="spinbox__in"
            title="Позиция X (мм)"
            @change="updatePos('x', ($event.target as HTMLInputElement).value)"
          /><span class="spinbox__un">мм</span>
        </div>
        <span class="geo-lbl">Y</span>
        <div class="spinbox" style="width: 64px">
          <input
            :value="selectedPos?.y.toFixed(1)"
            type="number"
            step="0.1"
            min="0"
            class="spinbox__in"
            title="Позиция Y (мм)"
            @change="updatePos('y', ($event.target as HTMLInputElement).value)"
          /><span class="spinbox__un">мм</span>
        </div>
        <div class="geo-vsep" />
        <span class="geo-lbl">W</span>
        <div class="spinbox" style="width: 64px">
          <input
            :value="selectedPos?.w.toFixed(1)"
            type="number"
            step="0.1"
            min="0.5"
            class="spinbox__in"
            title="Ширина (мм)"
            @change="updatePos('w', ($event.target as HTMLInputElement).value)"
          /><span class="spinbox__un">мм</span>
        </div>
        <span class="geo-lbl">H</span>
        <div class="spinbox" style="width: 64px">
          <input
            :value="selectedPos?.h.toFixed(1)"
            type="number"
            step="0.1"
            min="0.5"
            class="spinbox__in"
            title="Высота (мм)"
            @change="updatePos('h', ($event.target as HTMLInputElement).value)"
          /><span class="spinbox__un">мм</span>
        </div>
      </div>

      <!-- Хвост: имя поля + удалить -->
      <div class="sec-cell sec-cell--tail" @keydown.esc="cancelRename">
        <v-tooltip v-if="!renamingField" text="Переименовать поле" location="bottom">
          <template #activator="{ props: tp }">
            <span v-bind="tp" class="field-name" @click="startRename">{{
              selectedElement!.dataField
            }}</span>
          </template>
        </v-tooltip>
        <div v-else class="rename-box">
          <input
            ref="renameInputEl"
            v-model="renameInput"
            class="rename-in"
            @keydown.enter="commitRename"
            @keydown.esc="cancelRename"
            @blur="commitRename"
          />
          <span class="rename-sfx">{{ splitDataField(selectedElement!.dataField).suffix }}</span>
        </div>
        <div class="sep" style="margin: 0 4px" />
        <v-tooltip text="Удалить элемент" location="bottom">
          <template #activator="{ props: tp }">
            <button v-bind="tp" class="btn btn--del" @click="store.removeElement(selectedId!)">
              <v-icon size="15">mdi-delete-outline</v-icon>
            </button>
          </template>
        </v-tooltip>
      </div>
    </div>
    <!-- /rbn-secondary -->
  </div>
</template>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════
   Ribbon: два ряда, flex-direction column.
   Строка 1 — всегда 46px.
   Строка 2 — grid с auto-fill; высота определяется содержимым.
══════════════════════════════════════════════════════════════════════════ */
.ribbon-root {
  display: flex;
  flex-direction: column;
  width: 100%;
  flex-shrink: 0;
  background: linear-gradient(180deg, #f8f8f8 0%, #eeeeee 100%);
  border-bottom: 1px solid #c0c0c0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.09);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #2a2a2a;
  user-select: none;
}
.ribbon-root--idle {
  opacity: 0.7;
}

/* ── Строка 1 ─────────────────────────────────────────────────────────────── */
.rbn-type {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 46px;
  padding: 0 10px;
  overflow-x: auto;
  scrollbar-width: none;
  flex-shrink: 0;
}
.rbn-type::-webkit-scrollbar {
  display: none;
}

/* ── Строка 2: auto-fill grid ─────────────────────────────────────────────── */
/*
  minmax(260px, 1fr):
    паддинги  ≈ 280px  → 1 ячейка
    геометрия ≈ 340px  → 1 ячейка (немного шире 260px, но 1fr растянет)
    хвост     ≈ 200px  → 1 ячейка

  На 800px+: все 3 в одну строку.
  На 500px: 1 ячейка в строке → каждый блок на своей строке.
*/
.rbn-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  align-items: center;
  gap: 4px 0;
  padding: 4px 10px;
  border-top: 1px solid #d4d4d4;
  background: linear-gradient(180deg, #f2f2f2 0%, #e9e9e9 100%);
  min-height: 36px;
}

/* Каждая ячейка строки 2 — flex-контейнер */
.sec-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 4px;
  min-height: 28px;
}

/* Геометрия: небольшой визуальный контейнер */
.sec-cell--geo {
  background: #f0f3f8;
  border: 1px solid #dce3ed;
  border-radius: 4px;
  padding: 0 8px;
}

/* Хвост (имя поля + удалить) выравниваем вправо внутри своей ячейки */
.sec-cell--tail {
  justify-content: flex-end;
}

/* ── Общие элементы ───────────────────────────────────────────────────────── */
.idle-hint {
  font-size: 12px;
  color: #b8b8b8;
  font-style: italic;
  padding-left: 6px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.chip--text {
  color: #1565c0;
  background: #e8f0fe;
}
.chip--barcode {
  color: #e65100;
  background: #fff3e0;
}
.chip--image {
  color: #2e7d32;
  background: #e8f5e9;
}

.sep {
  width: 1px;
  height: 26px;
  background: #c4c4c4;
  margin: 0 5px;
  flex-shrink: 0;
}
.rbn-secondary .sep {
  height: 18px;
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.btn {
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
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  outline: none;
  flex-shrink: 0;
}
.btn:hover {
  background: #dce8f8;
  border-color: #a8c4e0;
}
.btn--on {
  background: #ccdff5;
  border-color: #5a96cc;
  color: #0d47a1;
}
.btn--on:hover {
  background: #bad3f0;
}
.btn--lbl {
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
}
.btn--serial {
  background: #fff3e0;
  border-color: #ffb74d;
  color: #e65100;
  font-weight: 600;
}
.btn--serial:hover {
  background: #ffe0b2;
  border-color: #fb8c00;
}
.btn--del:hover {
  background: #fde8e8;
  border-color: #f0b0b0;
  color: #c62828;
}

.font-select {
  width: 172px;
  flex-shrink: 0;
}
.font-select :deep(.v-field) {
  font-size: 12px;
  height: 28px;
  border-radius: 3px;
  background: #fff;
}
.font-select :deep(.v-field__input) {
  padding-top: 2px;
  padding-bottom: 2px;
  min-height: unset;
  font-size: 12px;
}
.font-select :deep(.v-field__outline__start),
.font-select :deep(.v-field__outline__end),
.font-select :deep(.v-field__outline__notch) {
  border-color: #bbb !important;
}
.font-label {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

.spinbox {
  display: inline-flex;
  align-items: center;
  height: 28px;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
  flex-shrink: 0;
}
.rbn-secondary .spinbox {
  height: 24px;
}
.spinbox:focus-within {
  border-color: #5a96cc;
}
.spinbox__in {
  flex: 1;
  width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  font-family: inherit;
  padding: 0 2px 0 6px;
  color: #222;
  text-align: right;
  -moz-appearance: textfield;
}
.spinbox__in::-webkit-inner-spin-button,
.spinbox__in::-webkit-outer-spin-button {
  opacity: 0.4;
  margin-right: 1px;
}
.spinbox__un {
  font-size: 10px;
  color: #999;
  padding: 0 5px 0 1px;
  pointer-events: none;
  flex-shrink: 0;
}

.sec-cell--geo .spinbox {
  border-color: #d0d8e4;
}
.sec-cell--geo .spinbox__un {
  font-size: 9px;
}

.geo-lbl {
  font-size: 10px;
  font-weight: 700;
  color: #7a8a9a;
  min-width: 10px;
  flex-shrink: 0;
}
.geo-vsep {
  width: 1px;
  height: 14px;
  background: #c8d0dc;
  margin: 0 4px;
  flex-shrink: 0;
}

.text-in {
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
.text-in:focus {
  border-color: #5a96cc;
}
.text-in::placeholder {
  color: #c0c0c0;
}

.img-prev {
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

.field-name {
  font-size: 10px;
  color: #b0b0b0;
  padding: 2px 6px;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
  background: #f0f0f0;
  border: 1px solid #e0e0e0;
  border-radius: 3px;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.1s;
}
.field-name:hover {
  background: #e8eef8;
  border-color: #aac4e8;
  color: #1565c0;
}

.rename-box {
  display: inline-flex;
  align-items: center;
  height: 24px;
  border: 1px solid #5a96cc;
  border-radius: 3px;
  background: #fff;
  overflow: hidden;
}
.rename-in {
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
.rename-sfx {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: #999;
  padding: 0 5px 0 0;
  white-space: nowrap;
  pointer-events: none;
}

.popup {
  width: 280px;
  border-radius: 6px;
  background: #fff;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  border: 1px solid #d0d0d0;
  overflow: hidden;
}
.popup__head {
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
.popup__close {
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
.popup__close:hover {
  background: #fde8e8;
  color: #c62828;
}
.popup__body {
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
}
.popup__body::placeholder {
  color: #ccc;
}
</style>
