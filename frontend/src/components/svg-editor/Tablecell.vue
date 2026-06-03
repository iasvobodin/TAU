<template>
  <td :style="tdStyle" @click="onTdClick">
    <div :style="wrapperStyle">
      <div
        ref="editRef"
        contenteditable="true"
        spellcheck="false"
        :style="editStyle"
        class="label-cell-edit"
        @input="onInput"
        @keydown="onKeyDown"
        @focus="store.selectedCell = { row, col }"
        @blur="syncToStore"
      />
    </div>
  </td>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import type { CSSProperties } from 'vue'
import { storeToRefs } from 'pinia'
import { useSvgEditorStore } from '@/stores/svgEditor'
import { MM_TO_PX } from '../../types/svg'
import type { CellData } from '../../types/svg'

const props = defineProps<{
  cell: CellData
  row: number
  col: number
}>()

const store = useSvgEditorStore()
const { settings, selectedCell, fontLoaded } = storeToRefs(store)
const editRef = ref<HTMLDivElement | null>(null)

const isSelected = computed(
  () => selectedCell.value?.row === props.row && selectedCell.value?.col === props.col
)

// ─── td: фиксированный размер, border через outline чтобы не влиять на box-size
const tdStyle = computed<CSSProperties>(() => {
  const w = settings.value.cellWidthMm * MM_TO_PX
  const h = settings.value.cellHeightMm * MM_TO_PX
  const ph = (settings.value.cellPaddingHorizontalMm * MM_TO_PX) / 2
  const pv = (settings.value.cellPaddingVerticalMm * MM_TO_PX) / 2
  return {
    width: `${w}px`,
    height: `${h}px`,
    minWidth: `${w}px`,
    minHeight: `${h}px`,
    padding: `${pv}px ${ph}px`,
    // outline не влияет на box-model — размер ячейки не меняется
    outline: settings.value.showBorders ? '1px solid rgba(0,0,0,0.2)' : 'none',
    outlineOffset: '-1px',
    position: 'relative',
    boxSizing: 'content-box',
    cursor: 'text'
  }
})

// ─── wrapper: flex-контейнер точно по размеру ячейки
// Выравнивание текста через flex — никаких padding расчётов
const wrapperStyle = computed<CSSProperties>(() => {
  const w = settings.value.cellWidthMm * MM_TO_PX
  const h = settings.value.cellHeightMm * MM_TO_PX

  const alignItems =
    props.cell.verticalAlignment === 'top'
      ? 'flex-start'
      : props.cell.verticalAlignment === 'bottom'
        ? 'flex-end'
        : 'center'

  return {
    position: 'absolute',
    top: '0',
    left: '0',
    width: `${w}px`,
    height: `${h}px`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch', // edit div растягивается по ширине
    justifyContent: alignItems, // вертикальное выравнивание
    overflow: 'hidden',
    boxSizing: 'border-box',
    border: isSelected.value ? '1px solid rgb(var(--v-theme-primary))' : '1px solid transparent'
  }
})

// ─── редактируемый div: только шрифт и горизонтальное выравнивание
const editStyle = computed<CSSProperties>(() => {
  const fsPx = props.cell.fontSizeMm * MM_TO_PX
  const lhPx = fsPx * props.cell.lineHeightMultiplier
  return {
    fontSize: `${fsPx}px`,
    fontFamily: fontLoaded.value ? 'customFont' : 'sans-serif',
    letterSpacing: `${props.cell.letterSpacing}px`,
    lineHeight: `${lhPx}px`,
    textAlign: props.cell.horizontalAlignment,
    padding: '0',
    margin: '0',
    outline: 'none',
    background: 'transparent',
    color: '#000',
    caretColor: '#000',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    userSelect: 'text',
    WebkitUserSelect: 'text',
    cursor: 'text',
    // flex child: не растягивается больше чем нужно по высоте
    flexShrink: '0'
  }
})

// ─── Store → DOM ─────────────────────────────────────────────────────────────
watch(
  () => props.cell.text,
  (val) => {
    const el = editRef.value
    if (!el || el.innerText === val) return
    const hadFocus = document.activeElement === el
    el.innerText = val
    if (hadFocus) {
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    }
  },
  { immediate: true }
)

// ─── DOM → Store ─────────────────────────────────────────────────────────────
const onInput = () => {
  const el = editRef.value
  if (!el) return
  props.cell.text = el.innerText
  store.recalcCell(props.row, props.col)
}

const syncToStore = () => {
  const el = editRef.value
  if (!el) return
  props.cell.text = el.innerText
  store.recalcCell(props.row, props.col)
}

// ─── Клавиатура ───────────────────────────────────────────────────────────────
const onKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && e.altKey) {
    e.preventDefault()
    insertNewline()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    syncToStore()
    navigateNext()
  }
}

const insertNewline = () => {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const node = document.createTextNode('\n')
  range.insertNode(node)
  range.setStartAfter(node)
  range.setEndAfter(node)
  sel.removeAllRanges()
  sel.addRange(range)
  onInput()
}

// ─── Клик по td → фокус ──────────────────────────────────────────────────────
const onTdClick = () => {
  store.selectedCell = { row: props.row, col: props.col }
  if (document.activeElement !== editRef.value) {
    nextTick(() => {
      editRef.value?.focus()
      const el = editRef.value
      if (!el) return
      const range = document.createRange()
      range.selectNodeContents(el)
      range.collapse(false)
      const sel = window.getSelection()
      sel?.removeAllRanges()
      sel?.addRange(range)
    })
  }
}

// ─── Навигация Enter ──────────────────────────────────────────────────────────
const navigateNext = () => {
  const totalRows = store.tableData.length
  const { columns } = settings.value
  const { row, col } = props

  let nextRow = row
  let nextCol = col + 1

  if (nextCol >= columns) {
    nextCol = 0
    nextRow = row + 1
  }
  if (nextRow >= totalRows) {
    store.addRow()
    nextRow = totalRows
    nextCol = 0
  }

  store.selectedCell = { row: nextRow, col: nextCol }

  nextTick(() => {
    const el = document.querySelector<HTMLDivElement>(
      `tr:nth-child(${nextRow + 1}) td:nth-child(${nextCol + 1}) .label-cell-edit`
    )
    el?.focus()
  })
}
</script>

<style scoped>
td {
  vertical-align: top;
}
.label-cell-edit:focus {
  outline: none;
}
.label-cell-edit::selection {
  background: rgba(25, 118, 210, 0.25);
}
</style>
