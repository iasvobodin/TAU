<script setup lang="ts">
/**
 * LabelCanvas — канвас-адаптер для vue-draggable-resizable.
 *
 * Zoom-логика:
 *   • При загрузке шаблона (watch templateKey + labelSizeMM) автоматически
 *     вычисляет коэффициент так, чтобы этикетка занимала рабочую область.
 *   • Колёсико мыши над рабочей областью меняет зум ±0.1.
 *   • Шаг привязки сетки зафиксирован на 0.1 мм.
 *
 * Таблица:
 *   • Контейнер (type: 'table') рендерится невидимо (только рамки).
 *   • Ячейки (text с tableCellMeta) — обычные текстовые блоки,
 *     но без VueDraggableResizable (позиция управляется таблицей).
 *   • Enter в inline-редакторе ячейки → переход к следующей ячейке.
 */
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import VueDraggableResizable from 'vue-draggable-resizable'
import 'vue-draggable-resizable/style.css'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { resolveTextProps } from '@/types/label'
import type { ElementPosition } from '@/types/label'
import { generateDimensionDrawing } from '@/assets/generateDimensionDrawing'
import { MM_TO_PX, mmToPx, computeTextLayout, getTextContainerBox } from '@/assets/textLayout'
import type { TextMetricsProvider } from '@/assets/textLayout'
import { loadFont, FALLBACK_TEXT_METRICS_PROVIDER } from '@/assets/renderToSVG'
import { createOpentypeTextMetricsProvider } from '@/assets/opentypeTextMetrics'

const store = useLabelEditorStore()
const {
  positions,
  elements,
  selectedId,
  selectedIds,
  labelSizeInPx,
  labelSizeMM,
  zoom,
  templateKey,
  fitZoomTrigger,
  copyBrushActive,
  linkBrushActive,
  showElementBorders,
  labelBorder
} = storeToRefs(store)

// ── Константы ─────────────────────────────────────────────────────────────────
// MM_TO_PX — единый коэффициент мм→px, импортируется из textLayout.ts (Фаза 5).
const SNAP_MM = 0.1 // шаг привязки — 0.1 мм

// Отступы от краёв контейнера до этикетки при авто-фите:
// padding контейнера = 24px + визуальный зазор = 24px → итого 48px с каждой стороны
const FIT_MARGIN = 48

// ── SVG чертежа для оверлея ──────────────────────────────────────────────────
const dimensionSvg = computed(() => {
  if (!showElementBorders.value) return ''
  const td = {
    positions: { ...store.positions },
    elements: Object.fromEntries(
      Object.entries(store.elements).map(([id, el]) => [
        id,
        {
          id: el.id,
          type: el.type,
          dataField: el.dataField,
          props: { ...el.props }
        }
      ])
    ),
    labelSize: { ...store.labelSize }
  }
  return generateDimensionDrawing(td)
})

// ── Ref на контейнер ──────────────────────────────────────────────────────────
const containerEl = ref<HTMLElement | null>(null)

// ── Авто-фит ──────────────────────────────────────────────────────────────────
function fitZoom() {
  if (!containerEl.value) return
  const rect = containerEl.value.getBoundingClientRect()
  const cw = rect.width
  const ch = rect.height
  if (cw === 0 || ch === 0) return

  const labelW = mmToPx(labelSizeMM.value.width)
  const labelH = mmToPx(labelSizeMM.value.height)

  const availW = cw - FIT_MARGIN * 2
  const availH = ch - FIT_MARGIN * 2
  if (availW <= 0 || availH <= 0) return

  // Math.min — подбираем коэффициент по меньшей стороне,
  // чтобы этикетка целиком поместилась в рабочую область
  const raw = Math.min(availW / labelW, availH / labelH)
  // Округляем до 0.1, зажимаем в допустимые пределы
  zoom.value = Math.min(9, Math.max(0.5, Math.round(raw * 10) / 10))
}

// Авто-фит при маунте (первый рендер)
onMounted(async () => {
  await nextTick()
  fitZoom()
  document.addEventListener('keydown', onGlobalKeydown, true)
})

// Авто-фит при загрузке шаблона (templateKey меняется в applyTemplateData)
watch(templateKey, () => nextTick(fitZoom))

// Авто-фит при изменении размера этикетки (пользователь поменял W/H в панели)
watch(labelSizeMM, () => nextTick(fitZoom), { deep: true })

// Авто-фит по сигналу от LabelSizePanel (кнопка «вписать»)
watch(fitZoomTrigger, () => nextTick(fitZoom))

// ── Колёсико мыши — изменение зума ───────────────────────────────────────────
function onWheel(e: WheelEvent) {
  // e.preventDefault() уже вызван через @wheel.prevent в шаблоне
  const step = e.shiftKey ? 0.5 : 0.1 // Shift → крупный шаг
  const delta = e.deltaY < 0 ? step : -step
  zoom.value = Math.min(9, Math.max(0.5, Math.round((zoom.value + delta) * 10) / 10))
}

