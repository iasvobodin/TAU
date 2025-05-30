<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  VTextField,
  VSelect,
  VBtn,
  VCard,
  VCardTitle,
  VCardText,
  VRow,
  VCol
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

// Пропс для входной строки шаблона
const props = defineProps<{
  initialTemplateString?: string
  initialTitle?: string
}>()

// Реактивное состояние для формы
const template = ref<ChecklistTemplate>({
  title: '',
  fields: []
})

// Реактивное состояние для нового поля
const newField = ref<{
  name: string
  type: 'text' | 'checkbox'
}>({
  name: '',
  type: 'text'
})

// Реактивное состояние для редактируемого поля
const editingField = ref<{
  index: number | null
  name: string
  type: 'text' | 'checkbox'
}>({
  index: null,
  name: '',
  type: 'text'
})

// Опции для выбора типа поля
const fieldTypes = [
  { title: 'Text', value: 'text' },
  { title: 'Checkbox', value: 'checkbox' }
]

// Парсинг входной строки шаблона
watch(
  () => props.initialTemplateString,
  (newValue) => {
    if (newValue === '') {
      template.value.fields = []
    }
    if (newValue) {
      try {
        template.value = JSON.parse(newValue)
      } catch (e) {
        console.error('Invalid template string:', e)
      }
    }
  },
  { immediate: true }
)

watch(
  () => props.initialTitle,
  (newValue) => {
    if (newValue) {
      try {
        template.value.title = newValue
      } catch (e) {
        console.error('Invalid template string:', e)
      }
    }
  },
  { immediate: true }
)

// Добавление нового поля в шаблон
const addField = () => {
  if (newField.value.name) {
    template.value.fields.push({
      name: newField.value.name,
      type: newField.value.type
    })
    // Сбрасываем поля ввода
    newField.value.name = ''
    newField.value.type = 'text'
  }
}

// Начало редактирования поля
const startEditingField = (index: number) => {
  editingField.value = {
    index,
    name: template.value.fields[index].name,
    type: template.value.fields[index].type
  }
}

// Сохранение отредактированного поля
const saveEditedField = () => {
  if (editingField.value.index !== null && editingField.value.name) {
    template.value.fields[editingField.value.index] = {
      name: editingField.value.name,
      type: editingField.value.type
    }
    // Сбрасываем редактирование
    editingField.value = { index: null, name: '', type: 'text' }
  }
}

// Отмена редактирования
const cancelEditing = () => {
  editingField.value = { index: null, name: '', type: 'text' }
}

// Удаление поля
const deleteField = (index: number) => {
  template.value.fields.splice(index, 1)
}

// Сохранение шаблона как строки
const templateString = ref('')
const emit = defineEmits<{
  (e: 'template', payload: string): void
}>()
function sanitizeJSONString(str: string): string {
  return str
    .replace(/[\u0000-\u001F\u2028\u2029]/g, '') // удаление опасных символов
    .replace(/\\/g, '\\\\') // экранирование обратного слэша
    .replace(/"/g, '\\"') // экранирование кавычек
}
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeJSONString(obj)
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeObject)
  } else if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {}
    for (const key in obj) {
      sanitized[key] = sanitizeObject(obj[key])
    }
    return sanitized
  }
  return obj
}

const safeTemplate = sanitizeObject(template.value)
const jsonString = JSON.stringify(safeTemplate)

const saveTemplate = () => {
  templateString.value = JSON.stringify(template.value)
  emit('template', templateString.value)
  console.log('Saved template:', templateString.value)
  // Здесь можно отправить templateString на сервер
  // Например: await fetch('/api/save-template', { method: 'POST', body: templateString });
}
</script>

<template>
  <v-card class="ma-4">
    <v-card-title>Создание редактирование шаблона для чек-листа</v-card-title>
    <v-card-text>
      <v-text-field
        v-model="template.title"
        label="Артикул модуля"
        variant="outlined"
        class="mb-4"
      />
      <v-row class="mb-4">
        <v-col cols="6">
          <v-text-field
            v-model="newField.name"
            label="Название поля в чек-листе"
            variant="outlined"
            :disabled="editingField.index !== null"
          />
        </v-col>
        <v-col cols="4">
          <v-select
            v-model="newField.type"
            :items="fieldTypes"
            label="Тип поля"
            variant="outlined"
            :disabled="editingField.index !== null"
          />
        </v-col>
        <v-col cols="2">
          <v-btn color="primary" @click="addField" :disabled="editingField.index !== null">
            Add Field
          </v-btn>
        </v-col>
      </v-row>

      <!-- Форма редактирования поля -->
      <div v-if="editingField.index !== null" class="mb-4">
        <h3>Редактирование поля</h3>
        <br />
        <v-row>
          <v-col cols="6">
            <v-text-field
              v-model="editingField.name"
              label="Редактировать имя"
              variant="outlined"
            />
          </v-col>
          <v-col cols="4">
            <v-select
              v-model="editingField.type"
              :items="fieldTypes"
              label="Редактировать тип"
              variant="outlined"
            />
          </v-col>
          <v-col cols="2">
            <v-btn color="success" @click="saveEditedField">Save</v-btn>
            <v-btn color="error" @click="cancelEditing" class="ml-2">Cancel</v-btn>
          </v-col>
        </v-row>
      </div>

      <!-- Список добавленных полей -->

      <div v-if="template.fields.length">
        <h3>Added Fields:</h3>
        <v-row class="table-header mb-2" style="border-bottom: 1px solid #ccc; font-weight: bold">
          <v-col cols="5">Field Name</v-col>
          <v-col cols="4">Type</v-col>
          <v-col cols="3">Actions</v-col>
        </v-row>

        <v-row
          v-for="(field, index) in template.fields"
          :key="index"
          class="table-row mb-1"
          style="border: 1px solid #ccc; border-radius: 4px; padding: 8px"
        >
          <v-col cols="5">{{ field.name }}</v-col>
          <v-col cols="4">{{ field.type }}</v-col>
          <v-col cols="3">
            <v-btn color="warning" small @click="startEditingField(index)">Edit</v-btn>
            <v-btn color="error" small @click="deleteField(index)" class="ml-2">Delete</v-btn>
          </v-col>
        </v-row>
      </div>

      <v-btn color="success" @click="saveTemplate" :disabled="!template.title">
        Save Template
      </v-btn>
    </v-card-text>
  </v-card>
</template>
