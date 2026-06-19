<script setup lang="ts">
import { onMounted, ref, reactive, watch, nextTick, computed } from 'vue'
import { appConfig } from '@/assets/utils/AppConfig'
import { usePartNumberComponents } from '../../stores/partNumberComponents'
import { useSerialNumberStore } from '../../stores/serialNumberStore'
import { useErrorStore } from '@/stores/errorStore'
import { fetchSpecifications } from '@/api/specificationServices'
import { createDocWithBarcodes } from '@/assets/barcodeGenerator'
import type { ModulesType, SerialNumberData } from '@/assets/interfaces'
import { server, filesystem, os, events, window as neuWindow } from '@neutralinojs/lib'
import { generateQr } from '@/assets/generateQR'
import { getCurrentMonthYear } from '@/assets/utils/getCurrentMonthYear'
import { createYandexDiskWatcher } from '@/assets/yandexWatcher'

const props = defineProps({
  invoice: {
    type: String,
    required: true
  },
  supplier: {
    type: String,
    required: true
  }
  // selectedPartNumber:{
  //   type: String,
  //   required: true
  // }
})
const watcherYandex = ref<ReturnType<typeof createYandexDiskWatcher> | null>(null)

const QRDialog = ref(false)
const errorStore = useErrorStore()
const emit = defineEmits<{
  (e: 'someEvent', payload: SerialNumberData[]): void
}>()

const dialog = ref(false)
const dialogDelete = ref(false)
const editedIndex = ref(-1)
const PartNumberExist = ref(false)
const SerialNumber = ref<null | number>(null)
const selectedPartNumber = ref('')
const pattern = /^\d{8}(-\d{2})?$/

const headers = reactive([
  { title: '№', key: 'index', width: '5%', align: 'center' as const },
  { title: 'Серийный номер', key: 'name', width: '15%', align: 'center' as const },
  { title: 'Артикул', key: 'partNumber', width: '10%', align: 'center' as const },
  { title: 'Инвойс', key: 'invoice', width: '10%', align: 'center' as const },
  { title: 'Поставщик', key: 'supplier', width: '10%', align: 'center' as const },
  { title: 'Комментарий', key: 'comment', width: '30%', align: 'center' as const },
  { title: 'Брак', key: 'status', width: '5%', align: 'center' as const },
  { title: 'Удалить', key: 'actions', width: '5%', align: 'center' as const },
  { title: 'Фото', key: 'photo', width: '5%', align: 'center' as const }
])

const defaultItem: SerialNumberData = reactive({ name: '', partNumber: '' })
const editedItem = reactive({ ...defaultItem })

const serialNumberStore = useSerialNumberStore()

watch(dialog, (val) => {
  if (!val) closeDialog()
})
watch(dialogDelete, (val) => {
  if (!val) closeDialogDelete()
})
watch(QRDialog, (val) => {
  if (!val) {
    errorStore.clearInfo()
    watcherYandex.value?.stop()
  }
})

const closeDialog = () => {
  dialog.value = false
  nextTick(resetEditedItem)
}

const closeDialogDelete = () => {
  dialogDelete.value = false
  nextTick(resetEditedItem)
}

const resetEditedItem = () => {
  Object.assign(editedItem, defaultItem)
  editedIndex.value = -1
}

const saveItem = () => {
  if (editedIndex.value > -1) {
    Object.assign(serialNumberStore.sNumbers[editedIndex.value], editedItem)
  } else {
    serialNumberStore.sNumbers.push({ ...editedItem })
  }
  closeDialog()
}

const deleteItem = (item: SerialNumberData) => {
  editedIndex.value = serialNumberStore.sNumbers.indexOf(item)
  serialNumberStore.sNumbers.splice(editedIndex.value, 1)
}

const emitData = () => {
  emit('someEvent', serialNumberStore.sNumbers)
}

const checkSerialNumber = ($event: Event) => {
  console.log(serialNumberStore.sNumbers)

  const target = $event.target as HTMLTextAreaElement
  {
    // if ((target.value.length === 8 || target.value.length === 11) && pattern.test(target.value)) {
    if (!props.invoice || !props.supplier) {
      errorStore.addError('Необходимо заполнить все поля')
      setTimeout(errorStore.removeError, 5000)
      SerialNumber.value = null
    }
    SerialNumber.value &&
      serialNumberStore.addSerialNumber({
        name: target.value,
        partNumber: selectedPartNumber.value.split(' ')[0],
        invoice: props.invoice,
        supplier: props.supplier
      })
    SerialNumber.value = null
    // }
  }
}