// ── Глобальный keydown (стрелки + clipboard + delete) ─────────────────────────
function onGlobalKeydown(e: KeyboardEvent): void {
  // Если фокус на input/textarea — пропускаем (браузерный native)
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  // Если активен inline-редактор — не перехватываем
  if (editingId.value) return

  // Ctrl+C / Ctrl+X / Ctrl+V
  // Используем e.code (KeyC/KeyV/KeyX), так как e.key зависит от раскладки
  if (e.ctrlKey || e.metaKey) {
    switch (e.code) {
      case 'KeyC':
        e.preventDefault()
        store.copySelectedContent()
        return
      case 'KeyX':
        e.preventDefault()
        store.cutSelectedContent()
        return
      case 'KeyV':
        e.preventDefault()
        store.pasteToSelected()
        return
    }
    return
  }

  // Delete — очистить содержимое выбранных ячеек
  if (e.key === 'Delete' || e.key === 'Del') {
    e.preventDefault()
    store.deleteSelectedContent()
    return
  }

  // Стрелки — перемещение блока на 0.1 мм
  if (copyBrushActive.value || linkBrushActive.value) return
  if (!selectedId.value) return

  const pos = positions.value[selectedId.value]
  if (!pos) return

  let dx = 0
  let dy = 0
  switch (e.key) {
    case 'ArrowUp':
      dy = -0.1
      break
    case 'ArrowDown':
      dy = 0.1
      break
    case 'ArrowLeft':
      dx = -0.1
      break
    case 'ArrowRight':
      dx = 0.1
      break
    default:
      return // не стрелка
  }

  e.preventDefault() // предотвращаем скролл страницы
  store.updatePosition(selectedId.value, {
    x: pos.x + dx,
    y: pos.y + dy,
    w: pos.w,
    h: pos.h
  })
}

// ── мм ↔ px (с учётом zoom канваса) ───────────────────────────────────────────
// Базовое mm→px берётся из textLayout.mmToPx (единый MM_TO_PX), затем × zoom.
function mmToPxZoom(mm: number): number {
  return mmToPx(mm) * zoom.value
}
function pxToMmZoom(px: number): number {
  return px / (MM_TO_PX * zoom.value)
}

const snapPx = computed(() => Math.max(1, Math.round(mmToPxZoom(SNAP_MM))))

function posToPx(pos: ElementPosition) {
  const result = {
    x: Math.round(mmToPxZoom(pos.x)),
    y: Math.round(mmToPxZoom(pos.y)),
    w: Math.max(snapPx.value, Math.round(mmToPxZoom(pos.w))),
    h: Math.max(snapPx.value, Math.round(mmToPxZoom(pos.h)))
  }
  return result
}

// ── In-place text editing ──────────────────────────────────────────────────
const editingId = ref<string | null>(null)
const editingText = ref('')
const editInputEl = ref<HTMLTextAreaElement | null>(null)

// ── Определение ячейки таблицы ───────────────────────────────────────────────
function isTableCell(id: string): boolean {
  const el = elements.value[id]
  return el?.type === 'text' && el.props.tableCellMeta != null
}

function isTableContainer(id: string): boolean {
  return elements.value[id]?.type === 'table'
}

function onStartEdit(id: string): void {
  const el = elements.value[id]
  if (!el || el.type !== 'text') return
  editingText.value = store.getDisplayText(el)
  editingId.value = id
  requestAnimationFrame(() => {
    const ta = document.querySelector<HTMLTextAreaElement>('.canvas-label textarea')
    if (ta) {
      ta.focus()
      ta.select()
    }
  })
}

/**
 * Enter-навигация между ячейками таблицы.
 * После сохранения переходит к следующей ячейке (если есть).
 */
function navigateToNextCell(currentId: string): void {
  const el = elements.value[currentId]
  if (!el?.props.tableCellMeta) return

  const { tableId, row, col } = el.props.tableCellMeta
  const tableEl = elements.value[tableId]
  if (!tableEl?.props.tableCellIds) return

  const cellIds = tableEl.props.tableCellIds
  if (!cellIds.length || !cellIds[0]?.length) return

  const rows = cellIds.length
  const cols = cellIds[0].length

  let nextRow = row
  let nextCol = col + 1

  if (nextCol >= cols) {
    nextRow++
    nextCol = 0
  }

  if (nextRow >= rows) return // последняя ячейка — стоп

  const nextCellId = cellIds[nextRow]?.[nextCol]
  if (nextCellId && elements.value[nextCellId]) {
    selectedId.value = nextCellId
    onStartEdit(nextCellId)
  }
}

function onSaveEdit(id: string, value: string): void {
  // Если мы уже перешли к другой ячейке — не закрываем редактирование
  if (editingId.value !== id) return

  const el = elements.value[id]
  if (el && el.type === 'text') {
    el.props.customText = value
  }
  editingId.value = null
  editingText.value = ''
}

function onCancelEdit(): void {
  editingId.value = null
  editingText.value = ''
}

