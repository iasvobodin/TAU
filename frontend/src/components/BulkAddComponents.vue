<template>
  <div class="bulk-add">
    <h3>Массовое добавление компонентов</h3>

    <div class="form">
      <input v-model="partNumber" placeholder="Артикул (partNumber)" class="input" />

      <input v-model="supplier" placeholder="Поставщик (supplier)" class="input" />

      <input v-model="invoice" placeholder="Инвойс (invoice)" class="input" />

      <textarea
        v-model="serialsText"
        placeholder="Серийные номера (каждый с новой строки)"
        class="textarea"
      />

      <button @click="send" :disabled="loading" class="button">
        {{ loading ? 'Отправка...' : 'Добавить' }}
      </button>
    </div>

    <div v-if="status" class="status">
      {{ status }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createComponents } from '@/api/componentServices'
import { useUserStore } from '@/stores/user'

const partNumber = ref('')
const supplier = ref('')
const invoice = ref('')
const serialsText = ref('')
const loading = ref(false)
const status = ref('')

const send = async () => {
  if (!partNumber.value || !supplier.value || !invoice.value || !serialsText.value) {
    status.value = 'Заполни все поля'
    return
  }

  loading.value = true
  status.value = ''

  try {
    const serials = serialsText.value
      .split(/[\n,;\t]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const payload = serials.map((sn) => ({
      snComponent: sn,
      pnComponentId: partNumber.value,
      supplier: supplier.value,
      invoice: invoice.value,
      status: 'passed',
      comment: '{}',
      user: useUserStore().userFullName
    }))

    const result = await createComponents(payload)

    let success = 0
    let failed = 0

    result.forEach((r) => {
      if (r.error) failed++
      else success++
    })

    status.value = `Добавлено: ${success}, Ошибки: ${failed}`

    if (success > 0) {
      serialsText.value = ''
    }
  } catch (e) {
    console.error(e)
    status.value = 'Ошибка при отправке'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.bulk-add {
  max-width: 500px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.input,
.textarea {
  padding: 8px;
  font-size: 14px;
}

.textarea {
  min-height: 150px;
  resize: vertical;
}

.button {
  padding: 10px;
  cursor: pointer;
}

.status {
  margin-top: 10px;
}
</style>
