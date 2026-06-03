<script setup lang="ts">
import { useLabelEditorStore } from '@/stores/labelEditor'
const store = useLabelEditorStore()
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
</style>