function handleTextEnter(e: KeyboardEvent, id: string): void {
  const el = elements.value[id]
  // Alt+Enter — перенос строки (ручная вставка \n в editingText)
  if (e.altKey) {
    e.preventDefault()
    const ta = e.target as HTMLTextAreaElement
    const start = ta.selectionStart
    const end = ta.selectionEnd
    editingText.value =
      editingText.value.substring(0, start) + '\n' + editingText.value.substring(end)
    requestAnimationFrame(() => {
      ta.selectionStart = start + 1
      ta.selectionEnd = start + 1
    })
    return
  }
  // Enter в ячейке таблицы (без Ctrl/Shift) — переход к следующей
  if (el?.props.tableCellMeta && !e.ctrlKey && !e.shiftKey) {
    e.preventDefault()

    // 1. Сохраняем текст напрямую в элемент
    if (el.type === 'text') {
      el.props.customText = editingText.value
    }

    // 2. Находим следующую ячейку
    const { tableId, row, col } = el.props.tableCellMeta
    const tableEl = elements.value[tableId]
    const cellIds = tableEl?.props.tableCellIds
    if (!cellIds?.length) return

    const rows = cellIds.length
    const cols = cellIds[0].length
    let nextRow = row
    let nextCol = col + 1
    if (nextCol >= cols) {
      nextRow++
      nextCol = 0
    }
    if (nextRow >= rows) return // последняя ячейка

    const nextCellId = cellIds[nextRow]?.[nextCol]
    if (!nextCellId || !elements.value[nextCellId]) return

    // 3. Сразу устанавливаем новый editingId (не через null!)
    selectedId.value = nextCellId
    editingId.value = nextCellId
    const nextEl = elements.value[nextCellId]
    editingText.value = store.getDisplayText(nextEl!)

    // 4. Фокус после полной отрисовки нового кадра
    //    requestAnimationFrame гарантирует что DOM обновлён и textarea смонтирована
    requestAnimationFrame(() => {
      const ta = document.querySelector<HTMLTextAreaElement>('.canvas-label textarea')
      if (ta) {
        ta.focus()
        ta.select()
      }
    })
    return
  }
  // Обычный Enter — разрешаем перенос строки (textarea default)
}

// ── Copy Brush (кисточка) / Link Brush ──────────────────────────────────────
function onElementClick(id: string): void {
  if (copyBrushActive.value) {
    store.applyCopyBrush(id)
  } else if (linkBrushActive.value) {
    store.applyLinkBrush(id)
  }
}

/**
 * Обработчик mousedown на ячейке таблицы.
 * Поддерживает Shift+click для range-выделения.
 */
function onCellMouseDown(id: string, e: MouseEvent): void {
  if (copyBrushActive.value || linkBrushActive.value) return
  selectedId.value = id
  store.selectCell(id, e.shiftKey)
}

function onCanvasClick(): void {
  if (editingId.value) {
    onCancelEdit()
  }
  if (copyBrushActive.value) {
    store.deactivateCopyBrush()
  } else if (linkBrushActive.value) {
    store.deactivateLinkBrush()
  } else {
    selectedId.value = null
    store.clearMultiSelection()
  }
}

// ── Подчистка при анмаунте ────────────────────────────────────────────────────
onUnmounted(() => {
  document.removeEventListener('keydown', onGlobalKeydown, true)
})

// ── Drag / resize ─────────────────────────────────────────────────────────────
function onDragStop(id: string, xPx: number, yPx: number): void {
  const pos = positions.value[id]
  if (!pos) return
  // Ячейки таблицы не перемещаются
  if (isTableCell(id)) return
  store.updatePosition(id, { x: pxToMmZoom(xPx), y: pxToMmZoom(yPx), w: pos.w, h: pos.h })
}
function onResizeStop(id: string, xPx: number, yPx: number, wPx: number, hPx: number): void {
  // Ячейки таблицы не ресайзятся
  if (isTableCell(id)) return
  store.updatePosition(id, {
    x: pxToMmZoom(xPx),
    y: pxToMmZoom(yPx),
    w: pxToMmZoom(wPx),
    h: pxToMmZoom(hPx)
  })
}
function onTableDragStop(id: string, xPx: number, yPx: number): void {
  const pos = positions.value[id]
  if (!pos) return
  // Обновляем позицию контейнера
  store.updatePosition(id, { x: pxToMmZoom(xPx), y: pxToMmZoom(yPx), w: pos.w, h: pos.h })
  // Пересчитываем позиции всех ячеек
  store.updateTableProps(id)
}

// ── Текстовый блок на единой раскладке (идентично htmlRenderer/SVG) ───────────
// Текст рендерится ЯВНЫМИ строками на координатах из computeTextLayout
// (система «повёрнутого текста»), внешний поворот — через transform:rotate(θ)
// вокруг центра блока (как <g transform="rotate(θ cx cy)"> в SVG).
// Масштаб канваса: mm→px через mmToPx × zoom.

// Провайдер метрик канваса — ОБЩИЙ opentype-адаптер (тот же, что у HTML/SVG);
// если шрифт не загружен — общий FALLBACK_TEXT_METRICS_PROVIDER.
const providerCache = new Map<string, TextMetricsProvider>()
const providerLoads = new Map<string, Promise<TextMetricsProvider>>()
const providerVersion = ref(0)

