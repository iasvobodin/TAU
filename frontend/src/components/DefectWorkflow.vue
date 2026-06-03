<script setup lang="ts">
import { ref, computed } from 'vue'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'

const props = defineProps<{
  defect: DefectHistoryWithTypedAction
  classification: {
    type: 'fixable' | 'non-fixable' | null
    source: 'production' | 'supplier' | null
  }
  workflowState: any
}>()

const emit = defineEmits<{
  'update:workflow': [value: any]
}>()

// Локальные состояния для форм
const showYandexTrackerDialog = ref(false)
const showOneCWriteOffDialog = ref(false)
const showReplacementDialog = ref(false)
const showClaimActDialog = ref(false)
const showSupplierResponseDialog = ref(false)

// Формы
const yandexTrackerForm = ref({
  taskNumber: '',
  description: '',
  priority: 'normal'
})

const oneCForm = ref({
  documentNumber: '',
  date: new Date().toISOString().split('T')[0],
  type: 'plastic' // plastic или semifinished
})

const replacementForm = ref({
  newSN: '',
  source: 'reserve', // reserve или supplier
  notes: ''
})

const claimActForm = ref({
  actNumber: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  files: [] as File[]
})

const supplierResponseForm = ref({
  received: false,
  date: '',
  accepted: null as boolean | null,
  comment: ''
})

// Вычисляемые свойства для определения доступных действий
const availableActions = computed(() => {
  const actions: Array<{
    id: string
    title: string
    icon: string
    color: string
    disabled: boolean
  }> = []

  if (!props.classification.type || !props.classification.source) {
    return []
  }

  // Для исправимого брака производства
  if (props.classification.type === 'fixable' && props.classification.source === 'production') {
    actions.push(
      {
        id: 'tau_control',
        title: 'Фиксировать в ТАУ контроль',
        icon: 'mdi-clipboard-check',
        color: 'blue',
        disabled: props.workflowState.completedSteps.includes('tau_control')
      },
      {
        id: 'rework',
        title: 'Отправить на доработку',
        icon: 'mdi-wrench',
        color: 'orange',
        disabled: props.workflowState.completedSteps.includes('rework')
      },
      {
        id: 'return_test',
        title: 'Вернуть на тестирование',
        icon: 'mdi-test-tube',
        color: 'green',
        disabled: !props.workflowState.completedSteps.includes('rework')
      }
    )
  }

  // Для исправимого брака поставщика
  if (props.classification.type === 'fixable' && props.classification.source === 'supplier') {
    actions.push(
      {
        id: 'replace_component',
        title: 'Заменить бракованный компонент',
        icon: 'mdi-swap-horizontal',
        color: 'purple',
        disabled: props.workflowState.completedSteps.includes('replace_component')
      },
      {
        id: 'reassemble',
        title: 'Пересобрать',
        icon: 'mdi-cog-refresh',
        color: 'orange',
        disabled: !props.workflowState.completedSteps.includes('replace_component')
      },
      {
        id: 'writeoff_plastic',
        title: 'Списать брак в 1С (пластик)',
        icon: 'mdi-file-document',
        color: 'red',
        disabled: false
      },
      {
        id: 'calibration',
        title: 'Калибровка/исправление',
        icon: 'mdi-tune',
        color: 'blue',
        disabled: false
      }
    )
  }

  // Для неисправимого брака
  if (props.classification.type === 'non-fixable') {
    actions.push(
      {
        id: 'yandex_tracker',
        title: 'Завести в Яндекс Трекер',
        icon: 'mdi-ticket',
        color: 'blue',
        disabled: !!props.workflowState.yandexTrackerTask
      },
      {
        id: 'writeoff_1c',
        title: 'Списать брак в 1С (полуфабрикат)',
        icon: 'mdi-file-document-remove',
        color: 'red',
        disabled: !!props.workflowState.oneC_writeOff
      },
      {
        id: 'replacement',
        title: 'Замена брака из резерва',
        icon: 'mdi-package-variant',
        color: 'green',
        disabled: !!props.workflowState.replacementSN
      },
      {
        id: 'claim_act',
        title: 'Создать акт рекламации',
        icon: 'mdi-file-alert',
        color: 'orange',
        disabled: !!props.workflowState.claimAct
      },
      {
        id: 'supplier_response',
        title: 'Ответ поставщика',
        icon: 'mdi-email-receive',
        color: 'purple',
        disabled: !props.workflowState.claimAct || props.workflowState.supplierResponse?.received
      }
    )
  }

  // Общие действия
  actions.push(
    {
      id: 'print_act',
      title: 'Распечатать акт',
      icon: 'mdi-printer',
      color: 'grey',
      disabled: false
    },
    {
      id: 'corrective_actions',
      title: 'Корректирующие действия',
      icon: 'mdi-shield-check',
      color: 'teal',
      disabled: false
    },
    {
      id: 'close_report',
      title: 'Отчёт и закрытие',
      icon: 'mdi-file-check',
      color: 'green',
      disabled: props.defect.status === 'closed'
    }
  )

  return actions
})

