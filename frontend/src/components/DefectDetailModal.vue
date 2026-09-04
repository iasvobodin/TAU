<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'
import DefectClassification from './DefectClassification.vue'
import DefectWorkflow from './DefectWorkflow.vue'
import DefectHistory from './DefectHistory.vue'
import DefectAttachments from './DefectAttachments.vue'
import { fetchDefectHistory } from '@/api/defectHistoryServices'

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

// Локальное состояние
const currentTab = ref('info') // info, workflow, history, attachments
// Ключ для перезагрузки истории при каждом открытии вкладки «История»
const historyReloadKey = ref(0)
const defectClassification = ref<{
  type: 'fixable' | 'non-fixable' | null
  source: 'production' | 'supplier' | null
}>({
  type: null,
  source: null
})

const workflowState = ref({
  currentStep: '',
  completedSteps: [] as string[],
  yandexTrackerTask: null as string | null,
  oneC_writeOff: null as { date: string; documentNumber: string } | null,
  replacementSN: null as string | null,
  claimAct: null as { number: string; date: string; sent: boolean } | null,
  supplierResponse: null as { received: boolean; date?: string; accepted?: boolean } | null
})

// После существующих ref добавь:
const hasUnsavedChanges = ref(false)
const showCloseConfirmDialog = ref(false)
const isSaving = ref(false)

// Функция для отслеживания изменений
function markAsChanged() {
  hasUnsavedChanges.value = true
}

// Функция сохранения всех изменений
async function saveAllChanges() {
  isSaving.value = true

  try {
    // TODO: Собираем все изменения и отправляем на сервер
    console.log('Сохранение изменений:', {
      defectId: props.defect?.id,
      classification: defectClassification.value,
      workflow: workflowState.value
      // добавь сюда всё что может измениться
    })

    // TODO: API вызов
    // await api.updateDefect(defect.id, allChanges)

    // Успех
    hasUnsavedChanges.value = false
    // Можно показать уведомление об успехе
  } catch (error) {
    console.error('Ошибка сохранения:', error)
    // Показать ошибку пользователю
  } finally {
    isSaving.value = false
  }
}

// Обработчик закрытия с проверкой
function handleClose() {
  if (hasUnsavedChanges.value) {
    showCloseConfirmDialog.value = true
  } else {
    closeDialog()
  }
}

// Закрыть без сохранения
function closeWithoutSaving() {
  hasUnsavedChanges.value = false
  showCloseConfirmDialog.value = false
  closeDialog()
}

// Сохранить и закрыть
async function saveAndClose() {
  await saveAllChanges()
  if (!hasUnsavedChanges.value) {
    // если сохранение успешно
    showCloseConfirmDialog.value = false
    closeDialog()
  }
}

watch(
  () => props.defect,
  (newDefect) => {
    if (newDefect) {
      // Загрузка данных классификации и workflow из API
      loadDefectDetails(newDefect.id)
    }
  }
  // { immediate: true }
)

// При переключении на вкладку «История» запрашиваем свежие данные
watch(currentTab, (tab) => {
  if (tab === 'history') {
    historyReloadKey.value++
  }
})
async function updateInfo(id: number) {}
async function loadDefectDetails(defectId: number) {
  const response = await fetchDefectHistory(defectId)
  // TODO: Загрузка с сервера
  // const response = await api.getDefectDetails(defectId)
  if (response.data?.defectSource) {
  }
  defectClassification.value.source =
    response.data?.defectSource === 'production' || response.data?.defectSource === 'supplier'
      ? response.data.defectSource
      : null

  defectClassification.value.type =
    response.data?.defectType === 'fixable' || response.data?.defectType === 'non-fixable'
      ? response.data.defectType
      : null

  // workflowState.value = response.workflow
}