async function ensureProviders(): Promise<void> {
  const families = new Set<string>()
  for (const el of Object.values(elements.value)) {
    if (el?.type === 'text') {
      families.add(String(resolveTextProps(el.props).fontFamily).toLowerCase())
    }
  }
  for (const family of families) {
    if (providerCache.has(family)) continue
    let p = providerLoads.get(family)
    if (!p) {
      p = (async () => {
        const font = await loadFont(family)
        const provider = font
          ? createOpentypeTextMetricsProvider(font)
          : FALLBACK_TEXT_METRICS_PROVIDER
        providerCache.set(family, provider)
        providerVersion.value++
        return provider
      })()
      providerLoads.set(family, p)
    }
    await p
  }
}

// Перезагрузка провайдеров при смене набора шрифтов (immediate — при монтировании)
const textFontFamilies = computed(() => {
  const families = new Set<string>()
  for (const el of Object.values(elements.value)) {
    if (el?.type === 'text') {
      families.add(String(resolveTextProps(el.props).fontFamily).toLowerCase())
    }
  }
  return [...families].sort().join(',')
})
watch(textFontFamilies, () => void ensureProviders(), { immediate: true })

interface CanvasDisplayLine {
  text: string
  left: string
  top: string
  width: string
}

// Строки отображения: для каждого text-элемента (включая ячейки таблицы)
// раскладка считается единым computeTextLayout → позиции совпадают с печатью.
const displayLines = computed<Record<string, CanvasDisplayLine[]>>(() => {
  providerVersion.value // зависимость от асинхронной загрузки шрифтов
  const result: Record<string, CanvasDisplayLine[]> = {}
  const els = elements.value
  const poss = positions.value
  const z = zoom.value
  for (const id of Object.keys(els)) {
    const el = els[id]
    if (el?.type !== 'text') continue
    const pos = poss[id]
    if (!pos) continue
    const tp = resolveTextProps(el.props)
    const provider =
      providerCache.get(tp.fontFamily.toLowerCase()) ?? FALLBACK_TEXT_METRICS_PROVIDER
    const textRotation = (el.props.textRotation ?? 0) as 0 | 90 | 180 | 270
    const layout = computeTextLayout({
      text: store.getDisplayText(el) || ' ',
      tp,
      blockWmm: pos.w,
      blockHmm: pos.h,
      textRotation,
      provider
    })
    const ascPx = provider.ascenderPx(tp.fontSize)
    result[id] = layout.lines.map((ln) => ({
      text: ln.text || '\u00A0',
      left: (ln.xPx * z).toFixed(2),
      top: ((ln.baselineYPx - ascPx) * z).toFixed(2),
      width: (ln.widthPx * z).toFixed(2)
    }))
  }
  return result
})

// Контейнер текста — занимает весь элемент, клики/редактирование сквозные.
function getTextContainerStyle(): Record<string, string> {
  return {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    pointerEvents: 'none'
  }
}

// Внешний поворот вокруг центра блока (единый способ для HTML/SVG/канваса).
function getTextRotatorStyle(props: Record<string, any>): Record<string, string> {
  const rotation = props.textRotation ?? 0
  const style: Record<string, string> = {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '100%',
    height: '100%'
  }
  if (rotation) {
    style.transform = `rotate(${rotation}deg)`
    style.transformOrigin = 'center center'
  }
  return style
}

// Повёрнутый контейнер строк — система координат строк из layout.
// При 90/270 ширину/высоту свопаем и центрируем контейнер относительно блока,
// чтобы внешний rotate(θ) вокруг центра контейнера держал текст внутри блока
// (единый контракт с htmlRenderer/SVG через getTextContainerBox).
function getTextContentStyle(
  props: Record<string, any>,
  posPx?: { w: number; h: number }
): Record<string, string> {
  const tp = resolveTextProps(props as any)
  const z = zoom.value
  const rotation = (props.textRotation ?? 0) as 0 | 90 | 180 | 270
  // posPx уже содержит zoom (px = мм * MM_TO_PX * z), а getTextContainerBox
  // работает в «физических» px (мм → MM_TO_PX) — делим на z и умножаем обратно.
  const box = getTextContainerBox((posPx?.w ?? 0) / z, (posPx?.h ?? 0) / z, tp, rotation)
  return {
    position: 'absolute',
    left: (box.x * z).toFixed(2) + 'px',
    top: (box.y * z).toFixed(2) + 'px',
    width: (box.w * z).toFixed(2) + 'px',
    height: (box.h * z).toFixed(2) + 'px',
    boxSizing: 'border-box',
    overflow: 'hidden'
  }
}

// Стиль одной строки (absolute, left/top/width из computeTextLayout, × zoom).
function getTextLineStyle(
  props: Record<string, any>,
  line: CanvasDisplayLine
): Record<string, string> {
  const tp = resolveTextProps(props as any)
  const z = zoom.value
  // ВАЖНО (регресс-фикс): left/top/width — строки без единиц ("12.34"). Vue 3
  // НЕ добавляет px автоматически (ни для строк, ни для чисел) — такие декларации
  // браузер отбрасывает как невалидные, и все строки схлопываются в верхний левый
  // угол (теряется перенос/выравнивание/вертикаль). Явно добавляем 'px'.
  return {
    position: 'absolute',
    left: line.left + 'px',
    top: line.top + 'px',
    width: line.width + 'px',
    whiteSpace: 'pre',
    overflow: 'hidden',
    fontSize: tp.fontSize * z + 'px',
    fontFamily: `'${tp.fontFamily}'`,
    fontWeight: tp.bold ? 'bold' : 'normal',
    lineHeight: String(tp.lineHeight),
    color: tp.textColor ?? '#000000'
  }
}

