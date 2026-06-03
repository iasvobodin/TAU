<script setup lang="ts">
import { fetchFailedComponents, updateComponent } from '@/api/componentServices'
import { onMounted, computed, ref, type Ref } from 'vue'
import { fetchFailedProductionOperations } from '@/api/productionOperationServices'
import type { Component, DefectHistory, Prisma } from '../../../../shared/src'
import { useUserStore } from '@/stores/user'
import { createDefectHistory, deleteDefectHistory } from '@/api/defectHistoryServices'
import type {
  ActionType,
  ComponentAllPayload,
  DefectHistoryWithTypedAction
} from '@/assets/interfaces'
import { fetchDefectHistory, fetchDefectHistoryAll } from '@/api/defectHistoryServices'
import DefectWorkflow from '../DefectWorkflow.vue'
import DefectTable from '../DefectsTable.vue'
import { defectWorkflowMap, type DefectStage } from '@/assets/interfaces'

const failedComponents: Ref<DefectHistoryWithTypedAction[] | null> = ref(null)
const showWorkflow = ref(false)
const defectDialog = ref(false)
const comment = ref('')
const currentSN = ref('')
const hideCompleted = ref(true)

const defectWorkflowByActionType = computed(() => {
  const map = {} as Record<ActionType, (typeof defectWorkflowMap)[keyof typeof defectWorkflowMap]>
  for (const key in defectWorkflowMap) {
    const item = defectWorkflowMap[key as keyof typeof defectWorkflowMap]
    map[item.actionType] = item
  }
  return map
})
const orderedActionTypes = Object.values(defectWorkflowMap).map((v) => v.actionType)

const groupedBySN = computed(() => {
  const groups: Record<string, DefectHistoryWithTypedAction[]> = {}

  failedComponents.value?.forEach((item) => {
    const sn = item.componentSN
    if (!groups[sn]) groups[sn] = []
    groups[sn].push(item)
  })

  // Сортировка по actionType
  Object.keys(groups).forEach((sn) => {
    groups[sn].sort((a, b) => {
      const orderA = orderedActionTypes.indexOf(a.actionType)
      const orderB = orderedActionTypes.indexOf(b.actionType)
      return orderB - orderA
    })
  })

  // // Фильтрация завершённых компонентов
  // if (hideCompleted.value) {
  //   for (const sn in groups) {
  //     const typesInGroup = groups[sn].map((item) => item.actionType)
  //     const allStagesPassed = orderedActionTypes.every((t) => typesInGroup.includes(t))
  //     if (allStagesPassed) {
  //       delete groups[sn]
  //     }
  //   }
  // }

  // Фильтрация компонентов
  if (hideCompleted.value) {
    for (const sn in groups) {
      // Проверяем, есть ли в группе элемент с actionType "CloseAndReport"
      const hasClosed = groups[sn].some((item) => item.actionType === 'CloseAndReport')
      if (hasClosed) {
        delete groups[sn] // Исключаем компонент из списка
      }
    }
  }

  return groups
})

const actionTypeToStageName = computed(() => {
  const map = {} as Record<ActionType, string>
  for (const stageName in defectWorkflowMap) {
    const stage = defectWorkflowMap[stageName as keyof typeof defectWorkflowMap]
    map[stage.actionType] = stageName
  }
  return map
})

const nextStages = computed(() => {
  const result = {} as Record<string, ActionType>

  for (const [sn, defects] of Object.entries(groupedBySN.value)) {
    const current = defects[0]?.actionType as ActionType
    const next = getNextStage(current)
    if (next) result[sn] = next
  }

  return result
})

function getNextStage(current: ActionType): ActionType | null {
  const idx = orderedActionTypes.indexOf(current)
  return idx !== -1 && idx < orderedActionTypes.length - 1 ? orderedActionTypes[idx + 1] : null
}