function formatDate(value: Date | string): string {
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

function getStatusColor(status: string): string {
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

async function downloadReport() {
  // TODO: Генерация PDF отчёта
  console.log('Downloading report for defect:', props.defect?.id)
}

function closeDialog() {
  internalDialog.value = false
  currentTab.value = 'info'
}

async function handleRejectDefect(comment: string) {
  if (!props.defect) return

  // TODO: API вызов для отклонения брака
  // await api.rejectDefect(props.defect.id, {
  //   actionType: 'RejectDefect',
  //   status: 'rejected',
  //   description: comment,
  //   user: 'Текущий пользователь' // получи из контекста/store
  // })

  console.log('Брак отклонён:', comment)

  // Обновляем локальный статус
  if (props.defect) {
    const updatedDefect = {
      ...props.defect,
      status: 'rejected'
    }
    emit('update:defect', updatedDefect)
  }

  // Закрываем модалку
  closeDialog()
}
</script>

<template>
  <v-dialog v-model="internalDialog" max-width="1200" scrollable persistent>
    <v-card v-if="defect">
      <!-- Заголовок -->
      <v-card-title class="d-flex align-center justify-space-between bg-primary">
        <div>
          <div class="text-h6">
            <v-icon class="mr-2">mdi-alert-circle</v-icon>
            Брак #{{ defect.id }}
          </div>
          <div class="text-caption mt-1">SN: {{ defect.component.snComponent }}</div>
        </div>
        <div class="d-flex align-center gap-2">
          <v-chip :color="getStatusColor(defect.status)" size="small" variant="flat">
            {{ defect.status }}</v-chip
          >
          <v-btn icon variant="text" @click="handleClose">
            <v-icon>mdi-close</v-icon>
          </v-btn>
        </div>
      </v-card-title>

      <!-- Вкладки -->
      <v-tabs v-model="currentTab" bg-color="grey-lighten-4">
        <v-tab value="info">
          <v-icon class="mr-2">mdi-information</v-icon>
          Информация
        </v-tab>
        <v-tab value="workflow">
          <v-icon class="mr-2">mdi-flow-chart</v-icon>
          Процесс обработки
        </v-tab>
        <v-tab value="history">
          <v-icon class="mr-2">mdi-history</v-icon>
          История
        </v-tab>
        <v-tab value="attachments">
          <v-icon class="mr-2">mdi-paperclip</v-icon>
          Вложения
        </v-tab>
      </v-tabs>

      <v-divider />

      <!-- Контент вкладок -->
      <v-card-text class="pa-6" style="min-height: 500px; max-height: 70vh">
        <v-window v-model="currentTab">
          <!-- Вкладка: Информация -->
          <v-window-item value="info">
            <v-row>
              <!-- Основная информация -->
              <!-- В DefectDetailModal.vue замени секцию "Основная информация" на это: -->

              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                    Основная информация
                  </v-card-title>
                  <v-card-text class="pa-0">
                    <v-table density="compact">
                      <tbody>
                        <tr>
                          <td class="text-grey-darken-1" style="width: 50%">
                            <v-icon size="small" class="mr-2">mdi-barcode</v-icon>
                            SN компонента
                          </td>
                          <td class="text-right font-weight-bold">
                            {{ defect.component.snComponent }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-package-variant</v-icon>
                            Part Number
                          </td>
                          <td class="text-right font-weight-bold">
                            {{ defect.component.pnComponent.partNumber }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-text-box</v-icon>
                            Описание компонента
                          </td>
                          <td class="text-right">
                            {{ defect.component.pnComponent.descriptionRU }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-factory</v-icon>
                            Поставщик
                          </td>
                          <td class="text-right">
                            {{ defect.component.supplier }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-file-document-outline</v-icon>
                            Номер инвойса
                          </td>
                          <td class="text-right">
                            {{ defect.component.invoice }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-calendar</v-icon>
                            Дата обнаружения
                          </td>
                          <td class="text-right">
                            {{ formatDate(defect.timestamp) }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-account</v-icon>
                            Пользователь
                          </td>
                          <td class="text-right">
                            {{ defect.user }}
                          </td>
                        </tr>

                        <tr>
                          <td class="text-grey-darken-1">
                            <v-icon size="small" class="mr-2">mdi-tag</v-icon>
                            Тип действия
                          </td>
                          <td class="text-right">
                            {{ defect.actionType }}
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Описание дефекта -->
              <v-col cols="12" md="6">
                <v-card variant="outlined">
                  <v-card-title class="text-subtitle-1 bg-grey-lighten-4">
                    Описание дефекта
                  </v-card-title>
                  <v-card-text>
                    <div class="text-body-2">{{ defect.description || '—' }}</div>
                  </v-card-text>
                </v-card>
              </v-col>

              <!-- Классификация брака -->
              <v-col cols="12">
                <DefectClassification
                  v-model="defectClassification"
                  :defect="defect"
                  @reject-defect="handleRejectDefect"
                />
              </v-col>
            </v-row>
          </v-window-item>

          <!-- Вкладка: Процесс обработки -->
          <v-window-item value="workflow">
            <DefectWorkflow
              :defect="defect"
              :classification="defectClassification"
              :workflow-state="workflowState"
              @update:workflow="workflowState = $event"
            />
          </v-window-item>

          <!-- Вкладка: История -->
          <v-window-item value="history">
            <DefectHistory :component-sn="defect.componentSN" :reload-key="historyReloadKey" />
          </v-window-item>

          <!-- Вкладка: Вложения -->
          <v-window-item value="attachments">
            <DefectAttachments :defect-id="defect.id" />
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-divider />

      <!-- Действия -->
      <v-card-actions class="pa-4">
        <v-btn variant="outlined" prepend-icon="mdi-download" @click="downloadReport">
          Скачать отчёт
        </v-btn>
        <v-spacer />
        <v-btn
          color="success"
          prepend-icon="mdi-content-save"
          :loading="isSaving"
          :disabled="!hasUnsavedChanges"
          @click="saveAllChanges"
        >
          Сохранить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <!-- Диалог подтверждения закрытия -->
  <v-dialog v-model="showCloseConfirmDialog" max-width="400">
    <v-card>
      <v-card-title class="bg-warning-lighten-4">
        <v-icon class="mr-2">mdi-alert</v-icon>
        Несохранённые изменения
      </v-card-title>
      <v-card-text class="pt-4">
        У вас есть несохранённые изменения. Что вы хотите сделать?
      </v-card-text>
      <v-card-actions>
        <v-btn @click="showCloseConfirmDialog = false"> Отмена </v-btn>
        <v-spacer />
        <v-btn color="red" variant="text" @click="closeWithoutSaving"> Не сохранять </v-btn>
        <v-btn color="success" @click="saveAndClose" :loading="isSaving"> Сохранить </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