/**
 * Стиль повёрнутого inline-редактора (textarea).
 * При 90/270 box размера innerH×innerW центрируется поверх элемента и поворачивается
 * на 90/270deg — текст виден повёрнутым как в печати, а перенос идёт по «высоте»
 * блока (wrapW = innerH в computeTextLayout). Для 0/180 — обычное заполнение.
 * Механика подложки/оверлея сохранена, выравнивание — по единой раскладке.
 */
function getTextEditorStyle(
  props: Record<string, any>,
  posPx?: { w: number; h: number }
): Record<string, string> {
  const tp = resolveTextProps(props as any)
  const z = zoom.value
  const rotation = props.textRotation ?? 0
  const padTop = mmToPx(tp.paddingTop) * z
  const padRight = mmToPx(tp.paddingRight) * z
  const padBottom = mmToPx(tp.paddingBottom) * z
  const padLeft = mmToPx(tp.paddingLeft) * z
  const fontSizePx = tp.fontSize * z
  const lineH = tp.lineHeight ?? 1.2

  let width = '100%'
  let height = '100%'
  let extra: Record<string, string> = {}
  let transformStr = ''
  let padTopOut = padTop
  let padRightOut = padRight
  let padBottomOut = padBottom
  let padLeftOut = padLeft

  if ((rotation === 90 || rotation === 270) && posPx) {
    const wPx = posPx.w
    const hPx = posPx.h
    const innerW = Math.max(1, wPx - padLeft - padRight)
    const innerH = Math.max(1, hPx - padTop - padBottom)
    // Повёрнутый box: ширина = innerH (ось переноса), высота = innerW,
    // центрируется над элементом; паддинги блока учтены размером/позицией бокса.
    width = innerH.toFixed(2) + 'px'
    height = innerW.toFixed(2) + 'px'
    const left = ((wPx - innerH) / 2).toFixed(2)
    const top = ((hPx - innerW) / 2).toFixed(2)
    extra = { position: 'absolute', left: left + 'px', top: top + 'px' }
    transformStr = rotation === 90 ? 'rotate(90deg)' : 'rotate(270deg)'
    padTopOut = padRightOut = padBottomOut = padLeftOut = 0
  } else if (rotation === 180) {
    transformStr = 'rotate(180deg)'
  } else if (posPx && tp.verticalAlign === 'middle') {
    // Вертикальное выравнивание (0°) — симуляция через padding-top
    const availH = posPx.h - padTop - padBottom
    const textH = fontSizePx * lineH
    padTopOut = Math.max(padTop, padTop + (availH - textH) / 2)
  } else if (posPx && tp.verticalAlign === 'bottom') {
    const textH = fontSizePx * lineH
    padTopOut = Math.max(padTop, posPx.h - padBottom - textH)
  }

  return {
    width,
    height,
    border: 'none',
    outline: 'none',
    resize: 'none',
    background: 'transparent',
    fontFamily: `'${tp.fontFamily}'`,
    fontSize: fontSizePx + 'px',
    lineHeight: String(lineH),
    fontWeight: tp.bold ? 'bold' : 'normal',
    textAlign: tp.align as string,
    whiteSpace: 'pre-wrap',
    padding: `${padTopOut.toFixed(2)}px ${padRightOut.toFixed(2)}px ${padBottomOut.toFixed(2)}px ${padLeftOut.toFixed(2)}px`,
    margin: '0',
    color: '#222',
    overflow: 'hidden',
    boxSizing: 'border-box',
    ...(transformStr ? { transform: transformStr, transformOrigin: 'center center' } : {}),
    ...extra
  }
}
// ── Стиль для ячейки таблицы (рамки) ─────────────────────────────────────────
function getTableCellStyle(id: string): Record<string, string> {
  const el = elements.value[id]
  const meta = el?.props.tableCellMeta
  if (!meta) return {}

  const tableEl = elements.value[meta.tableId]
  const showBorders = tableEl?.props.tableShowBorders
  const borderStyle = tableEl?.props.tableBorderStyle ?? 'solid'

  if (!showBorders) return {}

  return {
    border: `1px solid #999`,
    borderStyle: borderStyle === 'dashed' ? 'dashed' : 'solid',
    boxSizing: 'border-box' as string
  }
}

// ── Стиль контура (outline) для элемента ──────────────────────────────────────
function getElementOutlineStyle(props: Record<string, any>): Record<string, string> {
  if (!props.outlineEnabled) return {}
  const width = mmToPx(props.outlineWidth ?? 0.5) * zoom.value
  const color = props.outlineColor ?? '#333'
  return {
    outline: `${width.toFixed(2)}px solid ${color}`,
    outlineOffset: '0px'
  }
}
</script>

