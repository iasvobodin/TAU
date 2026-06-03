<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  defectId: number
}>()

const history = ref<
  Array<{
    id: number
    timestamp: Date
    user: string
    action: string
    details: string
    changes?: Record<string, { old: any; new: any }>
  }>
>([])

onMounted(async () => {
  await loadHistory()
})

async function loadHistory() {
  // TODO: Загрузка истории с сервера
  // const response = await api.getDefectHistory(props.defectId)
  // history.value = response

  // Моковые данные
  history.value = [
    {
      id: 1,
      timestamp: new Date(),
      user: 'Иван Иванов',
      action: 'Создание брака',
      details: 'Брак обнаружен на этапе тестирования'
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 3600000),
      user: 'Пётр Петров',
      action: 'Классификация',
      details: 'Установлен тип: Неисправимый, Источник: Брак поставщика',
      changes: {
        type: { old: null, new: 'non-fixable' },
        source: { old: null, new: 'supplier' }
      }
    }
  ]
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(value)
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
      <v-icon class="mr-2" size="small">mdi-history</v-icon>
      История изменений
    </v-card-title>
    <v-card-text>
      <v-timeline density="compact" side="end" align="start">
        <v-timeline-item v-for="item in history" :key="item.id" dot-color="primary" size="x-small">
          <template #opposite>
            <div class="text-caption">{{ formatDate(item.timestamp) }}</div>
          </template>
          <div>
            <div class="text-subtitle-2">{{ item.action }}</div>
            <div class="text-caption text-grey-darken-1">{{ item.user }}</div>
            <div class="text-body-2 mt-1">{{ item.details }}</div>

            <!-- Изменения -->
            <v-card v-if="item.changes" variant="outlined" class="mt-2" density="compact">
              <v-card-text class="pa-2">
                <div v-for="(change, key) in item.changes" :key="key" class="text-caption">
                  <strong>{{ key }}:</strong>
                  <span class="text-red">{{ change.old || '—' }}</span>
                  →
                  <span class="text-green">{{ change.new }}</span>
                </div>
              </v-card-text>
            </v-card>
          </div>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>
  </v-card>
</template>