async function advanceToNextStage(sn: string, next: ActionType) {
  console.log(`Переводим компонент ${sn} на следующий этап: ${next}`)

  if (next === 'CloseAndReport') {
    try {
      const dh = await createDefectHistory({
        componentSN: sn,
        actionType: next,
        status: 'accepted',
        user: useUserStore().userFullName,
        description: comment.value
      })
      console.log('создали дефект хистори c закрытием', dh.data)

      try {
        await updateComponent(sn, {
          status: 'accepted'
        })
        console.log('поменяли статус')
      } catch (error) {
        throw new Error('ошибка обновления компонентов')
      }
    } catch (error) {
      console.log(error)
    }
  } else {
    try {
      const dh = await createDefectHistory({
        componentSN: sn,
        actionType: next,
        status: 'on_hold',
        user: useUserStore().userFullName,
        description: comment.value
      })
      console.log('создали дефект хистори', dh.data)
    } catch (error) {
      console.log(error)
    }
  }

  await getFailedHistory()
  defectDialog.value = false
  comment.value = ''
}
const changeStage = (sn: string) => {
  currentSN.value = sn
  defectDialog.value = !defectDialog.value
}
const getFailedHistory = async () => {
  try {
    const result = await fetchDefectHistoryAll()
    failedComponents.value = result.data
  } catch (error) {
    console.log(error)
  }
}

function removeDuplicates(items: DefectHistoryWithTypedAction[]): DefectHistoryWithTypedAction[] {
  const uniqueItems: Map<string, DefectHistoryWithTypedAction> = new Map()

  items.forEach((item) => {
    const key = `${item.componentSN}-${item.status}`

    // Если еще нет такого ключа, добавляем объект в Map
    if (!uniqueItems.has(key)) {
      uniqueItems.set(key, item)
    }
  })

  // Преобразуем Map обратно в массив
  return Array.from(uniqueItems.values())
}

// // Пример использования
// const items: Item[] = [
//   // Пример объектов
// ];