<template>
  <!--
    @wheel.prevent — перехватываем колёсико над рабочей областью.
    ref="containerEl" — нужен для вычисления размера при авто-фите.
  -->
  <div ref="containerEl" class="canvas-container" @wheel.prevent="onWheel">
    <!-- Белый лист этикетки -->
    <div
      class="canvas-label"
      :class="{
        'canvas-label--copy-brush': copyBrushActive,
        'canvas-label--link-brush': linkBrushActive
      }"
      :style="{
        width: labelSizeInPx.width + 'px',
        height: labelSizeInPx.height + 'px',
        ...(labelBorder.enabled
          ? {
              border: `${(labelBorder.width * zoom).toFixed(2)}px solid ${labelBorder.color}`
            }
          : {})
      }"
      @click.self="onCanvasClick"
    >
      <!-- :key включает zoom — VDR перечитывает размеры родителя при ремаунте -->
      <template v-for="(pos, id) in positions" :key="String(id)">
        <!-- ═══ Ячейка таблицы (text с tableCellMeta) — всегда активна ═══ -->
        <div
          v-if="isTableCell(String(id))"
          :key="`tc-${String(id)}`"
          class="label-el label-el--table-cell"
          :class="{
            'label-el--selected': !copyBrushActive && selectedId === String(id),
            'label-el--range-selected': selectedIds.includes(String(id))
          }"
          :style="{
            position: 'absolute',
            left: posToPx(pos).x + 'px',
            top: posToPx(pos).y + 'px',
            width: posToPx(pos).w + 'px',
            height: posToPx(pos).h + 'px',
            ...getTableCellStyle(String(id)),
            ...getElementOutlineStyle(elements[id]?.props ?? {}),
            pointerEvents: 'auto',
            zIndex: 20
          }"
          @click="onElementClick(String(id))"
          @mousedown.stop="onCellMouseDown(String(id), $event)"
          @dblclick.stop="onStartEdit(String(id))"
        >
          <div :style="getTextContainerStyle()">
            <div :style="getTextRotatorStyle(elements[id]?.props ?? {})">
              <div :style="getTextContentStyle(elements[id]?.props ?? {}, posToPx(pos))">
                <template v-if="editingId !== String(id)">
                  <div
                    v-for="(line, li) in displayLines[String(id)] || []"
                    :key="`tc-ln-${String(id)}-${li}`"
                    :style="getTextLineStyle(elements[id]?.props ?? {}, line)"
                  >
                    {{ line.text }}
                  </div>
                </template>
              </div>
            </div>
            <textarea
              v-if="editingId === String(id)"
              ref="editInputEl"
              v-model="editingText"
              class="el-text-editor"
              :style="getTextEditorStyle(elements[id]?.props ?? {}, posToPx(pos))"
              @keydown.esc="onCancelEdit"
              @keydown.enter="handleTextEnter($event, String(id))"
              @blur="onSaveEdit(String(id), editingText)"
              @mousedown.stop
              @pointerdown.stop
            />
          </div>

          <!-- ── Действия для ячейки — всегда как для обычного text ── -->
          <div
            v-if="
              !copyBrushActive &&
              !linkBrushActive &&
              selectedId === String(id) &&
              editingId !== String(id)
            "
            class="el-actions"
          >
            <button
              class="el-actions__btn"
              title="Редактировать текст"
              @mousedown.stop
              @click.stop="onStartEdit(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <button
              class="el-actions__btn el-actions__btn--del"
              title="Удалить элемент"
              @mousedown.stop
              @click.stop="store.removeElement(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </div>

        <!-- ═══ Контейнер таблицы (type: 'table') — прозрачный, с иконкой ═══ -->
        <VueDraggableResizable
          v-else-if="isTableContainer(String(id))"
          :key="`tcont-${String(id)}-${zoom}`"
          :x="posToPx(pos).x"
          :y="posToPx(pos).y"
          :w="posToPx(pos).w"
          :h="posToPx(pos).h"
          :parent="true"
          :grid="[snapPx, snapPx]"
          :min-width="snapPx"
          :min-height="snapPx"
          :active="!copyBrushActive && selectedId === String(id)"
          :prevent-deactivation="true"
          :drag-handle="'.table-handle'"
          :resizable="false"
          class="label-el label-el--table-cont"
          :class="{
            'label-el--selected': !copyBrushActive && selectedId === String(id)
          }"
          :style="elements[id]?.props.tableOutline ? { border: '1.5px solid #666' } : {}"
          @drag-stop="(x: number, y: number) => onTableDragStop(String(id), x, y)"
        >
          <!-- Иконка-ручка в правом верхнем углу -->
          <div class="table-handle" @click.stop="selectedId = String(id)">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </div>
          <!-- Прозрачная область — чтобы ячейки были сверху -->
          <div style="width: 100%; height: 100%; pointer-events: none" />
        </VueDraggableResizable>

        <!-- ═══ Обычные элементы (text, barcode, image) — с VDR ═══ -->
        <VueDraggableResizable
          v-else-if="elements[id]"
          :key="`${String(id)}-${zoom}`"
          :x="posToPx(pos).x"
          :y="posToPx(pos).y"
          :w="posToPx(pos).w"
          :h="posToPx(pos).h"
          :parent="true"
          :grid="[snapPx, snapPx]"
          :min-width="snapPx"
          :min-height="snapPx"
          :active="!copyBrushActive && selectedId === String(id)"
          :prevent-deactivation="true"
          class="label-el"
          :class="{
            'label-el--selected': !copyBrushActive && selectedId === String(id),
            'label-el--brush-target': copyBrushActive
          }"
          :style="getElementOutlineStyle(elements[id]?.props ?? {})"
          @activated="selectedId = String(id)"
          @click="onElementClick(String(id))"
          @dblclick.stop="onStartEdit(String(id))"
          @drag-stop="(x: number, y: number) => onDragStop(String(id), x, y)"
          @resize-stop="
            (x: number, y: number, w: number, h: number) => onResizeStop(String(id), x, y, w, h)
          "
        >
          <!-- TEXT -->
          <div v-if="elements[id]?.type === 'text'" :style="getTextContainerStyle()">
            <div :style="getTextRotatorStyle(elements[id]?.props ?? {})">
              <div :style="getTextContentStyle(elements[id]?.props ?? {}, posToPx(pos))">
                <template v-if="editingId !== String(id)">
                  <div
                    v-for="(line, li) in displayLines[String(id)] || []"
                    :key="`ln-${String(id)}-${li}`"
                    :style="getTextLineStyle(elements[id]?.props ?? {}, line)"
                  >
                    {{ line.text }}
                  </div>
                </template>
              </div>
            </div>
            <textarea
              v-if="editingId === String(id)"
              ref="editInputEl"
              v-model="editingText"
              class="el-text-editor"
              :style="getTextEditorStyle(elements[id]?.props ?? {}, posToPx(pos))"
              @keydown.esc="onCancelEdit"
              @keydown.enter.ctrl="onSaveEdit(String(id), editingText)"
              @blur="onSaveEdit(String(id), editingText)"
              @mousedown.stop
              @pointerdown.stop
            />
          </div>

          <!-- BARCODE -->
          <div v-else-if="elements[id]?.type === 'barcode'" class="el-center">
            <img
              v-if="elements[id]?.props.customText"
              :src="elements[id]!.props.customText as string"
              style="max-width: 100%; max-height: 100%; object-fit: contain"
              alt="barcode"
            />
            <v-icon v-else size="22" color="#ccc">mdi-barcode</v-icon>
          </div>

          <!-- IMAGE -->
          <div v-else-if="elements[id]?.type === 'image'" class="el-center">
            <template v-if="elements[id]?.props.src">
              <div
                v-if="elements[id]!.props.src!.trimStart().startsWith('<svg')"
                style="
                  max-width: 100%;
                  max-height: 100%;
                  overflow: hidden;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                "
                v-html="elements[id]!.props.src"
              />
              <img
                v-else
                :src="elements[id]!.props.src"
                style="max-width: 100%; max-height: 100%; object-fit: contain"
                alt="image"
              />
            </template>
            <v-icon v-else size="22" color="#ccc">mdi-image-outline</v-icon>
          </div>

          <!-- ── Плавающая панель: ручка + корзинка ── -->
          <div
            v-if="
              !copyBrushActive &&
              !linkBrushActive &&
              selectedId === String(id) &&
              editingId !== String(id)
            "
            class="el-actions"
          >
            <!-- Редактировать (только для текста) -->
            <button
              v-if="elements[id]?.type === 'text'"
              class="el-actions__btn"
              title="Редактировать текст"
              @mousedown.stop
              @click.stop="onStartEdit(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
            <!-- Удалить -->
            <button
              class="el-actions__btn el-actions__btn--del"
              title="Удалить элемент"
              @mousedown.stop
              @click.stop="store.removeElement(String(id))"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                <line x1="10" x2="10" y1="11" y2="17" />
                <line x1="14" x2="14" y1="11" y2="17" />
              </svg>
            </button>
          </div>
        </VueDraggableResizable>
      </template>

      <!-- ═══ Оверлей с размерными линиями (чертёжный режим) ═══ -->
      <div v-if="showElementBorders && dimensionSvg" class="dim-overlay" v-html="dimensionSvg" />

      <!-- Размер этикетки -->
      <div class="canvas-badge canvas-badge--br">
        {{ labelSizeMM.width.toFixed(1) }} × {{ labelSizeMM.height.toFixed(1) }} мм
      </div>
      <!-- Текущий зум -->
      <div class="canvas-badge canvas-badge--tr">{{ Math.round(zoom * 100) }}%</div>
    </div>

    <!-- Подсказка об управлении зумом -->
    <div class="zoom-hint">
      <v-icon size="12" color="#aaa">mdi-mouse</v-icon>
      <span>колёсико — зум</span>
      <span class="zoom-hint-sep">·</span>
      <span>Shift + колёсико — ×5</span>
    </div>
  </div>
