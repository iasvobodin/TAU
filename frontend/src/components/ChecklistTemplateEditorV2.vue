<script setup lang="ts">
import { ref, watch } from 'vue'
import Draggable from 'vuedraggable'
import {
  filesystem,
  Mode,
  os,
  computer,
  extensions,
  window as neuWindow,
  events
} from '@neutralinojs/lib'
import {
  processAndSaveFile,
  readFileAndCreatePreview,
  ensureDirectoryExists,
  revokePreviewUrl,
  getMimeTypeFromExtension
} from '@/assets/imageManager'

import { useErrorStore } from '@/stores/errorStore'

const errorStore = useErrorStore()
interface ChecklistField {
  id: string
  name: string
  description?: string
  image?: string | null // пока строка (может быть base64/URL)
  previewUrl?: string
  fileBlob?: File | null // новое поле, временный файл для сохранения
}

interface ChecklistTemplate {
  title: string
  fields: ChecklistField[]
}

const props = defineProps<{
  initialTemplateString?: string
  initialTitle?: string
}>()
// console.log(props.initialTitle);

const emit = defineEmits<{
  (e: 'template', payload: string): void
}>()

const template = ref<ChecklistTemplate>({
  title: '',
  fields: []
})

const editingField = ref<{
  index: number | null
  name: string
  description: string
  image: string | null
  previewUrl?: string
  fileBlob?: File | null // новое поле, временный файл для сохранения
}>({
  index: null,
  name: '',
  description: '',
  image: null,
  previewUrl: '',
  fileBlob: null // новое поле, временный файл для сохранения
})

const isEditingDialogOpen = ref(false)
const isCreatingDialogOpen = ref(false)

// ссылка на скрытый file input
const fileInputRef = ref<HTMLInputElement | null>(null)

function genId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return (crypto as any).randomUUID()
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function ensureIds(arr: Array<any>): ChecklistField[] {
  return arr.map((it: any) => ({
    id: it.id ?? genId(),
    name: it.name,
    description: it.description ?? '',
    image: it.image ?? null
  }))
}
// Отдельная функция для загрузки изображений
async function loadImagesForChecklist(fields: ChecklistField[]): Promise<void> {
  for (const field of fields) {
    if (field.image && typeof field.image === 'string') {
      try {
        const previewResult = await readFileAndCreatePreview(field.image)

        field.previewUrl = previewResult.previewUrl
      } catch (error) {
        console.error(`Ошибка загрузки изображения для ${field.name}:`, error)
        field.image = null
      }
    }
  }
}

let currentProcessId = 0