type Barcodes = {
  barcode: string
  productName: string
  partNumber: string
  type: ModulesType
}

const tryToPrint = async () => {
  const result = await fetchSpecifications()

  const results = <Array<Barcodes>>[]
  console.log(result.data, 'result.data')

  result.data?.forEach((j) => {
    serialNumberStore.sNumbers.forEach((e) => {
      if (j.electronicBoard1 === e.partNumber || j.electronicBoard2 === e.partNumber) {
        console.log(j.productName, 'j.productName')

        results.push({
          barcode:
            j.type === 'Modules'
              ? //ПОТОМ ПЕРЕДЕЛАТЬ!!!!!!
                `${e.name.endsWith('-01') || e.name.endsWith('-02') ? e.name.slice(0, -3) : e.name}`
              : e.name.endsWith('-01') || e.name.endsWith('-02')
                ? e.name.slice(0, -3)
                : e.name,
          partNumber: j.productMP,
          productName: j.productName,
          type: j.type as ModulesType
        })
      }
    })
  })

  console.log(results)

  await createDocWithBarcodes(results)
}

onMounted(async () => {
  // try {
  //   if (!usePartNumberComponents().partNumberComponents) {
  //     await usePartNumberComponents().getPartNumberComponents()
  //   }
  // } catch (error) {
  //   console.error(error)
  //   PartNumberExist.value = true
  // }
})

serialNumberStore.$subscribe(async (isDuplicate, state) => {
  if (state.isDuplicate) {
    errorStore.addError('Серийный номер дублирован!')
    setTimeout(errorStore.removeError, 5000)
    state.isDuplicate = false
  }
})

