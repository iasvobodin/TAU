<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  VTable,
  VTextField,
  VTextarea,
  VCheckbox,
  VBtn,
  VCard,
  VCardTitle,
  VCardText
} from 'vuetify/components'

// Тип для поля шаблона
interface ChecklistField {
  name: string
  type: 'text' | 'checkbox'
}

// Тип для шаблона чек-листа
interface ChecklistTemplate {
  title: string
  fields: ChecklistField[]
}

// Тип для заполненных значений
interface ChecklistValues {
  [key: string]: string | boolean
}

// Пропс для строки шаблона
const props = defineProps<{
  templateString: string
}>()

// Парсим строку шаблона
const template = ref<ChecklistTemplate>({ title: '', fields: [] })
const values = ref<ChecklistValues>({})

// Следим за изменениями пропса и обновляем локальную копию
watch(
  () => props.templateString,
  (newVal) => {
    console.log(newVal, 'sgsgsg')

    try {
      template.value = JSON.parse(newVal)
      // Инициализируем значения для полей
      template.value.fields.forEach((field) => {
        values.value[field.name] = field.type === 'checkbox' ? false : ''
      })
    } catch (e) {
      console.error('Invalid template string:', e)
    }
  },
  { immediate: true }
)

// Сохранение заполненного чек-листа
const saveChecklist = () => {
  const checklistData = {
    title: template.value.title,
    values: values.value
  }
  const checklistString = JSON.stringify(checklistData)
  console.log('Saved checklist:', checklistString)
  // Здесь можно отправить checklistString на сервер
  // Например: await fetch('/api/save-checklist', { method: 'POST', body: checklistString });
}
</script>

<template>
  <v-card class="ma-4">
    <v-card-title>{{ template.title || 'Checklist' }}</v-card-title>
    <v-card-text>
      <v-table>
        <thead>
          <tr>
            <th>Проверяемая операция</th>
            <th>Значение</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(field, index) in template.fields" :key="index">
            <td>{{ field.name }}</td>
            <td>
              <v-text-field
                v-if="field.type === 'text'"
                v-model="values[field.name]"
                variant="outlined"
                density="compact"
                hide-details
              />
              <v-checkbox v-else v-model="values[field.name]" density="compact" />
            </td>
          </tr>
        </tbody>
      </v-table>
      <v-btn color="success" @click="saveChecklist" :disabled="!template.fields.length">
        Save Checklist
      </v-btn>
    </v-card-text>
  </v-card>
</template>