watch(
  () => props.initialTemplateString,
  async (newValue) => {
    const processId = ++currentProcessId

    if (newValue === '') {
      if (currentProcessId === processId) {
        template.value.fields = []
      }
      return
    }

    if (newValue) {
      try {
        const parsed = JSON.parse(newValue)
        const fields = ensureIds(parsed.fields ?? [])

        await loadImagesForChecklist(fields)

        // Проверяем что это всё ещё актуальный процесс
        if (currentProcessId === processId) {
          template.value = {
            title: parsed.title ?? '',
            fields: fields
          }
        }
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

const openCreateDialog = () => {
  editingField.value = { index: null, name: '', description: '', image: null }
  isCreatingDialogOpen.value = true
}

const addField = () => {
  if (editingField.value.name) {
    template.value.fields.push({
      id: genId(),
      name: editingField.value.name,
      description: editingField.value.description,
      image: editingField.value.image
    })
    isCreatingDialogOpen.value = false
  }
}

const startEditingField = (index: number) => {
  const f = template.value.fields[index]
  editingField.value = {
    index,
    name: f.name,
    description: f.description ?? '',
    image: f.image ?? null,
    previewUrl: f.previewUrl
  }
  isEditingDialogOpen.value = true
}

const saveEditedField = () => {
  if (editingField.value.index !== null) {
    const prev = template.value.fields[editingField.value.index]
    template.value.fields[editingField.value.index] = {
      id: prev.id,
      name: editingField.value.name,
      description: editingField.value.description,
      image: editingField.value.image,
      previewUrl: editingField.value.previewUrl,
      fileBlob: editingField.value.fileBlob
    }
    editingField.value = { index: null, name: '', description: '', image: null }
    isEditingDialogOpen.value = false
  }
}

const cancelEditing = () => {
  editingField.value = { index: null, name: '', description: '', image: null }
  isEditingDialogOpen.value = false
  isCreatingDialogOpen.value = false
}

const deleteField = (index: number) => {
  template.value.fields.splice(index, 1)
}

const removeImage = (index: number | null) => {
  // удаляем ссылку
  if (editingField.value.previewUrl) {
    URL.revokeObjectURL(editingField.value.previewUrl)
    editingField.value.previewUrl = ''
  }
  filesystem.remove(editingField.value.image!)
  editingField.value.image = null
  errorStore.addInfo(`Изображение удалено из локальной папки`)
  setTimeout(errorStore.removeInfo, 5000)
}

const onImageSelected = async (event: Event) => {
  //нужно только превью, пока не сохраняем ничего никуда
  const result = await processAndSaveFile(event, './uploads', props.initialTitle)
  console.log(result)
  editingField.value.previewUrl = result?.previewUrl!
  editingField.value.image = result?.filePath!
  editingField.value.fileBlob = result?.file // сохранили файл, но не путь!
}

const templateString = ref('')

function sanitizeJSONString(str: string): string {
  return JSON.stringify(str).slice(1, -1)
}

// Или проще вообще не писать свою функцию:
function sanitizeObject(obj: any): any {
  return JSON.parse(JSON.stringify(obj)) // сериализация + парсинг
}

const saveTemplate = async () => {
  // Проходим по полям и сохраняем картинки, если они еще не сохранены
  // console.log(template.value.fields);

  for (const field of template.value.fields) {
    if (field.fileBlob) {
      // const file: File = (field as any).fileBlob
      // const fileExtension = getFileExtension(file.name)
      // const uniqueFileName = generateUniqueFileName(fileExtension)
      // const filePath = `./uploads/${uniqueFileName}`
      const arrayBuffer = await field.fileBlob!.arrayBuffer()
      try {
        console.log(field.image!)
        await filesystem.writeBinaryFile(field.image!, arrayBuffer)
      } catch (error) {
        console.log(error)
      }

      // Обновляем поле image и очищаем fileBlob
      // field.image = filePath
      delete (field as any).fileBlob

      // Обновляем previewUrl
      if (field.previewUrl) {
        URL.revokeObjectURL(field.previewUrl)
      }

      const blob = new Blob([arrayBuffer], { type: getMimeTypeFromExtension(field.image!) })
      field.previewUrl = URL.createObjectURL(blob)
    }
  }

  const payload = {
    title: template.value.title,
    fields: template.value.fields.map(({ name, description, image }) => ({
      name,
      description,
      image
    }))
  }
  const safeTemplate = sanitizeObject(payload)
  templateString.value = JSON.stringify(safeTemplate)
  emit('template', templateString.value)
  // console.log('Saved template:', templateString.value)
}
</script>

<template>
  <v-card class="ma-4">
    <v-card-title>Создание/редактирование шаблона для чек-листа</v-card-title>
    <v-card-text class="mt-4">
      <!-- <v-text-field
        v-model="template.title"
        label="Артикул модуля"
        variant="outlined"
        class="mb-4"
        density="compact"
      /> -->

      <v-row class="mb-2">
        <v-col cols="12" class="d-flex justify-end">
          <v-btn block color="primary" @click="openCreateDialog"> Добавить поле </v-btn>
        </v-col>
      </v-row>

      <div v-if="template.fields.length">
        <h2>Чек-лист</h2>
        <v-row
          class="table-header mb-2 mt-4"
          style="border-bottom: 1px solid #ccc; font-weight: bold"
        >
          <v-col class="d-flex justify-center align-center" cols="1">Сорт</v-col>
          <v-col cols="7">Название</v-col>
          <v-col cols="2" class="d-flex justify-center align-center">Иконки</v-col>
          <v-col cols="2" class="d-flex justify-center align-center">Редактировать</v-col>
        </v-row>

        <Draggable
          v-model="template.fields"
          item-key="id"
          handle=".drag-handle"
          :animation="150"
          ghost-class="drag-ghost"
        >
          <template #item="{ element, index }">
            <v-row
              class="table-row"
              style="border: 1px solid #ccc; border-radius: 4px; padding: 1px"
            >
              <v-col cols="1" class="d-flex flex-column justify-center align-center pa-0">
                <v-btn
                  variant="text"
                  size="x-small"
                  class="drag-handle opacity-0"
                  :ripple="false"
                  :tabindex="-1"
                >
                  <v-icon size="26">mdi-drag</v-icon>
                </v-btn>
              </v-col>

              <v-col cols="7" class="d-flex justify-start align-center">
                {{ element.name }}
                <!-- Tooltip для описания -->
                <v-tooltip v-if="element.description" :open-delay="200">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" size="20" color="blue" class="mr-1"
                      >mdi-file-document-outline</v-icon
                    >
                  </template>
                  <span style="white-space: pre-wrap; max-width: 300px">{{
                    element.description
                  }}</span>
                </v-tooltip>

                <!-- Tooltip для изображения -->
                <v-tooltip v-if="element.image" :open-delay="200">
                  <template #activator="{ props }">
                    <v-icon v-bind="props" size="20" color="green">mdi-image</v-icon>
                  </template>
                  <div style="display: flex; flex-direction: column; align-items: center">
                    <span>Есть изображение</span>
                    <img
                      :src="element.previewUrl"
                      style="
                        max-width: 150px;
                        max-height: 150px;
                        border-radius: 4px;
                        margin-top: 4px;
                      "
                    />
                  </div>
                </v-tooltip>
              </v-col>

              <v-col cols="2" class="d-flex justify-center align-center"> </v-col>

              <v-col cols="2" class="d-flex justify-center align-center">
                <v-btn
                  variant="text"
                  size="small"
                  color="warning"
                  @click="startEditingField(index)"
                >
                  <v-icon size="22">mdi-pencil</v-icon>
                </v-btn>
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
          </template>
        </Draggable>
      </div>

      <v-row class="mt-4">
        <v-col cols="12" class="d-flex justify-end">
          <v-btn block color="success" @click="saveTemplate" :disabled="!template.title">
            Сохранить шаблон
          </v-btn>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>

  <!-- Диалог создания -->
  <v-dialog v-model="isCreatingDialogOpen" max-width="800">
    <v-card>
      <v-card-title>
        <span class="text-h6">Новое поле</span>
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="editingField.name" label="Название поля" variant="outlined" />
        <v-textarea v-model="editingField.description" label="Описание" variant="outlined" />

        <!-- Кнопка добавить картинку -->
        <v-btn color="primary" class="mt-2" @click="fileInputRef?.click()">
          <v-icon>mdi-image-plus</v-icon>
          Добавить изображение
        </v-btn>
        <input
          type="file"
          accept="image/*"
          ref="fileInputRef"
          class="d-none"
          @change="onImageSelected"
        />

        <!-- Превью изображения -->
        <div v-if="editingField.previewUrl" class="mt-4">
          <img
            :src="editingField.previewUrl"
            style="width: 100%; height: auto; border-radius: 8px"
          />
          <v-btn color="error" class="mt-2" @click="removeImage">
            <v-icon>mdi-delete</v-icon>
            Удалить картинку
          </v-btn>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn color="success" @click="addField">Сохранить</v-btn>
        <v-btn color="error" @click="cancelEditing" class="ml-2">Отмена</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Диалог редактирования -->
  <v-dialog v-model="isEditingDialogOpen" max-width="800">
    <v-card>
      <v-card-title>
        <span class="text-h6">Редактирование поля</span>
      </v-card-title>
      <v-card-text>
        <v-text-field v-model="editingField.name" label="Редактировать имя" variant="outlined" />
        <v-textarea v-model="editingField.description" label="Описание" variant="outlined" />

        <!-- Кнопка добавить картинку -->
        <v-btn color="primary" class="mt-2" @click="fileInputRef?.click()">
          <v-icon>mdi-image-plus</v-icon>
          Добавить изображение
        </v-btn>
        <input
          type="file"
          accept="image/*"
          ref="fileInputRef"
          class="d-none"
          @change="onImageSelected"
        />

        <!-- Превью изображения -->
        <div v-if="editingField.previewUrl" class="mt-4">
          <v-img max-height="200" aspect-ratio="1" cover :src="editingField.previewUrl"></v-img>
          <v-btn color="error" class="mt-2" @click="removeImage(editingField.index)">
            <v-icon>mdi-delete</v-icon>
            Удалить картинку
          </v-btn>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
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
.drag-handle {
  cursor: grab;
  transition: opacity 0.2s ease;
}
.drag-handle:active {
  cursor: grabbing;
}
.table-row:hover .drag-handle {
  opacity: 1 !important;
}
.drag-ghost {
  opacity: 0.6;
}
.d-none {
  display: none;
}
</style>