</template>

<style scoped>
/* ── Контейнер-рабочая область ───────────────────────────────────────────────── */
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  overflow: auto;
  min-height: 0;
  cursor: default;

  /* Шахматный фон */
  background-color: #d8d8d8;
  background-image:
    linear-gradient(45deg, #c8c8c8 25%, transparent 25%),
    linear-gradient(-45deg, #c8c8c8 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #c8c8c8 75%),
    linear-gradient(-45deg, transparent 75%, #c8c8c8 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
}

/* ── Лист этикетки ───────────────────────────────────────────────────────────── */
.canvas-label {
  position: relative;
  flex-shrink: 0;
  background: #fff;
  border: 1px solid #b0b0b0;
  border-radius: 3px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.18),
    0 1px 3px rgba(0, 0, 0, 0.1);
  user-select: none;
  -webkit-user-select: none;
}

/* ── Элемент на листе ────────────────────────────────────────────────────────── */
.label-el {
  position: absolute;
  top: 0;
  left: 0;
  border: 1px dashed #ccc;
  background: transparent;
  border-radius: 2px;
  cursor: pointer;
  transition:
    border-color 0.12s,
    box-shadow 0.12s;
}
.label-el:hover {
  border: 0px solid #1976d2 !important;
  box-shadow: 0 0 0 2px rgba(4, 48, 241, 0.76);
}
.label-el--table-cont {
  background: transparent;
  border: none;
}

.label-el--selected {
  border: 0px solid #1976d2 !important;
  box-shadow: 0 0 0 2px rgba(4, 48, 241, 0.76);
}

.label-el--range-selected {
  outline: 2px solid #1565c0;
  outline-offset: -2px;
  background: rgba(21, 101, 192, 0.06);
}

/* ── Плавающая панель с действиями ──────────────────────────────────────────── */
.el-actions {
  position: absolute;
  top: -22px;
  right: 0;
  display: flex;
  gap: 2px;
  z-index: 10;
  pointer-events: auto;
}
.el-actions__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1px solid #1976d2;
  border-radius: 3px;
  background: #fff;
  color: #1976d2;
  cursor: pointer;
  padding: 0;
  transition:
    background 0.1s,
    color 0.1s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.el-actions__btn:hover {
  background: #1976d2;
  color: #fff;
}
.el-actions__btn--del {
  border-color: #c62828;
  color: #c62828;
}
.el-actions__btn--del:hover {
  background: #c62828;
  color: #fff;
}

/* ── Текстовый редактор на месте ─────────────────────────────────────────────── */
.el-text-editor {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 5;
  pointer-events: auto;
}
.el-text-editor:focus {
  background: rgba(255, 255, 255, 0.95) !important;
  box-shadow: inset 0 0 0 1px #1976d2;
}

/* ── Copy Brush ──────────────────────────────────────────────────────────────── */
.canvas-label--copy-brush {
  cursor: crosshair;
}
.label-el--brush-target {
  cursor: crosshair;
}
.label-el--brush-target:hover {
  border-color: #e65100 !important;
  border-style: solid !important;
  box-shadow: 0 0 0 2px rgba(230, 81, 0, 0.25) !important;
}

/* ── Link Brush (связь текста с barcode) ─────────────────────────────────────── */
.canvas-label--link-brush {
  cursor: crosshair;
}
.label-el--link-target {
  cursor: crosshair;
}
.label-el--link-target:hover {
  border-color: #283593 !important;
  border-style: solid !important;
  box-shadow: 0 0 0 2px rgba(40, 57, 147, 0.25) !important;
}

/* ── Центрирование для barcode / image ───────────────────────────────────────── */
.el-center {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  pointer-events: none;
  box-sizing: border-box;
}

/* ── Оверлей размерных линий (чертёжный режим) ──────────────────────────────── */
.dim-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 50;
  overflow: hidden;
}
.dim-overlay :deep(svg) {
  width: 100%;
  height: 100%;
}

