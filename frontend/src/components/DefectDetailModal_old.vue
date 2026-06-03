<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'

const props = defineProps<{
  modelValue: boolean
  defect: DefectHistoryWithTypedAction | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:defect': [defect: DefectHistoryWithTypedAction | null]
}>()

const internalDialog = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// Локальное состояние для редактирования
const editMode = ref(false)
const localDescription = ref('')
const localStatus = ref('')
const comment = ref('')
const attachments = ref<File[]>([])

// Статусы для выбора
const statusOptions = [
  { value: 'on_hold', title: 'На удержании', color: 'orange' },
  { value: 'closed', title: 'Закрыт', color: 'green' },
  { value: 'rejected', title: 'Отклонён', color: 'red' }
]

// История изменений (моковая, замени на реальную)
const changeHistory = ref([
  {
    timestamp: new Date(),
    user: 'Иван Иванов',
    action: 'Изменил статус',
    details: 'on_hold → closed'
  }
])

watch(
  () => props.defect,
  (newDefect) => {
    if (newDefect) {
      localDescription.value = newDefect.description || ''
      localStatus.value = newDefect.status || ''
      editMode.value = false
      comment.value = ''
    }
  },
  { immediate: true }
)

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

function getStatusColor(status: string): string {
  const option = statusOptions.find((opt) => opt.value === status)
  return option?.color || 'grey'
}

function getStatusTitle(status: string): string {
  const option = statusOptions.find((opt) => opt.value === status)
  return option?.title || status
}

function toggleEditMode() {
  editMode.value = !editMode.value
  if (!editMode.value) {
    // Сброс при отмене
    if (props.defect) {
      localDescription.value = props.defect.description || ''
      localStatus.value = props.defect.status || ''
    }
  }
}

async function saveChanges() {
  if (!props.defect) return

  // TODO: Отправка изменений на сервер
  console.log('Saving changes:', {
    id: props.defect.id,
    description: localDescription.value,
    status: localStatus.value,
    comment: comment.value,
    attachments: attachments.value
  })

  // Обновление локального объекта (после успешного сохранения на сервере)
  const updatedDefect = {
    ...props.defect,
    description: localDescription.value,
    status: localStatus.value
  }

  emit('update:defect', updatedDefect)
  editMode.value = false
  comment.value = ''
  attachments.value = []

  // TODO: Обновить список в родительском компоненте
}

function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    attachments.value = Array.from(target.files)
  }
}

function removeAttachment(index: number) {
  attachments.value.splice(index, 1)
}

function downloadReport() {
  // TODO: Генерация и скачивание отчёта
  console.log('Downloading report for defect:', props.defect?.id)
}

function closeDialog() {
  internalDialog.value = false
  editMode.value = false
  comment.value = ''
  attachments.value = []
}
</script>

