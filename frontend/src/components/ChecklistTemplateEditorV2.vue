<script setup lang="ts">
import { ref, watch } from 'vue'

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
// Перемещение поля вверх или вниз
const moveField = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex >= 0 && newIndex < template.value.fields.length) {
    const temp = template.value.fields[index]
    template.value.fields[index] = template.value.fields[newIndex]
    template.value.fields[newIndex] = temp
  }
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
    <v-card-text class="mt-4">
      <!-- Заголовок шаблона -->
      <v-text-field
        v-model="template.title"
        label="Артикул модуля"
        variant="outlined"
        class="mb-4"
        density="compact"
      />

      <!-- Добавление нового поля -->
      <v-row class="mb-2">
        <v-col cols="10">
          <v-text-field
            v-model="newField.name"
            label="Название поля в чек-листе"
            variant="outlined"
            hide-details="auto"
            density="compact"
            :disabled="editingField.index !== null"
          />
        </v-col>
        <v-col class="d-flex justify-center align-center pa-0 ma-0" cols="2">
          <v-btn color="primary" @click="addField" :disabled="editingField.index !== null">
            Добавить
          </v-btn>
        </v-col>
      </v-row>

      <!-- Список полей -->
      <div v-if="template.fields.length">
        <h2>Чек-лист</h2>
        <v-row
          class="table-header mb-2 mt-4"
          style="border-bottom: 1px solid #ccc; font-weight: bold"
        >
          <v-col class="d-flex justify-center align-center" cols="1">Сорт</v-col>
          <v-col cols="9">Название</v-col>
          <v-col class="d-flex justify-center align-center" cols="2">Редактировать</v-col>
        </v-row>

        <v-row
          v-for="(field, index) in template.fields"
          :key="index"
          class="table-row"
          style="border: 1px solid #ccc; border-radius: 4px; padding: 1px"
        >
          <v-col cols="1" class="d-flex flex-column justify-center align-center pa-0">
            <!-- Стрелочка вверх -->
            <v-btn
              variant="text"
              size="x-small"
              :disabled="index === 0"
              @click="moveField(index, 'up')"
            >
              <v-icon size="30" :color="index === 0 ? 'grey' : 'blue'">mdi-chevron-up</v-icon>
            </v-btn>
            <!-- Стрелочка вниз -->
            <v-btn
              variant="text"
              size="x-small"
              :disabled="index === template.fields.length - 1"
              @click="moveField(index, 'down')"
              class="mt-1 pa-0"
            >
              <v-icon size="30" :color="index === template.fields.length - 1 ? 'grey' : 'blue'">
                mdi-chevron-down
              </v-icon>
            </v-btn>
          </v-col>

          <v-col pa-0 ma-0 cols="9" class="d-flex justify-start align-center">{{
            field.name
          }}</v-col>
          <v-col cols="2" class="d-flex justify-center align-center">
            <!-- Кнопка редактирования -->
            <v-btn variant="text" size="small" color="warning" @click="startEditingField(index)">
              <v-icon size="22">mdi-pencil</v-icon>
            </v-btn>

            <!-- Кнопка удаления -->
            <v-btn
              variant="text"
              size="small"
              color="error"
              @click="deleteField(index)"
              class="ml-1"
            >
              <v-icon size="22">mdi-delete</v-icon>
            </v-btn>
          </v-col>
        </v-row>
      </div>

      <!-- Кнопка сохранить шаблон -->
      <v-row class="mt-4">
        <v-col cols="12" class="d-flex justify-end">
          <v-btn block color="success" @click="saveTemplate" :disabled="!template.title">
            Сохранить шаблон
          </v-btn>
        </v-col>
      </v-row>
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
