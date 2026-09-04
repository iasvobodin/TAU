<script setup lang="ts">
import { ref } from 'vue'
import { useLabelEditorStore } from '@/stores/labelEditor'
const store = useLabelEditorStore()

const tableMenuOpen = ref(false)
const tableRows = ref(5)
const tableCols = ref(5)
const cellWidth = ref(17)
const cellHeight = ref(9)

function addTable() {
  store.addTable(tableRows.value, tableCols.value, cellWidth.value, cellHeight.value)
  tableMenuOpen.value = false
}
</script>

<template>
  <div class="ae-root">
    <div class="sp-section-header">
      <v-icon size="11" color="#7a8a9a">mdi-plus-box-outline</v-icon>
      <span>Добавить элемент</span>
    </div>

    <div class="ae-buttons">
      <button
        class="ae-btn ae-btn--text"
        title="Добавить текстовый блок"
        @click="store.addElement('text')"
      >
        <div class="ae-btn__icon">
          <v-icon size="18">mdi-format-text</v-icon>
        </div>
        <span class="ae-btn__label">Текст</span>
      </button>

      <button
        class="ae-btn ae-btn--barcode"
        title="Добавить штрихкод"
        @click="store.addElement('barcode')"
      >
        <div class="ae-btn__icon">
          <v-icon size="18">mdi-barcode</v-icon>
        </div>
        <span class="ae-btn__label">Штрихкод</span>
      </button>

      <button
        class="ae-btn ae-btn--image"
        title="Добавить изображение"
        @click="store.addElement('image')"
      >
        <div class="ae-btn__icon">
          <v-icon size="18">mdi-image-outline</v-icon>
        </div>
        <span class="ae-btn__label">Изображение</span>
      </button>

      <v-menu v-model="tableMenuOpen" location="bottom" offset="6">
        <template #activator="{ props: mp }">
          <button class="ae-btn ae-btn--table" title="Добавить таблицу" v-bind="mp">
            <div class="ae-btn__icon">
              <v-icon size="18">mdi-table</v-icon>
            </div>
            <span class="ae-btn__label">Таблица</span>
          </button>
        </template>

        <div class="table-add-popup">
          <div class="table-add__title">
            <v-icon size="14" color="#6a1b9a">mdi-table</v-icon>
            <span>Новая таблица</span>
          </div>
          <div class="table-add__row">
            <label>
              Строки:
              <input v-model.number="tableRows" type="number" min="1" max="20" class="ta-input" />
            </label>
            <label>
              Столбцы:
              <input v-model.number="tableCols" type="number" min="1" max="20" class="ta-input" />
            </label>
          </div>
          <div class="table-add__row">
            <label>
              Ячейка Ш (мм):
              <input v-model.number="cellWidth" type="number" step="0.5" min="1" class="ta-input" />
            </label>
            <label>
              Ячейка В (мм):
              <input
                v-model.number="cellHeight"
                type="number"
                step="0.5"
                min="1"
                class="ta-input"
              />
            </label>
          </div>
          <button class="table-add__btn" @click="addTable">
            <v-icon size="14">mdi-plus</v-icon>
            Добавить {{ tableRows }}×{{ tableCols }}
          </button>
        </div>
      </v-menu>
    </div>
  </div>
</template>

<style scoped>
.ae-root {
  padding: 8px 10px 10px;
  font-family: 'Segoe UI', system-ui, sans-serif;
}

/* Переиспользуем стиль заголовка секции из LabelSizePanel */
.sp-section-header {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  font-weight: 600;
  color: #7a8a9a;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 0 6px;
}

/* ── Кнопки добавления ───────────────────────────────────────────────────── */
.ae-buttons {
  display: flex;
  gap: 6px;
}

.ae-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: 1;
  height: 54px;
  border: 1px solid #c8cdd4;
  border-radius: 5px;
  background: #fff;
  cursor: pointer;
  transition:
    background 0.1s,
    border-color 0.12s,
    box-shadow 0.1s,
    transform 0.08s;
  outline: none;
  user-select: none;
  padding: 0;
}

.ae-btn:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-1px);
}

.ae-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

/* Иконка */
.ae-btn__icon {
  width: 28px;
  height: 28px;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Подпись */
.ae-btn__label {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.2px;
}

/* ── Варианты ────────────────────────────────────────────────────────────── */
.ae-btn--text {
  color: #1565c0;
}
.ae-btn--text .ae-btn__icon {
  background: #e8f0fe;
}
.ae-btn--text:hover {
  background: #f0f6ff;
  border-color: #90b8e8;
}

.ae-btn--barcode {
  color: #b84c00;
}
.ae-btn--barcode .ae-btn__icon {
  background: #fff3e0;
}
.ae-btn--barcode:hover {
  background: #fff8f0;
  border-color: #f0a060;
}

.ae-btn--image {
  color: #2e7d32;
}
.ae-btn--image .ae-btn__icon {
  background: #e8f5e9;
}
.ae-btn--image:hover {
  background: #f0fbf0;
  border-color: #80c080;
}

.ae-btn--table {
  color: #6a1b9a;
}
.ae-btn--table .ae-btn__icon {
  background: #f3e5f5;
}
.ae-btn--table:hover {
  background: #faf0fc;
  border-color: #ce93d8;
}

/* ── Popup добавления таблицы ──────────────────────────────────────────────── */
.table-add-popup {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
  border: 1px solid #d0d0d0;
  padding: 12px 14px;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 11px;
  color: #333;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.table-add__title {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #6a1b9a;
}
.table-add__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.table-add__row label {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  font-size: 11px;
  color: #555;
}
.ta-input {
  width: 50px;
  height: 26px;
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 0 4px;
  font-size: 11px;
  font-family: inherit;
  color: #222;
  outline: none;
  text-align: right;
  -moz-appearance: textfield;
}
.ta-input:focus {
  border-color: #9c27b0;
}
.ta-input::-webkit-inner-spin-button,
.ta-input::-webkit-outer-spin-button {
  opacity: 0.4;
  margin-right: 1px;
}
.table-add__btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 14px;
  border: 1px solid #6a1b9a;
  border-radius: 4px;
  background: #6a1b9a;
  color: #fff;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
  font-weight: 600;
  transition:
    background 0.1s,
    border-color 0.1s;
  justify-content: center;
}
.table-add__btn:hover {
  background: #8e24aa;
  border-color: #8e24aa;
}
</style>
