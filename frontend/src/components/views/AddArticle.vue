<script setup lang="ts">
import { onMounted, ref, reactive, watch, nextTick, computed } from 'vue'
import { usePartNumberComponents } from '../../stores/partNumberComponents'
import { useSerialNumberStore } from '../../stores/serialNumberStore'
import { useErrorStore } from '@/stores/errorStore'
import { fetchSpecifications } from '@/api/specificationServices'
import { createDocWithBarcodes } from '@/assets/generateBarcodeV2'
import type { ModulesType, SerialNumberData } from '@/assets/interfaces'
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
  { title: 'Серийный номер', key: 'name', width: '20%', align: 'center' as const },
  { title: 'Артикул', key: 'partNumber', width: '20%', align: 'center' as const },
  { title: 'Инвойс', key: 'invoice', width: '20%', align: 'center' as const },
  { title: 'Поставщик', key: 'supplier', width: '20%', align: 'center' as const },
  { title: 'Удалить', key: 'actions', width: '20%', align: 'center' as const }
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
      <v-col>
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
    :sort-by="[{ key: 'name', order: 'asc' }]"
    height="40vh"
    :headers="headers"
    density="compact"
    :items="serialNumberStore.sNumbers"
  >
    <!-- eslint-disable-next-line vue/valid-v-slot -->
    <template v-slot:item.supplier="{ item }">
      <p class="text-red" v-if="!item.supplier">ЗАПОЛНИТЬ</p>
      <p v-else>{{ item.supplier }}</p>
    </template>
    <!-- eslint-disable-next-line vue/valid-v-slot -->
    <template v-slot:item.invoice="{ item }">
      <p class="text-red" v-if="!item.invoice">ЗАПОЛНИТЬ</p>
      <p v-else>{{ item.invoice }}</p>
    </template>
    <!-- eslint-disable-next-line vue/valid-v-slot -->
    <template v-slot:item.actions="{ item }">
      <v-icon size="small" @click="deleteItem(item)">mdi-delete</v-icon>
      <v-icon v-if="item._added" icon="mdi-checkbox-marked-circle" color="green"></v-icon>
      <v-icon v-if="item._rejected" icon="mdi-cancel" color="red"></v-icon>
    </template>
  </v-data-table-virtual>
  <v-container>
    <v-row justify="center">
      <v-col>
        <v-btn
          :disabled="serialNumberStore.sNumbers.length === 0"
          color="green-lighten-3"
          @click="emitData"
          block
          >Добавить</v-btn
        >
        <v-btn color="yellow-lighten-3" @click="tryToPrint">Баркоды</v-btn>
      </v-col>

      <!-- <v-col cols="12" md="6" sm="6">
        <v-btn :disabled="serialNumberStore.sNumbers.length===0" @click="emitData" text="Добавить" rounded="lg" size="x-large" block></v-btn>
      </v-col> -->
    </v-row>
  </v-container>
</template>
