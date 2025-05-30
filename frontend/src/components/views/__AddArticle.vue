<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePartNumberComponents } from '../../stores/partNumberComponents'
import { useSerialNumberStore } from '../../stores/serialNumberStore'
import { useErrorStore } from '@/stores/errorStore'
import { fetchSpecifications } from '@/api/specificationServices'
import { createDocWithBarcodes } from '@/assets/barcodeGenerator'
import type { ModulesType, SerialNumberData } from '@/assets/interfaces'

// Интерфейс для баркодов
interface Barcode {
  barcode: string
  productName: string
  partNumber: string
  type: ModulesType
}

// Интерфейс для заголовков таблицы, соответствующий Vuetify
interface TableHeader {
  title: string
  key: string
  width?: string
  align?: 'start' | 'center' | 'end'
}

// Определение пропсов компонента
const props = defineProps<{
  invoice: string
  supplier: string
}>()

// Определение событий компонента
const emit = defineEmits<{
  (e: 'submit', payload: SerialNumberData[]): void
}>()

// Инициализация хранилищ
const errorStore = useErrorStore()
const serialNumberStore = useSerialNumberStore()
const partNumberStore = usePartNumberComponents()

// Реактивные состояния
const selectedPartNumber = ref<string>('')
const serialNumberInput = ref<string | null>(null)
const isPartNumberFetchError = ref(false)
const pattern = /^\d{8}(-\d{2})?$/ // Регулярное выражение для валидации серийного номера

// Заголовки таблицы с правильной типизацией align
const tableHeaders: TableHeader[] = [
  { title: 'Серийный номер', key: 'name', width: '20%', align: 'center' },
  { title: 'Артикул', key: 'partNumber', width: '20%', align: 'center' },
  { title: 'Инвойс', key: 'invoice', width: '20%', align: 'center' },
  { title: 'Поставщик', key: 'supplier', width: '20%', align: 'center' },
  { title: 'Действия', key: 'actions', width: '20%', align: 'center' }
]

// Вычисляемое свойство для списка серийных номеров
const serialNumbers = computed(() => serialNumberStore.sNumbers)

// Инициализация данных при монтировании компонента
onMounted(async () => {
  await loadPartNumbers()
  subscribeToDuplicates()
})

// Загрузка артикулов
async function loadPartNumbers() {
  try {
    if (!partNumberStore.partNumberComponents) {
      await partNumberStore.getPartNumberComponents()
    }
  } catch (error) {
    console.error('Ошибка загрузки артикулов:', error)
    isPartNumberFetchError.value = true
  }
}

// Подписка на обнаружение дубликатов серийных номеров
function subscribeToDuplicates() {
  serialNumberStore.$subscribe((_, state) => {
    if (state.isDuplicate) {
      showError('Серийный номер дублирован!')
      state.isDuplicate = false
    }
  })
}

// Показ ошибки с таймером
function showError(message: string) {
  errorStore.addError(message)
  setTimeout(() => errorStore.removeError(), 5000)
}

// Валидация и добавление серийного номера
function handleSerialNumberInput(event: Event) {
  const input = (event.target as HTMLInputElement).value
  if (!props.invoice || !props.supplier || !selectedPartNumber.value) {
    showError('Заполните все обязательные поля')
    serialNumberInput.value = null
    return
  }
  if (input && pattern.test(input)) {
    serialNumberStore.addSerialNumber({
      name: input,
      partNumber: selectedPartNumber.value.split(' ')[0],
      invoice: props.invoice,
      supplier: props.supplier
    })
    serialNumberInput.value = null
  } else {
    showError('Некорректный формат серийного номера')
    serialNumberInput.value = null
  }
}

// Удаление серийного номера
function removeSerialNumber(item: SerialNumberData) {
  const index = serialNumberStore.sNumbers.indexOf(item)
  if (index !== -1) {
    serialNumberStore.sNumbers.splice(index, 1)
  }
}

