<script setup lang="ts">
import { ref, computed, type Ref, onMounted } from 'vue'
import type {
  ActionType,
  ComponentAllPayload,
  DefectHistoryWithTypedAction
} from '@/assets/interfaces'
import DefectDetailModal from './DefectDetailModal.vue'
const props = defineProps<{
  failedComponents: DefectHistoryWithTypedAction[] | null
}>()

const menuFrom = ref(false)
const menuTo = ref(false)
const dateFrom = ref<string | null>(null)
const dateTo = ref<string | null>(null)
const onlyDetectDefect = ref(true)
const minDate = ref<string | null>(null)

// Модальное окно
const detailDialog = ref(false)
const selectedDefect = ref<DefectHistoryWithTypedAction | null>(null)

// Инициализация даты по умолчанию
onMounted(() => {
  const now = new Date()
  dateTo.value = now.toISOString().split('T')[0]

  // Находим минимальную дату в массиве
  if (props.failedComponents?.length) {
    const timestamps = props.failedComponents.map((item) => new Date(item.timestamp))
    const earliest = new Date(Math.min(...timestamps.map((d) => d.getTime())))

    // Ставим minDate на начало месяца earliest
    earliest.setDate(1)
    minDate.value = earliest.toISOString().split('T')[0]

    // Устанавливаем dateFrom на месяц назад или на earliest, если меньше
    const monthAgo = new Date()
    monthAgo.setMonth(now.getMonth() - 1)
    dateFrom.value = monthAgo < earliest ? minDate.value : monthAgo.toISOString().split('T')[0]
  } else {
    // если массив пустой, просто месяц назад
    const monthAgo = new Date()
    monthAgo.setMonth(now.getMonth() - 1)
    dateFrom.value = monthAgo.toISOString().split('T')[0]
  }
})

const preparedItems = computed(() => {
  let source = props.failedComponents ?? []

  if (onlyDetectDefect.value) {
    source = source.filter((item) => item.actionType === 'DetectDefect')
  }

  return source
    .map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }))
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
})

const filteredItems = computed(() => {
  return preparedItems.value.filter((item) => {
    const itemDate = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp)

    if (dateFrom.value) {
      const from = new Date(dateFrom.value)
      if (itemDate < from) return false
    }

    if (dateTo.value) {
      const to = new Date(dateTo.value)
      to.setHours(23, 59, 59, 999)
      if (itemDate > to) return false
    }

    return true
  })
})

const headers = [
  { title: 'Дата', key: 'timestamp' },
  { title: 'SN', key: 'componentSN' },
  { title: 'PN', key: 'partNumber' },
  { title: 'Описание дефекта', key: 'description' },
  { title: 'Статус', key: 'status' },
  { title: 'Пользователь', key: 'user' },
  { title: 'Тип действия', key: 'actionType' },
  { title: '', key: 'actions', sortable: false, width: '80' }
]

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)

  if (isNaN(date.getTime())) return '—'

  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function statusColor(status: string) {
  switch (status) {
    case 'on_hold':
      return 'orange'
    case 'closed':
      return 'green'
    case 'rejected':
      return 'red'
    default:
      return 'grey'
  }
}
function openDefectDetails(item: DefectHistoryWithTypedAction) {
  selectedDefect.value = item
  detailDialog.value = true
}
</script>

<template>
  <v-container fluid>
    <!-- ФИЛЬТР -->
    <v-row class="mb-4" align="center">
      <!-- Дата с -->
      <v-col cols="12" md="3">
        <v-menu
          v-model="menuFrom"
          :close-on-content-click="false"
          transition="scale-transition"
          offset-y
          min-width="290px"
        >
          <template #activator="{ props }">
            <v-text-field
              v-model="dateFrom"
              label="Дата с"
              prepend-icon="mdi-calendar"
              readonly
              v-bind="props"
            />
          </template>

          <v-date-picker
            v-model="dateFrom"
            show-adjacent-months
            @update:model-value="menuFrom = false"
          />
        </v-menu>
      </v-col>

      <!-- Дата по -->
      <v-col cols="12" md="3">
        <v-menu
          v-model="menuTo"
          :close-on-content-click="false"
          transition="scale-transition"
          offset-y
          min-width="290px"
        >
          <template #activator="{ props }">
            <v-text-field
              v-model="dateTo"
              label="Дата по"
              prepend-icon="mdi-calendar"
              readonly
              v-bind="props"
            />
          </template>

          <v-date-picker
            v-model="dateTo"
            show-adjacent-months
            @update:model-value="menuFrom = false"
          />
        </v-menu>
      </v-col>

      <!-- Чекбокс только DetectDefect -->
      <v-col cols="12" md="3" class="d-flex align-center">
        <v-checkbox
          v-model="onlyDetectDefect"
          label="Только DetectDefect"
          density="compact"
          hide-details
        />
      </v-col>
    </v-row>
    <!-- ТАБЛИЦА -->
    <v-data-table
      :headers="headers"
      :items="filteredItems"
      item-value="id"
      class="elevation-2"
      :mobile-breakpoint="960"
      density="comfortable"
    >
      <!-- Дата -->
      <template #item.timestamp="{ item }">
        {{ formatDate(item.timestamp) }}
      </template>

      <!-- PN -->
      <template #item.partNumber="{ item }">
        {{ item.component.pnComponent.partNumber }}
      </template>

      <!-- Поставщик -->
      <!-- <template #item.supplier="{ item }">
        {{ item.component.supplier }}
      </template> -->

      <!-- Статус -->
      <template #item.status="{ item }">
        <v-chip :color="statusColor(item.status)" size="small" variant="flat">
          {{ item.status }}
        </v-chip>
      </template>

      <template #item.actionType="{ item }">
        {{ item.actionType }}
      </template>

      <!-- Кнопка действия -->
      <template #item.actions="{ item }">
        <v-btn icon variant="text" size="small" @click="openDefectDetails(item)" color="primary">
          <v-icon>mdi-arrow-right-circle</v-icon>
        </v-btn>
      </template>

      <!-- Пусто -->
      <template #no-data>
        <v-alert type="info" variant="tonal"> Нет брака за выбранный период </v-alert>
      </template>
    </v-data-table>

    <!-- Модальное окно с деталями -->
    <DefectDetailModal v-model="detailDialog" v-model:defect="selectedDefect" />
  </v-container>
</template>