// Обработчики действий
async function handleAction(actionId: string) {
  switch (actionId) {
    case 'yandex_tracker':
      showYandexTrackerDialog.value = true
      break
    case 'writeoff_1c':
    case 'writeoff_plastic':
      showOneCWriteOffDialog.value = true
      oneCForm.value.type = actionId === 'writeoff_plastic' ? 'plastic' : 'semifinished'
      break
    case 'replacement':
    case 'replace_component':
      showReplacementDialog.value = true
      break
    case 'claim_act':
      showClaimActDialog.value = true
      break
    case 'supplier_response':
      showSupplierResponseDialog.value = true
      break
    case 'tau_control':
      await markStepCompleted('tau_control')
      break
    case 'rework':
      await markStepCompleted('rework')
      break
    case 'reassemble':
      await markStepCompleted('reassemble')
      break
    case 'return_test':
      await markStepCompleted('return_test')
      break
    case 'calibration':
      await markStepCompleted('calibration')
      break
    case 'print_act':
      printAct()
      break
    case 'corrective_actions':
      // TODO: Открыть модальное окно для корректирующих действий
      break
    case 'close_report':
      closeDefect()
      break
  }
}

async function markStepCompleted(step: string) {
  const newState = { ...props.workflowState }
  if (!newState.completedSteps.includes(step)) {
    newState.completedSteps.push(step)
  }
  emit('update:workflow', newState)

  // TODO: Сохранение на сервере
  // await api.updateWorkflowStep(props.defect.id, step)
}

async function createYandexTrackerTask() {
  // TODO: Интеграция с Яндекс Трекером API
  const newState = { ...props.workflowState }
  newState.yandexTrackerTask = yandexTrackerForm.value.taskNumber
  emit('update:workflow', newState)
  showYandexTrackerDialog.value = false
}

async function createOneCWriteOff() {
  // TODO: Интеграция с 1С API
  const newState = { ...props.workflowState }
  newState.oneC_writeOff = {
    date: oneCForm.value.date,
    documentNumber: oneCForm.value.documentNumber
  }
  emit('update:workflow', newState)
  showOneCWriteOffDialog.value = false
}

async function createReplacement() {
  const newState = { ...props.workflowState }
  newState.replacementSN = replacementForm.value.newSN
  emit('update:workflow', newState)
  showReplacementDialog.value = false
}

async function createClaimAct() {
  // TODO: Генерация акта рекламации и отправка поставщику
  const newState = { ...props.workflowState }
  newState.claimAct = {
    number: claimActForm.value.actNumber,
    date: claimActForm.value.date,
    sent: true
  }
  emit('update:workflow', newState)
  showClaimActDialog.value = false
}

async function saveSupplierResponse() {
  const newState = { ...props.workflowState }
  newState.supplierResponse = {
    received: true,
    date: supplierResponseForm.value.date,
    accepted: supplierResponseForm.value.accepted
  }
  emit('update:workflow', newState)
  showSupplierResponseDialog.value = false
}

function printAct() {
  // TODO: Открыть окно печати акта
  window.print()
}

