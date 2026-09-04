<template>
  <div class="autofill-overlay">
    <div class="autofill-modal">
      <h3>Автозаполнение ячеек</h3>
      <p class="autofill-hint">
        Заполняет ячейки последовательно, начиная с выбранной.
        <br />Всего ячеек в таблице: <strong>{{ totalCells }}</strong>
      </p>

      <div class="autofill-form">
        <label class="autofill-field">
          <span>Количество ячеек для заполнения</span>
          <input
            v-model.number="count"
            type="number"
            min="1"
            :max="totalCells"
            class="autofill-input"
          />
        </label>

        <div class="autofill-field">
          <span>Направление заполнения</span>
          <div class="autofill-direction">
            <button
              :class="['dir-btn', { 'dir-btn--active': direction === 'row' }]"
              @click="direction = 'row'"
              title="По строкам (→ затем ↓)"
            >
              <v-icon size="14">mdi-arrow-right-bold</v-icon>
              <span>По строкам</span>
            </button>
            <button
              :class="['dir-btn', { 'dir-btn--active': direction === 'col' }]"
              @click="direction = 'col'"
              title="По столбцам (↓ затем →)"
            >
              <v-icon size="14">mdi-arrow-down-bold</v-icon>
              <span>По столбцам</span>
            </button>
          </div>
        </div>

        <label class="autofill-field">
          <span>Значение</span>
          <input
            v-model="value"
            type="text"
            class="autofill-input"
            placeholder="например: 001, 1, СОК"
          />
        </label>

        <label class="autofill-field">
          <span>Префикс (необязательно)</span>
          <input v-model="prefix" type="text" class="autofill-input" placeholder="пре" />
        </label>

        <label class="autofill-field">
          <span>Суффикс (необязательно)</span>
          <input v-model="suffix" type="text" class="autofill-input" placeholder="икс" />
        </label>
      </div>

      <div class="autofill-preview">
        <strong>Предпросмотр:</strong>
        <code>{{ preview }}</code>
      </div>

      <div class="autofill-actions">
        <button class="btn btn--primary" :disabled="!count || count < 1" @click="doFill">
          Заполнить {{ count }} ячеек
        </button>
        <button class="btn" @click="$emit('close')">Отмена</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useLabelEditorStore } from '@/stores/labelEditor'

const props = defineProps<{
  tableId: string
  startCellId: string
}>()

const emit = defineEmits<{
  close: []
}>()

const store = useLabelEditorStore()

const tableEl = computed(() => store.elements[props.tableId])
const cellIds = computed(() => tableEl.value?.props?.tableCellIds ?? [])
const totalCells = computed(() => cellIds.value.flat().filter(Boolean).length)

const count = ref(Math.min(10, totalCells.value))
const value = ref('1')
const prefix = ref('')
const suffix = ref('')
const direction = ref<'row' | 'col'>('row')

// Определяем формат: если значение начинается с 0 и состоит из цифр — leading-zero
function detectFormat(v: string): { isNumeric: boolean; leadingZeros: number; step: number } {
  const trimmed = v.trim()
  if (/^\d+$/.test(trimmed)) {
    const leadingZeros = trimmed.match(/^0+/)?.[0]?.length ?? 0
    return { isNumeric: true, leadingZeros, step: 1 }
  }
  return { isNumeric: false, leadingZeros: 0, step: 0 }
}

function formatValue(raw: string, index: number): string {
  const fmt = detectFormat(raw)
  const trimmed = raw.trim()

  if (fmt.isNumeric) {
    const num = parseInt(trimmed, 10) + index * fmt.step
    if (fmt.leadingZeros > 0) {
      return String(num).padStart(trimmed.length, '0')
    }
    return String(num)
  }

  // Строка — повторяем как есть
  return trimmed
}

const preview = computed(() => {
  const items: string[] = []
  for (let i = 0; i < Math.min(count.value, 5); i++) {
    const v = formatValue(value.value, i)
    items.push(`${prefix.value}${v}${suffix.value}`)
  }
  const more = count.value > 5 ? ` … ещё ${count.value - 5}` : ''
  return items.join(', ') + more
})

function doFill() {
  // Найти стартовую позицию в матрице cellIds
  const meta = store.elements[props.startCellId]?.props?.tableCellMeta
  if (!meta) return

  const matrix = cellIds.value
  const maxRows = matrix.length
  const maxCols = maxRows > 0 ? matrix[0].length : 0
  let row = meta.row
  let col = meta.col
  let filled = 0

  for (let i = 0; i < count.value; i++) {
    if (row >= maxRows || col >= maxCols) break

    const cellId = matrix[row]?.[col]
    if (cellId && store.elements[cellId]) {
      const v = formatValue(value.value, filled)
      store.elements[cellId].props.customText = `${prefix.value}${v}${suffix.value}`
      filled++
    }

    if (direction.value === 'col') {
      // По столбцам: ↓ затем →
      row++
      if (row >= maxRows) {
        col++
        row = 0
      }
    } else {
      // По строкам: → затем ↓
      col++
      if (col >= maxCols) {
        row++
        col = 0
      }
    }
  }

  emit('close')
}
</script>

<style scoped>
.autofill-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.autofill-modal {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  width: 500px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.autofill-modal h3 {
  margin: 0 0 8px;
  font-size: 16px;
  color: #222;
}
.autofill-hint {
  margin: 0 0 16px;
  font-size: 12px;
  color: #666;
  line-height: 1.4;
}
.autofill-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}
.autofill-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #444;
}
.autofill-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}
.autofill-input:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 2px rgba(25, 118, 210, 0.15);
}
.autofill-preview {
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 12px;
  color: #444;
  margin-bottom: 16px;
}
.autofill-preview code {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  color: #1976d2;
  word-break: break-all;
}
.autofill-direction {
  display: flex;
  gap: 6px;
}
.dir-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  color: #555;
  transition:
    background 0.1s,
    border-color 0.1s,
    color 0.1s;
}
.dir-btn:hover {
  background: #e8f0fb;
  border-color: #90b8e8;
  color: #1565c0;
}
.dir-btn--active {
  background: #ccdff5;
  border-color: #5a96cc;
  color: #0d47a1;
  font-weight: 600;
}
.autofill-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
.btn {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.btn--primary:disabled {
  background: #ccc;
  border-color: #ccc;
  cursor: default;
}
</style>
