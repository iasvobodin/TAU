<script setup lang="ts">
import { createDefectHistory, updateDefectHistory } from '@/api/defectHistoryServices'
import { useUserStore } from '@/stores/user'
import { ref, watch } from 'vue'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'

const props = defineProps<{
  modelValue: {
    type: 'fixable' | 'non-fixable' | null
    source: 'production' | 'supplier' | null
  }
  defect: DefectHistoryWithTypedAction // НОВОЕ: весь объект
}>()

const emit = defineEmits<{
  'update:modelValue': [
    value: {
      type: 'fixable' | 'non-fixable' | null
      source: 'production' | 'supplier' | null
    }
  ]
  'update:classification': []
  'reject-defect': [comment: string]
}>()

const localClassification = ref({ ...props.modelValue })
const isEditing = ref(false)
const showRejectDialog = ref(false)
const rejectComment = ref('')

// watch(
//   () => props.modelValue,
//   (newValue) => {
//     console.log('!!!!!!!!!!!!!!!!!')

//     localClassification.value = {
//       type: newValue.type || (props.defect.defectType as 'fixable' | 'non-fixable' | null) || null,
//       source:
//         newValue.source || (props.defect.defectSource as 'production' | 'supplier' | null) || null
//     }
//   },
//   { deep: true, immediate: true }
// )
watch(
  () => props.defect,
  (newDefect) => {
    if (newDefect) {
      console.log('&&&&&&&&&&&&&&&')
      localClassification.value = {
        type: (newDefect.defectType as 'fixable' | 'non-fixable' | null) || null,
        source: (newDefect.defectSource as 'production' | 'supplier' | null) || null
      }
    }
  },
  { deep: true, immediate: true }
)

// В методах используем:
// props.defect.id
// props.defect.status
// props.defect.defectType
// props.defect.defectSource

async function saveClassification() {
  const type = localClassification.value.type
  const source = localClassification.value.source

  if (!type || !source) {
    alert('Необходимо указать тип и источник брака')
    return
  }

  const typeLabel = type === 'fixable' ? 'Исправимый' : 'Неисправимый'
  const sourceLabel = source === 'production' ? 'Брак на производстве' : 'Брак поставщика'

  try {
    // Обновляем классификацию у самой записи брака (defectType / defectSource)
    await updateDefectHistory(props.defect.id, {
      defectType: type,
      defectSource: source
    })

    // Создаём строку в истории (лог действия) — этап «Анализ причин»
    await createDefectHistory({
      componentSN: props.defect.componentSN,
      actionType: 'AnalyzeCause',
      status: 'on_hold',
      description: `Классификация брака: ${typeLabel}, ${sourceLabel}`,
      user: useUserStore().userFullName,
      defectType: type,
      defectSource: source
    })

    emit('update:modelValue', localClassification.value)
    emit('update:classification')
    isEditing.value = false
  } catch (error) {
    console.error('Ошибка сохранения классификации:', error)
    alert('Не удалось сохранить классификацию. Попробуйте ещё раз.')
  }
}

// async function saveClassification() {
//   // Emit с данными классификации
//   emit('update:classification', {
//     type: localClassification.value.type!,
//     source: localClassification.value.source!
//   })
//   isEditing.value = false
// }

function cancelEdit() {
  // localClassification.value = { ...props.modelValue }
  isEditing.value = false
}

function openRejectDialog() {
  showRejectDialog.value = true
  rejectComment.value = ''
}

async function confirmReject() {
  if (!rejectComment.value.trim()) {
    alert('Необходимо указать причину отклонения')
    return
  }

  // TODO: API вызов для отклонения брака
  // await api.rejectDefect(props.defectId, {
  //   comment: rejectComment.value,
  //   actionType: 'RejectDefect',
  //   status: 'rejected'
  // })

  emit('reject-defect', rejectComment.value)
  showRejectDialog.value = false
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1 bg-grey-lighten-4 d-flex justify-space-between">
      <div>
        <v-icon class="mr-2" size="small">mdi-label</v-icon>
        Классификация брака
      </div>
      <div class="d-flex gap-2">
        <v-btn
          v-if="defect.actionType === 'DetectDefect' && !isEditing"
          size="small"
          variant="text"
          color="red"
          prepend-icon="mdi-close-circle"
          @click="openRejectDialog"
        >
          Брак не подтверждён
        </v-btn>
        <v-btn
          v-if="!isEditing"
          size="small"
          variant="text"
          @click="isEditing = true"
          prepend-icon="mdi-pencil"
        >
          Изменить
        </v-btn>
      </div>
    </v-card-title>
    <v-card-text>
      <template v-if="!isEditing">
        <v-row>
          <v-col cols="6">
            <div class="text-caption text-grey-darken-1 mb-1">Тип брака</div>
            <v-chip
              v-if="localClassification.type"
              :color="localClassification.type === 'fixable' ? 'green' : 'red'"
              size="small"
            >
              {{ localClassification.type === 'fixable' ? 'Исправимый' : 'Неисправимый' }}
            </v-chip>
            <span v-else class="text-body-2">Не классифицирован</span>
          </v-col>
          <v-col cols="6">
            <div class="text-caption text-grey-darken-1 mb-1">Источник брака</div>
            <v-chip
              v-if="localClassification.source"
              :color="localClassification.source === 'production' ? 'blue' : 'orange'"
              size="small"
            >
              {{
                localClassification.source === 'production'
                  ? 'Брак на производстве'
                  : 'Брак поставщика'
              }}
            </v-chip>
            <span v-else class="text-body-2">Не определен</span>
          </v-col>
        </v-row>
      </template>

      <template v-else>
        <v-row>
          <v-col cols="12" md="6">
            <v-select
              v-model="localClassification.type"
              :items="[
                { value: 'fixable', title: 'Исправимый' },
                { value: 'non-fixable', title: 'Неисправимый' }
              ]"
              label="Тип брака"
              variant="outlined"
              density="compact"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-select
              v-model="localClassification.source"
              :items="[
                { value: 'production', title: 'Брак на производстве' },
                { value: 'supplier', title: 'Брак поставщика' }
              ]"
              label="Источник брака"
              variant="outlined"
              density="compact"
            />
          </v-col>
        </v-row>
        <div class="d-flex gap-2">
          <v-btn color="primary" size="small" @click="saveClassification"> Сохранить </v-btn>
          <v-btn variant="outlined" size="small" @click="cancelEdit"> Отмена </v-btn>
        </div>
      </template>
    </v-card-text>
  </v-card>

  <!-- Диалог отклонения брака -->
  <v-dialog v-model="showRejectDialog" max-width="500">
    <v-card>
      <v-card-title class="bg-red-lighten-4">
        <v-icon class="mr-2">mdi-close-circle</v-icon>
        Отклонение брака
      </v-card-title>
      <v-card-text class="pt-4">
        <v-textarea
          v-model="rejectComment"
          label="Причина отклонения *"
          variant="outlined"
          rows="4"
          density="compact"
          placeholder="Опишите, почему брак не подтверждён..."
          :rules="[(v) => !!v || 'Обязательное поле']"
        />
        <v-alert type="info" variant="tonal" density="compact">
          После отклонения статус будет изменён на "rejected"
        </v-alert>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="showRejectDialog = false">Отмена</v-btn>
        <v-btn color="red" @click="confirmReject">Отклонить брак</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.gap-2 {
  gap: 0.5rem;
}
</style>
