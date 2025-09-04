<script setup lang="ts">
import { onBeforeUnmount, ref, watch, computed } from 'vue'
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
import { storage } from '@neutralinojs/lib'
// Тип для поля шаблона
interface ChecklistField {
  name: string
  type?: 'text' | 'checkbox' // type опционален для обратной совместимости
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
// Парсим строку шаблона
const template = ref<ChecklistTemplate>({ title: '', fields: [] })
const values = ref<ChecklistValues>({})

// watch(
//   () => props.templateString,
//   (newVal) => {
//     console.log(newVal, 'новое значение в шаблоне чеклиста')
//     try {
//       template.value = JSON.parse(newVal)
//       // Инициализируем значения для полей
//       template.value.fields.forEach((field) => {
//         values.value[field.name] = {
//           status: null,
//           comment: ''
//         }
//       })
//     } catch (e) {
//       console.error('Invalid template string:', e)
//     }
//   },
//   { immediate: true }
// )

watch(
  () => props.templateString,
  (newVal) => {
    // console.log(typeof newVal,'newVal',newVal);
    if (newVal === '') {
      return
    }
    try {
      const parsed = JSON.parse(newVal)

      // Проверим, есть ли поля с status/comment — значит пришли заполненные данные
      const hasStatus = parsed.fields.some((f: any) => 'status' in f)

      if (hasStatus) {
        // Заполняем template и values отдельно
        template.value = {
          title: parsed.title,
          fields: parsed.fields.map((f: any) => ({ name: f.name })) // только имена в шаблон
        }
        values.value = {}
        parsed.fields.forEach((f: any) => {
          values.value[f.name] = {
            status: f.status ?? null,
            comment: f.comment ?? ''
          }
        })
      } else {
        // Просто шаблон без значений
        template.value = parsed
        values.value = {}
        parsed.fields.forEach((field: any) => {
          values.value[field.name] = {
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

watch(
  () => values.value,
  (newVal) => {
    console.log('breberb', isSaveDisabled.value)

    // const allFieldsFilled = template.value.fields.every(
    //   (field) =>
    //     values.value[field.name]?.status === 'pass' || values.value[field.name]?.status === 'fail'
    // )
    saveChecklist(isSaveDisabled.value)
  },
  { deep: true }
)

// Сохранение заполненного чек-листа
const saveChecklist = (ss: boolean) => {
  const checklistData = {
    title: template.value.title,
    values: values.value
  }
  const checklistString = JSON.stringify(checklistData)

  emit('checkList', { checklistString, ss })
  // Здесь можно отправить checklistString на сервер
  // Например: await fetch('/api/save-checklist', { method: 'POST', body: checklistString });
}
const saveChecklistLocal = async () => {
  const checklistData = {
    title: template.value.title,
    values: values.value
  }
  const checklistString = JSON.stringify(checklistData)

  await storage.setData(`checkList_${props.sn}`, checklistString)
  console.log('checklist saved')
}
onBeforeUnmount(() => {
  console.log('ЗАМОНТИРОВАЛИ!!!!!!!!!!')
  saveChecklistLocal()
})
</script>

<template>
  <v-card border="red" class="ma-0">
    <v-row
      ><v-col>
        <h3>ЧЕК ЛИСТ</h3>
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
    <!-- <v-card-title><b>ЧЕК ЛИСТ</b></v-card-title> -->
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
      <v-spacer></v-spacer>
      <!-- <v-row>
        
        <v-col>
             <v-btn block color="success" @click="saveChecklist" :disabled="isSaveDisabled">
        Сохранить чеклист
      </v-btn>
        </v-col>
        <v-col>
             <v-btn block color="orange" @click="saveChecklistLocal" >
        Временно сохранить 
      </v-btn>
        </v-col>
      </v-row> -->
    </v-card-text>
  </v-card>
</template>
