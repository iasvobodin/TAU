<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import {
  VTable,
  VTextarea,
  VRadioGroup,
  VRadio,
  VBtn,
  VCard,
  VCardTitle,
  VCardText
} from 'vuetify/components'

// Тип для поля шаблона
interface ChecklistField {
  name: string
  type?: 'text' | 'checkbox' // type опционален для обратной совместимости
}

// Тип для шаблона чек-листа
interface ChecklistTemplate {
  title: string
  fields: ChecklistField[]
}

// Тип для заполненных значений
interface ChecklistValues {
  [key: string]: {
    status: 'pass' | 'fail' | null
    comment: string
  }
}

// Пропс для строки шаблона
const props = defineProps<{
  templateString: string
}>()
const emit = defineEmits<{
  (e: 'checkList', payload: string): void
}>()
// Парсим строку шаблона
const template = ref<ChecklistTemplate>({ title: '', fields: [] })
const values = ref<ChecklistValues>({})

watch(
  () => props.templateString,
  (newVal) => {
    console.log(newVal, 'sgsgsg')
    try {
      template.value = JSON.parse(newVal)
      // Инициализируем значения для полей
      template.value.fields.forEach((field) => {
        values.value[field.name] = {
          status: null,
          comment: ''
        }
      })
    } catch (e) {
      console.error('Invalid template string:', e)
    }
  },
  { immediate: true }
)

// Валидация для блокировки кнопки сохранения
const isSaveDisabled = computed(() => {
  // Проверяем, что все поля имеют статус pass или fail
  const allFieldsFilled = template.value.fields.every(
    (field) =>
      values.value[field.name]?.status === 'pass' || values.value[field.name]?.status === 'fail'
  )
  // Проверяем, что для всех полей со статусом fail есть комментарий
  const allFailFieldsCommented = template.value.fields.every(
    (field) =>
      values.value[field.name]?.status !== 'fail' ||
      (values.value[field.name]?.comment || '').trim() !== ''
  )
  return !allFieldsFilled || !allFailFieldsCommented || !template.value.fields.length
})

// Сохранение заполненного чек-листа
const saveChecklist = () => {
  const checklistData = {
    title: template.value.title,
    values: values.value
  }
  const checklistString = JSON.stringify(checklistData)
  // console.log('Saved checklist:', checklistString);
  emit('checkList', checklistString)
  // Здесь можно отправить checklistString на сервер
  // Например: await fetch('/api/save-checklist', { method: 'POST', body: checklistString });
}
</script>

<template>
  <v-card border="red md" class="ma-4">
    <v-card-title><b>ЧЕК ЛИСТ</b></v-card-title>
    <v-card-text>
      <v-table>
        <thead>
          <tr>
            <th><b>Проверяемая операция</b></th>
            <th><b>Статус</b></th>
            <th><b>Комментарий</b></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(field, index) in template.fields" :key="index">
            <td width="60%">
              {{ field.name }}
              <h3
                class="text-red"
                v-if="values[field.name].status === 'fail' && values[field.name].comment === ''"
              >
                Комментарий обязателен!
              </h3>
            </td>
            <td width="20%">
              <v-radio-group hide-details v-model="values[field.name].status" inline>
                <v-radio label="Pass" value="pass" />
                <v-radio label="Fail" value="fail" />
              </v-radio-group>
            </td>
            <td width="20%">
              <v-textarea
                v-model="values[field.name].comment"
                variant="outlined"
                density="compact"
                hide-details
                rows="1"
                :rules="[
                  () =>
                    values[field.name].status !== 'fail' ||
                    (values[field.name].comment || '').trim() !== '' ||
                    'Comment is required for Fail status'
                ]"
              />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-btn color="success" @click="saveChecklist" :disabled="isSaveDisabled">
        Save Checklist
      </v-btn>
    </v-card-text>
  </v-card>
</template>
