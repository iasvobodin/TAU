<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useLabelEditorStore } from '@/stores/labelEditor'
import LabelSizePanel from './label-editor/LabelSizePanel.vue'
import AddElementPanel from './label-editor/AddElementPanel.vue'
import ElementPropsPanel from './label-editor/ElementPropsPanel.vue'
import LabelCanvas from './label-editor/LabelCanvas.vue'
import PrintDataPanel from './label-editor/PrintDataPanel.vue'

const store = useLabelEditorStore()
const { lastSavedPath } = storeToRefs(store)

const menuOpen = ref(false)

const currentFileName = computed(() =>
  lastSavedPath.value ? (lastSavedPath.value.split(/[\\\/]/).pop() ?? null) : null
)

function doAction(fn: () => void) {
  menuOpen.value = false
  fn()
}

// Закрыть меню при клике вне него
function onOutsideClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.tmpl-menu-wrap')) menuOpen.value = false
}
onMounted(() => document.addEventListener('mousedown', onOutsideClick))
onUnmounted(() => document.removeEventListener('mousedown', onOutsideClick))
</script>

<template>
  <div class="app-shell">
    <!-- ══ TITLEBAR ══════════════════════════════════════════════════════════ -->
    <div class="app-titlebar">
      <div class="app-titlebar__logo">
        <v-icon size="16" color="#5a96cc">mdi-label-outline</v-icon>
        <span class="app-titlebar__name">Label Editor</span>
      </div>
      <div class="app-titlebar__divider" />

      <!-- ── Меню "Шаблон" ────────────────────────────────────────────────── -->
      <div class="tmpl-menu-wrap">
        <button
          :class="['tmpl-menu-trigger', { 'tmpl-menu-trigger--open': menuOpen }]"
          @click="menuOpen = !menuOpen"
        >
          <v-icon size="14">mdi-file-document-outline</v-icon>
          <span>Шаблон</span>
          <v-icon size="12" class="tmpl-menu-arrow">mdi-chevron-down</v-icon>
        </button>

        <!-- Dropdown -->
        <transition name="tmpl-drop">
          <div v-if="menuOpen" class="tmpl-dropdown">
            <!-- Текущий файл -->
            <div class="tmpl-current-file">
              <v-icon size="12" :color="currentFileName ? '#4caf50' : '#888'">
                {{ currentFileName ? 'mdi-file-check-outline' : 'mdi-file-outline' }}
              </v-icon>
              <span class="tmpl-current-name">{{ currentFileName ?? 'Не сохранён' }}</span>
            </div>

            <div class="tmpl-sep" />

            <button class="tmpl-item" @click="doAction(store.openTemplate)">
              <v-icon size="14" class="tmpl-item__icon">mdi-folder-open-outline</v-icon>
              <span class="tmpl-item__label">Открыть…</span>
              <span class="tmpl-item__hint">Ctrl+O</span>
            </button>

            <div class="tmpl-sep" />

            <button class="tmpl-item" @click="doAction(store.saveTemplate)">
              <v-icon size="14" class="tmpl-item__icon">mdi-content-save-outline</v-icon>
              <span class="tmpl-item__label">Сохранить</span>
              <span class="tmpl-item__hint">Ctrl+S</span>
            </button>

            <button class="tmpl-item" @click="doAction(store.saveTemplateAs)">
              <v-icon size="14" class="tmpl-item__icon">mdi-content-save-edit-outline</v-icon>
              <span class="tmpl-item__label">Сохранить как…</span>
              <span class="tmpl-item__hint">Ctrl+Shift+S</span>
            </button>

            <div class="tmpl-sep" />

            <button class="tmpl-item tmpl-item--danger" @click="doAction(store.clearTemplate)">
              <v-icon size="14" class="tmpl-item__icon">mdi-file-remove-outline</v-icon>
              <span class="tmpl-item__label">Очистить шаблон</span>
            </button>
          </div>
        </transition>
      </div>
    </div>

    <!-- ══ MAIN AREA ═════════════════════════════════════════════════════════ -->
    <div class="app-main">
      <!-- ── Левая панель ─────────────────────────────────────────────────── -->
      <div class="app-sidebar">
        <div class="sidebar-scroll">
          <LabelSizePanel />
          <div class="sidebar-divider" />
          <AddElementPanel />
        </div>
      </div>

      <!-- ── Рабочая область ──────────────────────────────────────────────── -->
      <div class="app-workspace">
        <!-- Риббон свойств элемента — фиксирован сверху рабочей области -->
        <ElementPropsPanel />

        <!-- Канвас -->
        <div class="canvas-scroll">
          <LabelCanvas />
        </div>

        <!-- Панель печати — внизу -->
        <div class="print-panel">
          <PrintDataPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