/* ── Бейджи (размер + зум) ───────────────────────────────────────────────────── */
.canvas-badge {
  position: absolute;
  font-size: 10px;
  font-family: 'Consolas', monospace;
  background: rgba(255, 255, 255, 0.85);
  padding: 2px 7px;
  border-radius: 10px;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.canvas-badge--br {
  bottom: 6px;
  right: 8px;
  color: #888;
}
.canvas-badge--tr {
  top: 6px;
  right: 8px;
  color: #1565c0;
  font-weight: 600;
}

/* ── Подсказка зума ──────────────────────────────────────────────────────────── */
.zoom-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #aaa;
  font-family: 'Segoe UI', system-ui, sans-serif;
  user-select: none;
  pointer-events: none;
  flex-shrink: 0;
}
.zoom-hint-sep {
  color: #ccc;
}

/* ── Иконка-ручка таблицы ─────────────────────────────────────────────────── */
.table-handle {
  box-sizing: border-box;
  position: absolute;
  top: -24px;
  right: -24px;
  width: 24px;
  height: 24px;
  cursor: grab;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border-radius: 4px;
  z-index: 999;
  color: #999;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  transition:
    color 0.15s,
    background 0.15s,
    box-shadow 0.15s;
  will-change: transform;
}
.table-handle:hover {
  box-sizing: border-box;
  background: #e3f2fd;
  color: #1976d2;
  box-shadow: 0 1px 4px rgba(25, 118, 210, 0.3);
}
.table-handle:active {
  cursor: grabbing;
  box-shadow: 0 1px 2px rgba(25, 118, 210, 0.2);
}
</style>