function formatDate(timestamp: Date) {
  const date = new Date(timestamp)
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Функция для удаления дубликатов с удалением из базы
async function removeDuplicatesAndDelete(
  items: DefectHistoryWithTypedAction[]
): Promise<DefectHistoryWithTypedAction[]> {
  const uniqueItems: Map<string, DefectHistoryWithTypedAction> = new Map()

  for (const item of items) {
    const key = `${item.componentSN}-${item.status}`

    if (uniqueItems.has(key)) {
      // Если найден дубликат, удаляем его из базы данных
      await deleteDefectHistory(item.id)
    } else {
      // Если уникальный, добавляем в Map
      uniqueItems.set(key, item)
    }
  }

  // Преобразуем Map обратно в массив уникальных элементов
  return Array.from(uniqueItems.values())
}

// // Пример использования
// const items: DefectHistoryWithTypedAction[] = [
//   // Здесь будут объекты типа Item
// ];

async function processItems() {
  const uniqueItems = await removeDuplicatesAndDelete(failedComponents.value!)
  console.log(uniqueItems)
}

type CleanupOptions = {
  dryRun?: boolean
}

async function cleanupDuplicateDefects(
  items: DefectHistoryWithTypedAction[],
  options: CleanupOptions = { dryRun: true }
): Promise<void> {
  const { dryRun = true } = options

  const grouped = new Map<string, DefectHistoryWithTypedAction[]>()

  // ✅ Группировка по componentSN + actionType + description
  for (const item of items) {
    const normalizedDescription = (item.description ?? '').trim().toLowerCase()

    const key = `${item.componentSN}__${item.actionType}__${normalizedDescription}`

    if (!grouped.has(key)) {
      grouped.set(key, [])
    }

    grouped.get(key)!.push(item)
  }

  let totalDuplicates = 0

  console.log('=== Проверка на дубликаты ===\n')

  for (const [key, group] of grouped.entries()) {
    if (group.length <= 1) continue

    // сортируем копию массива
    const sorted = [...group].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const original = sorted[0]
    const originalId = original.id

    const duplicates = sorted.filter((item) => item.id !== originalId)

    if (duplicates.length === 0) continue

    totalDuplicates += duplicates.length

    console.log(`🔁 Найдены дубликаты для ключа: ${key}`)
    console.log(
      `Оставляем ID ${original.id} SN ${original.component?.snComponent} (${original.description} ___ ${original.actionType})`
    )

    duplicates.forEach((dup) => {
      console.log(
        `   Дубликат -> ID ${dup.id} SN ${dup.component?.snComponent} (${dup.description} ___ ${dup.actionType})`
      )
    })

    if (!dryRun) {
      for (const dup of duplicates) {
        await deleteDefectHistory(+dup.id)
      }
    }

    console.log('')
  }

  console.log('=== Итог ===')
  console.log(`Всего найдено дубликатов: ${totalDuplicates}`)
  console.log(dryRun ? 'Режим dryRun — удаление НЕ выполнялось.' : 'Удаление выполнено.')
}

onMounted(async () => {
  await getFailedHistory()
  console.log(failedComponents.value)
  // cleanupDuplicateDefects(failedComponents.value!, { dryRun: false })

  // const uniqueItems = removeDuplicates(failedComponents.value!)
  // console.log('unic', uniqueItems)

  // Запуск обработки
  // processItems();
})
</script>

<template>
  <v-container class="defect-container">
    <v-row>
      <v-col cols="3" v-if="showWorkflow">
        <!-- <DefectWorkflow /> -->
      </v-col>
      <v-col align-self="start">
        <v-row>
          <v-col>
            <h1>Работа с браком</h1>
          </v-col>
          <v-col>
            <v-checkbox
              v-model="showWorkflow"
              label="Показать этапы работы с браком"
              hide-details
              class="mb-4"
            />
          </v-col>
          <v-col>
            <v-checkbox
              v-model="hideCompleted"
              label="Скрыть завершённые компоненты (прошли все этапы)"
              hide-details
              class="mb-4"
            />
          </v-col>
        </v-row>
        <br /><br />
        <template v-if="failedComponents">
          <DefectTable :failed-components="failedComponents" />
        </template>
        <!-- <v-expansion-panels>
          <v-expansion-panel
            :color="defectWorkflowByActionType[group[0]?.actionType]?.color || '#000000'"
            v-for="(group, sn) in groupedBySN"
            :key="sn"
            class="mb-4"
          >
            <v-expansion-panel-title class="custom-title ga-12">
              <b>SN: {{ sn }}</b>
              {{ group[0]?.component?.pnComponent?.descriptionRU || sn }}
            </v-expansion-panel-title>

            <v-expansion-panel-text>
              <v-row v-for="defect in group" :key="defect.id" class="mb-2">
                <v-col>
                  <b>Этап: </b>{{ actionTypeToStageName[defect.actionType] || defect.actionType }}
                  <br />
                  <b>Комментарий: </b>{{ defect.description || '-' }}
                  <hr />
                </v-col>
                <v-col cols="4">
                  <b>Провёл: </b>{{ defect.user || '—' }} <br />
                  <b>Дата: </b>{{ formatDate(defect.timestamp) }}
                  <hr />
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12">
                  <v-btn
                    :disabled="group.length === Object.keys(defectWorkflowMap).length"
                    @click="changeStage(sn)"
                    block
                    color="gray"
                  >
                    перевести на следующий этап
                  </v-btn>
                </v-col>
              </v-row>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels> -->
      </v-col>
    </v-row>
  </v-container>
  <v-dialog v-model="defectDialog" width="auto">
    <v-card class="pa-10" justify="center" min-width="400">
      <v-container>
        <v-row justify="center">
          <v-col>
            <h3 class="text-center">
              Укажите причину перехода на следующий этап отслеживания брака
            </h3>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-textarea variant="solo" v-model="comment" clearable label="Комментарий"></v-textarea>
          </v-col>
        </v-row>
        <v-row>
          <v-col>
            <v-btn
              :disabled="!!!comment"
              v-if="nextStages[currentSN]"
              block
              :color="defectWorkflowByActionType[nextStages[currentSN]]?.color || '#000000'"
              @click="advanceToNextStage(currentSN, nextStages[currentSN])"
            >
              Перевести на этап: <b>{{ actionTypeToStageName[nextStages[currentSN]] }}</b>
            </v-btn>
          </v-col>
          <v-col v-if="actionTypeToStageName[nextStages[currentSN]] === 'Фиксация'">
            <v-btn
              :disabled="!!!comment"
              @click="advanceToNextStage(currentSN, 'CloseAndReport' as ActionType)"
              color="black"
              block
            >
              Брак не подтверждён
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.defect-container {
  /* margin-right: 1vw;
  margin-left: 1vw; */
  max-width: 90vw;
}
</style>
