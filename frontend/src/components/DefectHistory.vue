<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { fetchDefectHistoryBySN } from '@/api/defectHistoryServices'
import { defectWorkflowMap, type ActionType } from '@/assets/interfaces'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'

const props = defineProps<{
  componentSn: string
  reloadKey?: number
}>()

const history = ref<DefectHistoryWithTypedAction[]>([])
const loading = ref(false)
const loadError = ref('')

// Обратный маппинг: actionType -> название этапа из defectWorkflowMap
const actionStageName = Object.fromEntries(
  Object.entries(defectWorkflowMap).map(([stage, { actionType }]) => [actionType, stage])
) as Record<ActionType, string>

// actionType -> цвет этапа (для точки на таймлайне)
const actionColors = Object.fromEntries(
  Object.entries(defectWorkflowMap).map(([stage, { actionType, color }]) => [actionType, color])
) as Record<ActionType, string>

// Человекочитаемые подписи статусов
const statusMeta: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает обработки', color: 'grey' },
  on_hold: { label: 'В работе', color: 'orange' },
  accepted: { label: 'Принят', color: 'green' },
  closed: { label: 'Закрыт', color: 'green' },
  rejected: { label: 'Отклонён', color: 'red' },
  reopened: { label: 'Переоткрыт', color: 'blue' }
}

async function loadHistory() {
  if (!props.componentSn) {
    history.value = []
    return
  }
  loading.value = true
  loadError.value = ''

  try {
    const response = await fetchDefectHistoryBySN(props.componentSn)
    history.value = (response.data ?? [])
      .slice()
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    if (response.error) {
      loadError.value = response.error
    }
  } catch (error) {
    console.error('Ошибка загрузки истории:', error)
    loadError.value = 'Не удалось загрузить историю'
  } finally {
    loading.value = false
  }
}

watch(() => props.componentSn, loadHistory)

// Перезагрузка по внешнему сигналу (например, при переключении на вкладку)
watch(
  () => props.reloadKey,
  () => {
    if (props.reloadKey !== undefined) loadHistory()
  }
)

onMounted(loadHistory)

function getStageName(actionType: string): string {
  return actionStageName[actionType as ActionType] || actionType
}

function getDotColor(actionType: string): string {
  return actionColors[actionType as ActionType] || '#BDBDBD'
}

function getStatusMeta(status: string) {
  return statusMeta[status] || { label: status || '—', color: 'grey' }
}

function formatDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1 bg-grey-lighten-4 d-flex justify-space-between">
      <div>
        <v-icon class="mr-2" size="small">mdi-history</v-icon>
        История изменений
        <v-chip
          v-if="history.length > 0"
          size="x-small"
          color="primary"
          variant="flat"
          class="ml-2"
        >
          {{ history.length }}
        </v-chip>
      </div>
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="loadHistory"
      >
        Обновить
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="loadError" type="error" variant="tonal" density="compact" class="mb-3">
        {{ loadError }}
      </v-alert>

      <v-progress-linear v-if="loading" indeterminate color="primary" class="mb-3" />

      <v-timeline v-if="history.length > 0" density="compact" side="end" align="start">
        <v-timeline-item
          v-for="entry in history"
          :key="entry.id"
          :dot-color="getDotColor(entry.actionType)"
          size="small"
        >
          <template #opposite>
            <div class="text-caption text-grey-darken-1 text-right">
              {{ formatDate(entry.timestamp) }}
            </div>
          </template>

          <v-card variant="outlined" density="compact" class="mb-1">
            <v-card-text class="pa-3">
              <!-- Заголовок: этап + статус -->
              <div class="d-flex align-center ga-2 flex-wrap">
                <span class="text-subtitle-2 font-weight-bold">
                  {{ getStageName(entry.actionType) }}
                </span>
                <v-chip size="x-small" :color="getStatusMeta(entry.status).color" variant="flat">
                  {{ getStatusMeta(entry.status).label }}
                </v-chip>
              </div>

              <!-- Кто и когда -->
              <div class="text-caption text-grey-darken-1 mt-1 d-flex align-center ga-1">
                <v-icon size="x-small">mdi-account</v-icon>
                <span>{{ entry.user || '—' }}</span>
              </div>

              <!-- Комментарий / описание -->
              <div v-if="entry.description" class="text-body-2 mt-1">
                {{ entry.description }}
              </div>

              <!-- Классификация -->
              <div v-if="entry.defectType || entry.defectSource" class="mt-2 d-flex ga-2 flex-wrap">
                <v-chip
                  v-if="entry.defectType"
                  size="x-small"
                  :color="entry.defectType === 'fixable' ? 'green' : 'red'"
                  variant="outlined"
                >
                  {{ entry.defectType === 'fixable' ? 'Исправимый' : 'Неисправимый' }}
                </v-chip>
                <v-chip
                  v-if="entry.defectSource"
                  size="x-small"
                  :color="entry.defectSource === 'production' ? 'blue' : 'orange'"
                  variant="outlined"
                >
                  {{
                    entry.defectSource === 'production' ? 'Брак производства' : 'Брак поставщика'
                  }}
                </v-chip>
              </div>
            </v-card-text>
          </v-card>
        </v-timeline-item>
      </v-timeline>

      <v-alert v-else-if="!loading" type="info" variant="tonal">
        История для этого брака отсутствует
      </v-alert>
    </v-card-text>
  </v-card>
</template>