// Отправка данных через событие
function submitData() {
  if (serialNumbers.value.length === 0) {
    showError('Нет данных для отправки')
    return
  }
  emit('submit', serialNumbers.value)
}

// Генерация документа с баркодами
async function generateBarcodes() {
  try {
    const specs = await fetchSpecifications()
    const barcodes: Barcode[] = []

    specs.data?.forEach((spec) => {
      serialNumberStore.sNumbers.forEach((serial) => {
        if (
          spec.electronicBoard1 === serial.partNumber ||
          spec.electronicBoard2 === serial.partNumber
        ) {
          const barcode =
            serial.name.endsWith('-01') || serial.name.endsWith('-02')
              ? serial.name.slice(0, -3)
              : serial.name
          barcodes.push({
            barcode,
            partNumber: spec.productMP,
            productName: spec.productName,
            type: spec.type as ModulesType
          })
        }
      })
    })

    if (barcodes.length === 0) {
      showError('Нет данных для генерации баркодов')
      return
    }

    await createDocWithBarcodes(barcodes)
  } catch (error) {
    console.error('Ошибка генерации баркодов:', error)
    showError('Не удалось сгенерировать баркоды')
  }
}
</script>

<template>
  <!-- Уведомление об ошибке загрузки артикулов -->
  <v-snackbar v-model="isPartNumberFetchError" timeout="3000">
    Ошибка загрузки данных
    <template #actions>
      <v-btn color="blue" variant="text" @click="isPartNumberFetchError = false">Закрыть</v-btn>
    </template>
  </v-snackbar>

  <!-- Основной контейнер -->
  <v-container class="pa-4">
    <!-- Выбор артикула -->
    <v-row align="center" class="mb-4">
      <v-col cols="12" sm="3">
        <span class="text-subtitle-1">Артикул (тип)</span>
      </v-col>
      <v-col cols="12" sm="9">
        <v-autocomplete
          v-model="selectedPartNumber"
          :items="partNumberStore.listPartNumbers"
          label="Артикул, описание"
          variant="solo"
          density="compact"
          clearable
          hide-details
        />
      </v-col>
    </v-row>

    <!-- Ввод серийного номера -->
    <v-row justify="center" class="mb-4">
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="serialNumberInput"
          label="Серийный номер"
          variant="solo"
          density="compact"
          clearable
          :disabled="!selectedPartNumber"
          @keyup.enter="handleSerialNumberInput"
          maxlength="13"
          autofocus
        />
      </v-col>
    </v-row>

    <!-- Таблица серийных номеров -->
    <v-data-table-virtual
      :headers="tableHeaders"
      :items="serialNumbers"
      density="compact"
      height="40vh"
      :sort-by="[{ key: 'name', order: 'asc' }]"
    >
      <!-- Отображение поставщика -->
      <template #item.supplier="{ item }">
        <span class="text-red" v-if="!item.supplier">ЗАПОЛНИТЬ</span>
        <span v-else>{{ item.supplier }}</span>
      </template>

      <!-- Отображение инвойса -->
      <template #item.invoice="{ item }">
        <span class="text-red" v-if="!item.invoice">ЗАПОЛНИТЬ</span>
        <span v-else>{{ item.invoice }}</span>
      </template>

      <!-- Действия -->
      <template #item.actions="{ item }">
        <v-icon size="small" @click="removeSerialNumber(item)">mdi-delete</v-icon>
        <v-icon v-if="item._added" icon="mdi-checkbox-marked-circle" color="green" />
        <v-icon v-if="item._rejected" icon="mdi-cancel" color="red" />
      </template>
    </v-data-table-virtual>

    <!-- Кнопки управления -->
    <v-row justify="center" class="mt-4">
      <v-col cols="12" sm="6">
        <v-btn
          color="green-lighten-3"
          :disabled="serialNumbers.length === 0"
          @click="submitData"
          block
        >
          Добавить
        </v-btn>
      </v-col>
      <v-col cols="12" sm="6">
        <v-btn color="yellow-lighten-3" @click="generateBarcodes" block> Баркоды </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>
