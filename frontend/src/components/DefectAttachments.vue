<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  defectId: number
}>()

const attachments = ref<
  Array<{
    id: number
    name: string
    type: 'photo' | 'video' | 'document' | 'report'
    url: string
    size: number
    uploadedBy: string
    uploadedAt: Date
  }>
>([])

const uploadDialog = ref(false)
const uploadFiles = ref<File[]>([])
const uploadDescription = ref('')

onMounted(async () => {
  await loadAttachments()
})

async function loadAttachments() {
  // TODO: Загрузка вложений с сервера
  // const response = await api.getDefectAttachments(props.defectId)
  // attachments.value = response
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files) {
    uploadFiles.value = Array.from(target.files)
  }
}

async function uploadAttachments() {
  // TODO: Загрузка файлов на сервер
  // const formData = new FormData()
  // uploadFiles.value.forEach(file => formData.append('files', file))
  // formData.append('description', uploadDescription.value)
  // await api.uploadDefectAttachments(props.defectId, formData)

  uploadDialog.value = false
  uploadFiles.value = []
  uploadDescription.value = ''
  await loadAttachments()
}

function getFileIcon(type: string): string {
  switch (type) {
    case 'photo':
      return 'mdi-image'
    case 'video':
      return 'mdi-video'
    case 'document':
      return 'mdi-file-document'
    case 'report':
      return 'mdi-file-chart'
    default:
      return 'mdi-file'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

async function deleteAttachment(id: number) {
  // TODO: Удаление файла
  // await api.deleteDefectAttachment(props.defectId, id)
  await loadAttachments()
}
</script>

<template>
  <v-card variant="outlined">
    <v-card-title class="text-subtitle-1 bg-grey-lighten-4 d-flex justify-space-between">
      <div>
        <v-icon class="mr-2" size="small">mdi-paperclip</v-icon>
        Вложения
      </div>
      <v-btn size="small" variant="text" prepend-icon="mdi-plus" @click="uploadDialog = true">
        Добавить
      </v-btn>
    </v-card-title>
    <v-card-text>
      <v-list v-if="attachments.length > 0">
        <v-list-item v-for="file in attachments" :key="file.id" :href="file.url" target="_blank">
          <template #prepend>
            <v-icon :icon="getFileIcon(file.type)" />
          </template>
          <v-list-item-title>{{ file.name }}</v-list-item-title>
          <v-list-item-subtitle>
            {{ formatFileSize(file.size) }} • {{ file.uploadedBy }} •
            {{ formatDate(file.uploadedAt) }}
          </v-list-item-subtitle>
          <template #append>
            <v-btn icon variant="text" size="small" @click.prevent="deleteAttachment(file.id)">
              <v-icon>mdi-delete</v-icon>
            </v-btn>
          </template>
        </v-list-item>
      </v-list>

      <v-alert v-else type="info" variant="tonal"> Вложения отсутствуют </v-alert>
    </v-card-text>
  </v-card>

  <!-- Диалог загрузки -->
  <v-dialog v-model="uploadDialog" max-width="600">
    <v-card>
      <v-card-title>Загрузить файлы</v-card-title>
      <v-card-text>
        <v-file-input
          label="Выберите файлы"
          multiple
          variant="outlined"
          density="compact"
          prepend-icon="mdi-paperclip"
          @change="handleFileUpload"
          class="mb-3"
        />

        <v-textarea
          v-model="uploadDescription"
          label="Описание (опционально)"
          variant="outlined"
          rows="2"
          density="compact"
        />

        <v-list v-if="uploadFiles.length > 0" density="compact">
          <v-list-item v-for="(file, index) in uploadFiles" :key="index">
            <template #prepend>
              <v-icon>mdi-file</v-icon>
            </template>
            <v-list-item-title>{{ file.name }}</v-list-item-title>
            <v-list-item-subtitle>
              {{ formatFileSize(file.size) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn @click="uploadDialog = false">Отмена</v-btn>
        <v-btn color="primary" :disabled="uploadFiles.length === 0" @click="uploadAttachments">
          Загрузить
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
