<script setup lang="ts">
import { onBeforeUnmount, onMounted, onUnmounted, ref, watch, computed } from 'vue'
import { storage } from '@neutralinojs/lib'
import { readFileAndCreatePreview } from '@/assets/imageManager'

// Тип для поля шаблона
interface ChecklistField {
  id: string
  name: string
  description?: string
  image?: string | null
  previewUrl?: string
  type?: 'text' | 'checkbox'
}

// Тип для данных, которые ты передаешь через emit
interface ChecklistEmitPayload {
  checklistString: string
  ss: boolean
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
  sn: string
}>()

const emit = defineEmits<{
  (e: 'checkList', payload: { checklistString: string; ss: boolean }): void
}>()

// Режим отображения
const viewMode = ref<'table' | 'cards'>('table')

// Парсим строку шаблона
const template = ref<ChecklistTemplate>({ title: '', fields: [] })
const values = ref<ChecklistValues>({})
const currentCardIndex = ref(0)

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

watch(
  () => props.templateString,
  async (newVal) => {
    if (newVal === '') {
      return
    }
    try {
      const parsed = JSON.parse(newVal)
      await loadImagesForChecklist(parsed.fields)
      // Проверим, есть ли поля с status/comment — значит пришли заполненные данные
      const hasStatus = parsed.fields && parsed.fields.some((f: any) => 'status' in f)

      if (hasStatus) {
        // Заполняем template и values отдельно
        template.value = {
          title: parsed.title,
          fields: parsed.fields.map((f: any) => ({
            id: f.id || f.name,
            name: f.name,
            description: f.description,
            image: f.image,
            previewUrl: f.previewUrl
          }))
        }
        values.value = {}
        parsed.fields.forEach((f: any) => {
          values.value[f.id || f.name] = {
            status: f.status ?? null,
            comment: f.comment ?? ''
          }
        })
      } else {
        // Просто шаблон без значений
        template.value = parsed
        values.value = {}
        parsed.fields.forEach((field: any) => {
          values.value[field.id || field.name] = {
            status: null,
            comment: ''
          }
        })
      }
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
      values.value[field.id || field.name]?.status === 'pass' ||
      values.value[field.id || field.name]?.status === 'fail'
  )
  // Проверяем, что для всех полей со статусом fail есть комментарий
  const allFailFieldsCommented = template.value.fields.every(
    (field) =>
      values.value[field.id || field.name]?.status !== 'fail' ||
      (values.value[field.id || field.name]?.comment || '').trim() !== ''
  )
  return !allFieldsFilled || !allFailFieldsCommented || !template.value.fields.length
})

watch(
  () => values.value,
  (newVal) => {
    saveChecklist(isSaveDisabled.value)
  },
  { deep: true }
)

// Навигация по карточкам
const nextCard = () => {
  if (currentCardIndex.value < template.value.fields.length - 1) {
    currentCardIndex.value++
  }
}

const prevCard = () => {
  if (currentCardIndex.value > 0) {
    currentCardIndex.value--
  }
}

// Сохранение заполненного чек-листа
const saveChecklist = (ss: boolean) => {
  const checklistData = {
    title: template.value.title,
    fields: template.value.fields.map((field) => ({
      id: field.id,
      name: field.name,
      description: field.description,
      image: field.image,
      previewUrl: field.previewUrl,
      status: values.value[field.id || field.name]?.status,
      comment: values.value[field.id || field.name]?.comment
    }))
  }
  const checklistString = JSON.stringify(checklistData)

  emit('checkList', { checklistString, ss })
}
function sanitizeObject(obj: any): any {
  return JSON.parse(JSON.stringify(obj)) // сериализация + парсинг
}
function sanitizeJSONString(str: string): string {
  return JSON.stringify(str).slice(1, -1)
}
const saveChecklistLocal = async () => {
  const checklistData = {
    title: template.value.title,
    fields: template.value.fields.map((field) => ({
      id: field.id,
      name: field.name,
      description: field.description,
      image: field.image,
      previewUrl: field.previewUrl,
      status: values.value[field.id || field.name]?.status,
      comment: values.value[field.id || field.name]?.comment
    }))
  }
  const checklistString = JSON.stringify(checklistData)
  // console.log(checklistString);
  await storage.setData(`checkList_${props.sn}`, checklistString)
  console.log('checklist saved')
}