const rowProps = ({ item }: { item: SerialNumberData }) => {
  // console.log(item)

  return {
    class: {
      'red-row': item.status
    }
  }
}
// Вычисляемое свойство для блокировки кнопки
const isAddButtonDisabled = computed(() => {
  return (
    serialNumberStore.sNumbers.length === 0 ||
    serialNumberStore.sNumbers.some((item: SerialNumberData) => item.status && !item.comment)
  )
})
const openFile = async () => {
  const okDir = appConfig.paths.ok.replace(/\//g, '\\')
  os.execCommand(`explorer "${okDir}\\ОК МП-ТАУ-001-24 Входной контроль.pdf"`)
}
const folder = getCurrentMonthYear()
const baseFolder = `Системы ТАУ - Общее/Фото ТАУ контроль/${folder}`

const qrurl = ref('')
const createQR = async (item: SerialNumberData) => {
  errorStore.addInfo('не закрывайте QR пока фотографии не будут загружены')
  watcherYandex.value = createYandexDiskWatcher({
    token: 'y0__xCzv6qkqveAAhiE-Tkg5JKEohRMzx8UgKzBxwhK0dcYxPQ-v_tAJA', // OAuth токен
    path: baseFolder, // папка для отслеживания
    intervalSec: 2,
    autoDownload: true, // автоматически скачивать файлы
    localDir: './uploads', // локальная папка
    onChange: async (newFiles) => {
      newFiles.forEach((f) => {
        // гарантируем, что photos — это массив
        console.log('from onChange')

        if (!Array.isArray(item.photos)) {
          item.photos = []
        }

        if (!item.photos.includes(f.name)) {
          item.photos.push(f.name)
          serialNumberStore.updateSerialNumber(item.name, { photos: item.photos })
        }
      })

      errorStore.addInfo(`добавлен файл ${newFiles.map((f) => f.name)}`)
      console.log(
        '🔥 Появились новые файлы:',
        newFiles.map((f) => f.name)
      )
    },
    onError: (err) => {
      console.error('Ошибка в watcher:', err)
    }
  })

  qrurl.value = await generateQr(item)
  QRDialog.value = true
}

const showClearButton = ref(false)

const onAddClick = () => {
  emitData()
  showClearButton.value = true // показать кнопку очистки
}

const clearTable = () => {
  serialNumberStore.sNumbers = [] // очистить данные
  showClearButton.value = false // скрыть кнопку
}
</script>

<template>
  <v-snackbar v-model="PartNumberExist" timeout="3000">
    Ошибка получения данных
    <template v-slot:actions>
      <v-btn color="blue" variant="text" @click="PartNumberExist = false">Close</v-btn>
    </template>
  </v-snackbar>
  <v-container class="pt-1" grid-list-sm>
    <v-row align="center">
      <v-col class="pa-1">Артикул (тип)</v-col>
      <v-col class="pa-1">
        <v-autocomplete
          density="compact"
          hide-details="auto"
          v-model="selectedPartNumber"
          clearable
          label="Артикул, описание"
          :items="usePartNumberComponents().listPartNumbers"
          variant="solo"
        ></v-autocomplete>
      </v-col>
    </v-row>
    <v-row align="center" justify="center">
      <v-col>
        <h4 class="text-center">Сканируйте серийный номер компонента</h4>
      </v-col>
    </v-row>
    <v-row align="center" justify="center">
      <v-col cols="10">
        <v-text-field
          density="compact"
          clearable
          :disabled="!selectedPartNumber"
          @keyup.enter="checkSerialNumber"
          v-model="SerialNumber"
          :focused="true"
          label="SN"
          variant="solo"
          maxlength="13"
        ></v-text-field>
      </v-col>
    </v-row>
    <!-- :rules="[(value) => pattern.test(value) || 'Только цифры']" -->
  </v-container>
  <teleport to="body"> </teleport>
  <v-data-table-virtual
    :sort-by="[{ key: 'index', order: 'asc' }]"
    height="35vh"
    :headers="headers"
    density="compact"
    :items="serialNumberStore.sNumbers"
    :row-props="rowProps"
  >
    <template v-slot:item.index="{ index }">
      {{ index + 1 }}
    </template>
    <template v-slot:item.status="{ item }">
      <v-checkbox hide-details v-model="item.status"></v-checkbox>
    </template>
    <template v-slot:item.comment="{ item }">
      <v-textarea
        variant="solo"
        v-model="item.comment"
        rows="1"
        auto-grow
        hide-details
        density="compact"
        class="text-center centered-textarea"
      ></v-textarea>
    </template>
    <template v-slot:item.supplier="{ item }">
      <p class="text-red" v-if="!item.supplier">ЗАПОЛНИТЬ</p>
      <p v-else>{{ item.supplier }}</p>
    </template>
    <template v-slot:item.invoice="{ item }">
      <p class="text-red" v-if="!item.invoice">ЗАПОЛНИТЬ</p>
      <p v-else>{{ item.invoice }}</p>
    </template>

    <template v-slot:item.actions="{ item }">
      <v-icon size="small" @click="deleteItem(item)">mdi-delete</v-icon>
      <v-icon v-if="item._added" icon="mdi-checkbox-marked-circle" color="green"></v-icon>
      <v-icon v-if="item._rejected" icon="mdi-cancel" color="red"></v-icon>
    </template>
    <template v-slot:item.photo="{ item }">
      <v-icon size="small" @click="createQR(item)">mdi-paperclip</v-icon>
    </template>
  </v-data-table-virtual>

  <v-container>
    <v-row v-if="isAddButtonDisabled && serialNumberStore.sNumbers.length !== 0">
      <v-col>
        <h4 class="text-center text-red">Заполните комментарий у бракованного компонента</h4>
      </v-col>
    </v-row>
    <v-row justify="center">
      <v-col>
        <v-btn :disabled="isAddButtonDisabled" color="green-lighten-3" @click="onAddClick" block>
          Добавить
        </v-btn>

        <v-btn color="red-lighten-3" class="mt-2" @click="clearTable" block>
          Очистить таблицу
        </v-btn>
      </v-col>

      <!-- <v-col cols="12" md="6" sm="6">
        <v-btn :disabled="serialNumberStore.sNumbers.length===0" @click="emitData" text="Добавить" rounded="lg" size="x-large" block></v-btn>
      </v-col> -->
    </v-row>
  </v-container>
  <v-dialog v-model="QRDialog" width="auto">
    <v-card class="pa-0" justify="center">
      <v-container>
        <v-row>
          <v-col>
            <img :src="qrurl" alt="QR" />
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </v-dialog>
</template>

<style>
.red-row {
  background-color: rgba(255, 0, 0, 0.123);
}
.centered-textarea {
  display: flex;
  justify-content: center; /* Центрирование по горизонтали */
  width: 100%; /* Убедимся, что контейнер занимает всю ширину ячейки */
}

.centered-textarea textarea {
  text-align: center; /* Сохраняем центрирование текста внутри textarea */
  max-width: 100%; /* Ограничиваем ширину поля */
}
</style>