<template>
  <v-dialog v-model="internalDialog" max-width="900" scrollable persistent>
    <v-card v-if="defect">
      <!-- Заголовок -->
      <v-card-title class="d-flex align-center justify-space-between bg-primary">
        <div class="text-h6">
          <v-icon class="mr-2">mdi-alert-circle</v-icon>
          Детали брака
        </div>
        <v-btn icon variant="text" @click="closeDialog">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <!-- Контент -->
      <v-card-text class="pa-6">
        <v-row>
          <!-- Основная информация -->
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                <v-icon class="mr-2" size="small">mdi-information</v-icon>
                Основная информация
              </v-card-title>
              <v-card-text>
                <v-list density="compact">
                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-barcode</v-icon>
                    </template>
                    <v-list-item-title>SN компонента</v-list-item-title>
                    <v-list-item-subtitle class="text-right font-weight-bold">
                      {{ defect.component.snComponent }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-package-variant</v-icon>
                    </template>
                    <v-list-item-title>Part Number</v-list-item-title>
                    <v-list-item-subtitle class="text-right font-weight-bold">
                      {{ defect.component.pnComponent.partNumber }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-factory</v-icon>
                    </template>
                    <v-list-item-title>Поставщик</v-list-item-title>
                    <v-list-item-subtitle class="text-right">
                      {{ defect.component.supplier }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-calendar</v-icon>
                    </template>
                    <v-list-item-title>Дата обнаружения</v-list-item-title>
                    <v-list-item-subtitle class="text-right">
                      {{ formatDate(defect.timestamp) }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-account</v-icon>
                    </template>
                    <v-list-item-title>Пользователь</v-list-item-title>
                    <v-list-item-subtitle class="text-right">
                      {{ defect.user }}
                    </v-list-item-subtitle>
                  </v-list-item>

                  <v-list-item>
                    <template #prepend>
                      <v-icon size="small">mdi-tag</v-icon>
                    </template>
                    <v-list-item-title>Тип действия</v-list-item-title>
                    <v-list-item-subtitle class="text-right">
                      {{ defect.actionType }}
                    </v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Описание и статус -->
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="mb-4">
              <v-card-title class="text-subtitle-1 bg-grey-lighten-4 d-flex justify-space-between">
                <div>
                  <v-icon class="mr-2" size="small">mdi-text</v-icon>
                  Описание и статус
                </div>
                <v-btn
                  v-if="!editMode"
                  size="small"
                  variant="text"
                  @click="toggleEditMode"
                  prepend-icon="mdi-pencil"
                >
                  Редактировать
                </v-btn>
              </v-card-title>
              <v-card-text>
                <!-- Режим просмотра -->
                <template v-if="!editMode">
                  <div class="mb-4">
                    <div class="text-caption text-grey-darken-1 mb-1">Статус</div>
                    <v-chip :color="getStatusColor(defect.status)" size="small" variant="flat">
                      {{ getStatusTitle(defect.status) }}
                    </v-chip>
                  </div>

                  <div>
                    <div class="text-caption text-grey-darken-1 mb-1">Описание дефекта</div>
                    <div class="text-body-2">{{ defect.description || '—' }}</div>
                  </div>
                </template>

                <!-- Режим редактирования -->
                <template v-else>
                  <v-select
                    v-model="localStatus"
                    :items="statusOptions"
                    item-title="title"
                    item-value="value"
                    label="Статус"
                    variant="outlined"
                    density="compact"
                    class="mb-3"
                  >
                    <template #selection="{ item }">
                      <v-chip :color="item.raw.color" size="small" variant="flat">
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-select>

                  <v-textarea
                    v-model="localDescription"
                    label="Описание дефекта"
                    variant="outlined"
                    rows="3"
                    density="compact"
                    class="mb-3"
                  />

                  <v-textarea
                    v-model="comment"
                    label="Комментарий к изменению"
                    variant="outlined"
                    rows="2"
                    density="compact"
                    placeholder="Опишите причину изменения..."
                  />

                  <div class="d-flex gap-2 mt-3">
                    <v-btn color="primary" size="small" @click="saveChanges"> Сохранить </v-btn>
                    <v-btn variant="outlined" size="small" @click="toggleEditMode"> Отмена </v-btn>
                  </div>
                </template>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- История изменений -->
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                <v-icon class="mr-2" size="small">mdi-history</v-icon>
                История изменений
              </v-card-title>
              <v-card-text>
                <v-timeline density="compact" side="end" align="start">
                  <v-timeline-item
                    v-for="(change, index) in changeHistory"
                    :key="index"
                    dot-color="primary"
                    size="x-small"
                  >
                    <template #opposite>
                      <div class="text-caption">{{ formatDate(change.timestamp) }}</div>
                    </template>
                    <div>
                      <div class="text-subtitle-2">{{ change.action }}</div>
                      <div class="text-caption text-grey-darken-1">{{ change.user }}</div>
                      <div class="text-body-2 mt-1">{{ change.details }}</div>
                    </div>
                  </v-timeline-item>
                </v-timeline>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Вложения -->
          <v-col cols="12">
            <v-card variant="outlined">
              <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                <v-icon class="mr-2" size="small">mdi-paperclip</v-icon>
                Вложения
              </v-card-title>
              <v-card-text>
                <v-file-input
                  v-if="editMode"
                  label="Добавить файлы"
                  multiple
                  variant="outlined"
                  density="compact"
                  prepend-icon="mdi-attachment"
                  @change="handleFileUpload"
                />

                <v-list v-if="attachments.length > 0" density="compact">
                  <v-list-item v-for="(file, index) in attachments" :key="index">
                    <template #prepend>
                      <v-icon>mdi-file</v-icon>
                    </template>
                    <v-list-item-title>{{ file.name }}</v-list-item-title>
                    <v-list-item-subtitle
                      >{{ (file.size / 1024).toFixed(2) }} KB</v-list-item-subtitle
                    >
                    <template #append>
                      <v-btn
                        v-if="editMode"
                        icon
                        variant="text"
                        size="small"
                        @click="removeAttachment(index)"
                      >
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </template>
                  </v-list-item>
                </v-list>

                <v-alert v-else type="info" variant="tonal" density="compact">
                  Вложения отсутствуют
                </v-alert>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>

      <v-divider />

      <!-- Действия -->
      <v-card-actions class="pa-4">
        <v-btn variant="outlined" prepend-icon="mdi-download" @click="downloadReport">
          Скачать отчёт
        </v-btn>
        <v-spacer />
        <v-btn color="primary" @click="closeDialog"> Закрыть </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