function handleKeydown(event: KeyboardEvent) {
  if (viewMode.value === 'cards') {
    if (event.key === 'ArrowLeft') {
      prevCard()
      event.preventDefault() // Предотвращаем прокрутку страницы
    } else if (event.key === 'ArrowRight') {
      nextCard()
      event.preventDefault() // Предотвращаем прокрутку страницы
    } else if (event.key === 'Enter') {
      // Получаем id текущего поля
      const currentField = template.value.fields[currentCardIndex.value]
      const fieldId = currentField.id || currentField.name

      // Устанавливаем статус "pass" для текущего поля
      values.value[fieldId].status = 'pass'
      // перелистываем карточку с небольшой задержкой
      setTimeout(() => {
        if (currentCardIndex.value < template.value.fields.length - 1) {
          currentCardIndex.value++
        }
      }, 501)
      // setTimeout(nextCard, 500)
      event.preventDefault()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  console.log('ЗАМОНТИРОВАЛИ!!!!!!!!!!')
  saveChecklistLocal()
})
</script>

<template>
  <v-card border="red" class="ma-0">
    <v-row class="ma-0">
      <v-col>
        <h3>ЧЕК ЛИСТ</h3>
      </v-col>
      <v-col cols="4" class="text-right">
        <v-tabs v-model="viewMode" density="compact" fixed-tabs>
          <v-tab value="table">Таблица</v-tab>
          <v-tab value="cards">Карточки</v-tab>
        </v-tabs>
      </v-col>
      <v-col cols="2" class="text-right">
        <v-tooltip text="Сохранить чеклист локально" location="bottom">
          <template v-slot:activator="{ props: activatorProps }">
            <v-btn color="gray" @click="saveChecklistLocal" v-bind="activatorProps">
              <v-icon color="blue" left>mdi-cloud-upload</v-icon>
            </v-btn>
          </template>
        </v-tooltip>
      </v-col>
    </v-row>

    <v-card-text>
      <!-- Режим таблицы -->
      <v-tabs-window v-model="viewMode">
        <v-tabs-window-item value="table">
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
        </v-tabs-window-item>

        <!-- Режим карточек -->
        <v-tabs-window-item value="cards">
          <div v-if="template.fields.length > 0">
            <!-- Навигация -->
            <v-row class="mb-4" align="center">
              <v-col class="text-center">
                Карточка {{ currentCardIndex + 1 }} из {{ template.fields.length }}
              </v-col>
              <v-col cols="auto">
                <v-btn
                  @click="prevCard"
                  :disabled="currentCardIndex === 0"
                  icon="mdi-chevron-left"
                />
              </v-col>
              <v-col cols="auto">
                <v-btn
                  @click="nextCard"
                  :disabled="currentCardIndex === template.fields.length - 1"
                  icon="mdi-chevron-right"
                />
              </v-col>
            </v-row>

            <!-- Карточка -->
            <v-card class="pa-4">
              <v-card-title class="text-h6 text-left" style="white-space: normal">
                {{ template.fields[currentCardIndex].name }}
              </v-card-title>

              <v-card-text>
                <!-- Статус -->
                <v-radio-group
                  v-model="
                    values[
                      template.fields[currentCardIndex].id || template.fields[currentCardIndex].name
                    ].status
                  "
                  label="Статус:"
                  class="mt-4"
                  inline
                >
                  <v-radio label="Pass" value="pass" color="success" />
                  <v-radio label="Fail" value="fail" color="error" />
                </v-radio-group>

                <!-- Комментарий -->
                <v-textarea
                  v-model="
                    values[
                      template.fields[currentCardIndex].id || template.fields[currentCardIndex].name
                    ].comment
                  "
                  label="Комментарий"
                  variant="outlined"
                  class="mt-4"
                  rows="2"
                  :rules="[
                    () =>
                      values[
                        template.fields[currentCardIndex].id ||
                          template.fields[currentCardIndex].name
                      ].status !== 'fail' ||
                      (
                        values[
                          template.fields[currentCardIndex].id ||
                            template.fields[currentCardIndex].name
                        ].comment || ''
                      ).trim() !== '' ||
                      'Комментарий обязателен для статуса Fail'
                  ]"
                />

                <!-- Предупреждение о необходимости комментария -->
                <v-alert
                  v-if="
                    values[
                      template.fields[currentCardIndex].id || template.fields[currentCardIndex].name
                    ].status === 'fail' &&
                    values[
                      template.fields[currentCardIndex].id || template.fields[currentCardIndex].name
                    ].comment === ''
                  "
                  type="error"
                  density="compact"
                  class="mt-2"
                >
                  Комментарий обязателен для статуса Fail!
                </v-alert>

                <v-row
                  v-if="
                    template.fields[currentCardIndex].description ||
                    template.fields[currentCardIndex].previewUrl
                  "
                  style="border: 1px solid gray; border-radius: 7px; padding: 1px"
                  class="mt-3"
                >
                  <!-- Описание -->
                  <v-col
                    v-if="template.fields[currentCardIndex].description"
                    class="text-body-1 d-flex mb-4 justify-center align-center"
                  >
                    {{ template.fields[currentCardIndex].description }}
                  </v-col>
                  <!-- Изображение -->
                  <v-col
                    v-if="template.fields[currentCardIndex].previewUrl"
                    class="text-center mb-4"
                  >
                    <v-img
                      :src="template.fields[currentCardIndex].previewUrl"
                      max-height="400"
                      contain
                      class="rounded-lg"
                    />
                  </v-col>
                </v-row>
              </v-card-text>
            </v-card>
          </div>

          <v-alert v-else type="info" class="mt-4"> Нет полей для отображения </v-alert>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.field-content {
  max-width: 400px;
}

.field-name {
  font-weight: bold;
  margin-bottom: 4px;
}

.field-description {
  font-style: italic;
  margin-bottom: 8px;
}

.field-image {
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px;
}
</style>
