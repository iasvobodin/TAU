<script setup lang="ts">
import { onMounted, shallowRef, type Component } from 'vue'
// Импортируй свои компоненты
import LabelEditor from '@/components/LabelEditor.vue'
import DefectsView from '@/components/views/DefectsView.vue'

// 1. Описываем интерфейс мапы, чтобы TS знал, какие ключи допустимы
const componentsMap: Record<string, Component> = {
  labelEditor: LabelEditor,
  defects: DefectsView
}

// 2. Типизируем shallowRef как Component, чтобы <component :is> не ругался
const currentComponent = shallowRef<Component | null>(null)

onMounted(() => {
  const urlParams = new URLSearchParams(window.location.search)
  const view = urlParams.get('view')

  // 3. Проверяем, есть ли такой ключ в нашей мапе
  if (view && view in componentsMap) {
    currentComponent.value = componentsMap[view]
  } else {
    console.warn(`Component "${view}" not found in componentsMap`)
  }
})
</script>

<template>
  <div class="window-container">
    <component :is="currentComponent" v-if="currentComponent" />
    <div v-else>
      <p>Загрузка или компонент не найден...</p>
    </div>
  </div>
</template>

<style scoped>
.window-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
</style>
