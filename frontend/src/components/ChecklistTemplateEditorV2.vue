<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  VTextField,
  VBtn,
  VCard,
  VCardTitle,
  VCardText,
  VRow,
  VCol,
  VDialog,
  VCardActions,
  VSpacer
} from 'vuetify/components'

// Тип для поля шаблона
interface ChecklistField {
  name: string
}

// Тип для шаблона чек-листа
interface ChecklistTemplate {
  title: string
  fields: ChecklistField[]
}

// Пропсы
const props = defineProps<{
  initialTemplateString?: string
  initialTitle?: string
}>()

// Эмиссия события
const emit = defineEmits<{
  (e: 'template', payload: string): void
}>()

// Шаблон и поля
const template = ref<ChecklistTemplate>({
  title: '',
  fields: []
})

const newField = ref({ name: '' })

const editingField = ref<{
  index: number | null
  name: string
}>({
  index: null,
  name: ''
})

const isEditingDialogOpen = ref(false)

// Парсинг входных данных
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
      template.value.title = newValue
    }
  },
  { immediate: true }
)

// Добавление нового поля
const addField = () => {
  if (newField.value.name) {
    template.value.fields.push({ name: newField.value.name })
    newField.value.name = ''
  }
}

// Начать редактирование
const startEditingField = (index: number) => {
  editingField.value = {
    index,
    name: template.value.fields[index].name
  }
  isEditingDialogOpen.value = true
}

// Сохранить редактирование
const saveEditedField = () => {
  if (editingField.value.index !== null && editingField.value.name) {
    template.value.fields[editingField.value.index] = {
      name: editingField.value.name
    }
    editingField.value = { index: null, name: '' }
    isEditingDialogOpen.value = false
  }
}

// Отменить редактирование
const cancelEditing = () => {
  editingField.value = { index: null, name: '' }
  isEditingDialogOpen.value = false
}

// Удалить поле
const deleteField = (index: number) => {
  template.value.fields.splice(index, 1)
}

// Сохранить шаблон
const templateString = ref('')

function sanitizeJSONString(str: string): string {
  return str
    .replace(/[-\u001F\u2028\u2029]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
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

const saveTemplate = () => {
  const safeTemplate = sanitizeObject(template.value)
  templateString.value = JSON.stringify(safeTemplate)
  emit('template', templateString.value)
  console.log('Saved template:', templateString.value)
}
</script>

<template>
  <v-card class="ma-4">
    <v-card-title>Создание/редактирование шаблона для чек-листа</v-card-title>
    <v-card-text>
      <!-- Заголовок шаблона -->
      <v-text-field
        v-model="template.title"
        label="Артикул модуля"
        variant="outlined"
        class="mb-4"
      />

      <!-- Добавление нового поля -->
      <v-row class="mb-4">
        <v-col cols="10">
          <v-text-field
            v-model="newField.name"
            label="Название поля в чек-листе"
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

      <!-- Список полей -->
      <div v-if="template.fields.length">
        <h3>Added Fields:</h3>
        <v-row class="table-header mb-2" style="border-bottom: 1px solid #ccc; font-weight: bold">
          <v-col cols="9">Field Name</v-col>
          <v-col cols="3">Actions</v-col>
        </v-row>

        <v-row
          v-for="(field, index) in template.fields"
          :key="index"
          class="table-row mb-1"
          style="border: 1px solid #ccc; border-radius: 4px; padding: 8px"
        >
          <v-col cols="9">{{ field.name }}</v-col>
          <v-col cols="3">
            <v-btn color="warning" small @click="startEditingField(index)">Edit</v-btn>
            <v-btn color="error" small @click="deleteField(index)" class="ml-2">Delete</v-btn>
          </v-col>
        </v-row>
      </div>

      <!-- Кнопка сохранить шаблон -->
      <v-btn color="success" @click="saveTemplate" :disabled="!template.title">
        Save Template
      </v-btn>
    </v-card-text>
  </v-card>

  <!-- Диалог редактирования -->
  <v-dialog v-model="isEditingDialogOpen" max-width="500">
    <v-card>
      <v-card-title>
        <span class="text-h6">Редактирование поля</span>
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="editingField.name" label="Редактировать имя" variant="outlined" />
      </v-card-text>
      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn color="success" @click="saveEditedField">Сохранить</v-btn>
        <v-btn color="error" @click="cancelEditing" class="ml-2">Отмена</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.ml-2 {
  margin-left: 8px;
}
</style>