/* ── Глобальный сброс скроллбаров ────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: #f0f0f0;
}
::-webkit-scrollbar-thumb {
  background: #c0c0c0;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>

<style scoped>
/* ── Shell ───────────────────────────────────────────────────────────────── */
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #e8ecf0;
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 12px;
  color: #2a2a2a;
}

/* ── Titlebar ────────────────────────────────────────────────────────────── */
.app-titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  flex-shrink: 0;
  background: linear-gradient(180deg, #2c3e50 0%, #243140 100%);
  border-bottom: 1px solid #1a2530;
  padding: 0 10px;
  gap: 0;
  user-select: none;
}

.app-titlebar__logo {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 12px;
}

.app-titlebar__name {
  font-size: 12px;
  font-weight: 600;
  color: #c8d8e8;
  letter-spacing: 0.5px;
}

.app-titlebar__divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 8px;
  flex-shrink: 0;
}

/* ── Template menu ───────────────────────────────────────────────────────── */
.tmpl-menu-wrap {
  position: relative;
}

.tmpl-menu-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  color: #b0c4d8;
  font-size: 12px;
  font-family: inherit;
  font-weight: 500;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
  outline: none;
  user-select: none;
}
.tmpl-menu-trigger:hover,
.tmpl-menu-trigger--open {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.18);
  color: #e8f0f8;
}
.tmpl-menu-trigger--open .tmpl-menu-arrow {
  transform: rotate(180deg);
}
.tmpl-menu-arrow {
  transition: transform 0.15s;
  opacity: 0.7;
}

/* Dropdown panel */
.tmpl-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  background: #ffffff;
  border: 1px solid #c8cdd4;
  border-radius: 5px;
  box-shadow:
    0 6px 20px rgba(0, 0, 0, 0.18),
    0 1px 4px rgba(0, 0, 0, 0.1);
  z-index: 9999;
  overflow: hidden;
  padding: 4px 0;
}

/* Текущий файл вверху дропдауна */
.tmpl-current-file {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px 5px;
  background: #f6f8fa;
}
.tmpl-current-name {
  font-size: 11px;
  font-family: 'Consolas', monospace;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

/* Разделитель */
.tmpl-sep {
  height: 1px;
  background: #eaedf0;
  margin: 3px 0;
}

/* Пункт меню */
.tmpl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  color: #2a2a2a;
  text-align: left;
  transition: background 0.08s;
  outline: none;
}
.tmpl-item:hover {
  background: #e8f0fb;
}
.tmpl-item__icon {
  color: #5a8ab0;
  flex-shrink: 0;
}
.tmpl-item__label {
  flex: 1;
}
.tmpl-item__hint {
  font-size: 10px;
  color: #b0b8c4;
  font-family: 'Consolas', monospace;
  white-space: nowrap;
}

/* Danger item */
.tmpl-item--danger {
  color: #c62828;
}
.tmpl-item--danger .tmpl-item__icon {
  color: #e57373;
}
.tmpl-item--danger:hover {
  background: #fde8e8;
}

/* Анимация */
.tmpl-drop-enter-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}
.tmpl-drop-leave-active {
  transition:
    opacity 0.08s ease,
    transform 0.08s ease;
}
.tmpl-drop-enter-from,
.tmpl-drop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* ── Main ────────────────────────────────────────────────────────────────── */
.app-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
.app-sidebar {
  width: 300px;
  min-width: 300px;
  display: flex;
  flex-direction: column;
  background: #f4f6f8;
  border-right: 1px solid #d4d8de;
  overflow: hidden;
}

.sidebar-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0;
}

.sidebar-divider {
  height: 1px;
  background: #dde0e5;
  margin: 0;
}

/* ── Workspace ───────────────────────────────────────────────────────────── */
.app-workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
  background: #e8ecf0;
}

.canvas-scroll {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

/* ── Print panel ─────────────────────────────────────────────────────────── */
.print-panel {
  border-top: 1px solid #d4d8de;
  background: #f4f6f8;
  overflow-y: auto;
  max-height: 300px;
  flex-shrink: 0;
}
</style>