async function closeDefect() {
  // TODO: Закрытие дефекта
  console.log('Closing defect:', props.defect.id)
}
</script>

<template>
  <div>
    <!-- Предупреждение если не классифицирован -->
    <v-alert v-if="!classification.type || !classification.source" type="warning" variant="tonal">
      Сначала необходимо классифицировать брак на вкладке "Информация"
    </v-alert>

    <!-- Текущий статус workflow -->
    <v-card v-if="classification.type && classification.source" variant="outlined" class="mb-4">
      <v-card-title class="text-subtitle-1 bg-grey-lighten-4"> Текущий процесс </v-card-title>
      <v-card-text>
        <v-chip
          :color="classification.type === 'fixable' ? 'green' : 'red'"
          class="mr-2"
          size="small"
        >
          {{ classification.type === 'fixable' ? 'Исправимый' : 'Неисправимый' }}
        </v-chip>
        <v-chip :color="classification.source === 'production' ? 'blue' : 'orange'" size="small">
          {{ classification.source === 'production' ? 'Брак производства' : 'Брак поставщика' }}
        </v-chip>

        <!-- Индикаторы выполненных шагов -->
        <div v-if="workflowState.completedSteps.length > 0" class="mt-3">
          <div class="text-caption text-grey-darken-1 mb-2">Выполненные шаги:</div>
          <v-chip
            v-for="step in workflowState.completedSteps"
            :key="step"
            size="x-small"
            color="green"
            variant="outlined"
            class="mr-1 mb-1"
          >
            {{ step }}
          </v-chip>
        </div>

        <!-- Дополнительная информация -->
        <v-list v-if="classification.type === 'non-fixable'" density="compact" class="mt-3">
          <v-list-item v-if="workflowState.yandexTrackerTask">
            <template #prepend>
              <v-icon color="blue" size="small">mdi-ticket</v-icon>
            </template>
            <v-list-item-title>Задача в Яндекс Трекере</v-list-item-title>
            <v-list-item-subtitle>{{ workflowState.yandexTrackerTask }}</v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="workflowState.oneC_writeOff">
            <template #prepend>
              <v-icon color="red" size="small">mdi-file-document</v-icon>
            </template>
            <v-list-item-title>Списано в 1С</v-list-item-title>
            <v-list-item-subtitle>
              {{ workflowState.oneC_writeOff.documentNumber }} от
              {{ workflowState.oneC_writeOff.date }}
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="workflowState.replacementSN">
            <template #prepend>
              <v-icon color="green" size="small">mdi-package-variant</v-icon>
            </template>
            <v-list-item-title>Замена из резерва</v-list-item-title>
            <v-list-item-subtitle>SN: {{ workflowState.replacementSN }}</v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="workflowState.claimAct">
            <template #prepend>
              <v-icon color="orange" size="small">mdi-file-alert</v-icon>
            </template>
            <v-list-item-title>Акт рекламации</v-list-item-title>
            <v-list-item-subtitle>
              {{ workflowState.claimAct.number }} от {{ workflowState.claimAct.date }}
              <v-chip v-if="workflowState.claimAct.sent" size="x-small" color="green" class="ml-2">
                Отправлен
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="workflowState.supplierResponse?.received">
            <template #prepend>
              <v-icon color="purple" size="small">mdi-email-receive</v-icon>
            </template>
            <v-list-item-title>Ответ поставщика</v-list-item-title>
            <v-list-item-subtitle>
              Получен {{ workflowState.supplierResponse.date }}
              <v-chip
                v-if="workflowState.supplierResponse.accepted !== null"
                size="x-small"
                :color="workflowState.supplierResponse.accepted ? 'green' : 'red'"
                class="ml-2"
              >
                {{ workflowState.supplierResponse.accepted ? 'Принят' : 'Отклонён' }}
              </v-chip>
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>

    <!-- Доступные действия -->
    <v-card v-if="availableActions.length > 0" variant="outlined">
      <v-card-title class="text-subtitle-1 bg-grey-lighten-4"> Доступные действия </v-card-title>
      <v-card-text>
        <v-row>
          <v-col v-for="action in availableActions" :key="action.id" cols="12" sm="6" md="4">
            <v-btn
              :color="action.color"
              :disabled="action.disabled"
              block
              variant="outlined"
              @click="handleAction(action.id)"
            >
              <v-icon class="mr-2">{{ action.icon }}</v-icon>
              {{ action.title }}
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- Диалоги для различных действий -->

    <!-- Яндекс Трекер -->
    <v-dialog v-model="showYandexTrackerDialog" max-width="500">
      <v-card>
        <v-card-title>Создать задачу в Яндекс Трекер</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="yandexTrackerForm.taskNumber"
            label="Номер задачи"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-textarea
            v-model="yandexTrackerForm.description"
            label="Описание"
            variant="outlined"
            rows="3"
            density="compact"
          />
          <v-select
            v-model="yandexTrackerForm.priority"
            :items="[
              { value: 'low', title: 'Низкий' },
              { value: 'normal', title: 'Обычный' },
              { value: 'high', title: 'Высокий' },
              { value: 'critical', title: 'Критичный' }
            ]"
            label="Приоритет"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showYandexTrackerDialog = false">Отмена</v-btn>
          <v-btn color="primary" @click="createYandexTrackerTask">Создать</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Списание в 1С -->
    <v-dialog v-model="showOneCWriteOffDialog" max-width="500">
      <v-card>
        <v-card-title>Списание в 1С</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="oneCForm.documentNumber"
            label="Номер документа"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model="oneCForm.date"
            label="Дата"
            type="date"
            variant="outlined"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showOneCWriteOffDialog = false">Отмена</v-btn>
          <v-btn color="primary" @click="createOneCWriteOff">Списать</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Замена компонента -->
    <v-dialog v-model="showReplacementDialog" max-width="500">
      <v-card>
        <v-card-title>Замена компонента</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="replacementForm.newSN"
            label="SN нового компонента"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-select
            v-model="replacementForm.source"
            :items="[
              { value: 'reserve', title: 'Из резерва' },
              { value: 'supplier', title: 'От поставщика' }
            ]"
            label="Источник"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-textarea
            v-model="replacementForm.notes"
            label="Примечания"
            variant="outlined"
            rows="2"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showReplacementDialog = false">Отмена</v-btn>
          <v-btn color="primary" @click="createReplacement">Заменить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Акт рекламации -->
    <v-dialog v-model="showClaimActDialog" max-width="600">
      <v-card>
        <v-card-title>Создать акт рекламации</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="claimActForm.actNumber"
            label="Номер акта"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-model="claimActForm.date"
            label="Дата"
            type="date"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-textarea
            v-model="claimActForm.description"
            label="Описание рекламации"
            variant="outlined"
            rows="4"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showClaimActDialog = false">Отмена</v-btn>
          <v-btn color="primary" @click="createClaimAct">Создать и отправить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Ответ поставщика -->
    <v-dialog v-model="showSupplierResponseDialog" max-width="500">
      <v-card>
        <v-card-title>Ответ поставщика</v-card-title>
        <v-card-text>
          <v-checkbox
            v-model="supplierResponseForm.received"
            label="Ответ получен"
            density="compact"
            class="mb-3"
          />
          <v-text-field
            v-if="supplierResponseForm.received"
            v-model="supplierResponseForm.date"
            label="Дата получения"
            type="date"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-select
            v-if="supplierResponseForm.received"
            v-model="supplierResponseForm.accepted"
            :items="[
              { value: true, title: 'Рекламация принята' },
              { value: false, title: 'Рекламация отклонена' }
            ]"
            label="Результат"
            variant="outlined"
            density="compact"
            class="mb-3"
          />
          <v-textarea
            v-if="supplierResponseForm.received"
            v-model="supplierResponseForm.comment"
            label="Комментарий"
            variant="outlined"
            rows="3"
            density="compact"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showSupplierResponseDialog = false">Отмена</v-btn>
          <v-btn color="primary" @click="saveSupplierResponse">Сохранить</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
