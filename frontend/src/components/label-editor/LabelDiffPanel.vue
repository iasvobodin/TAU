<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLabelEditorStore } from '@/stores/labelEditor'
import { renderLabelToHTML } from '@/assets/htmlRenderer'
import { renderLabelToSVG, loadFont, FALLBACK_TEXT_METRICS_PROVIDER } from '@/assets/renderToSVG'
import { createOpentypeTextMetricsProvider } from '@/assets/opentypeTextMetrics'
import { resolveValue } from '@/assets/resolveValue'
import { resolveTextProps } from '@/types/label'
import type {
  CommonData,
  LabelElementProps,
  PrintLabelElement,
  PrintTemplateData
} from '@/types/label'
import { MM_TO_PX, computeTextLayout, mmToPx } from '@/assets/textLayout'
import type { TextMetricsProvider, TextRotation } from '@/assets/textLayout'
import { diffRenderCharacters, diffRenderLines, lineMaxDeltaMm } from '@/assets/labelDiff'
import type { CharPos, LabelCharDiffReport, LabelDiffReport, RenderLine } from '@/assets/labelDiff'

// ═══ Панель «Сверка рендеров» (labelDiff) ════════════════════════════════════
// Единый переиспользуемый компонент: используется в окне настроек печати
// (PrintSettingsDialog) и в DevView. Сверяет HTML- и SVG-рендер этикетки из
// одного buildTemplateData() с порогом 0.1 мм (допуск контракта).

const store = useLabelEditorStore()

const dialog = ref(false)
const running = ref(false)
const thresholdMm = ref(0.1)
const showAll = ref(true)
const errors = ref<string[]>([])
const warnings = ref<string[]>([])
const report = ref<LabelDiffReport | null>(null)
const htmlLen = ref(0)
const svgLen = ref(0)
const htmlPreviewLen = ref(0)
const svgPreviewLen = ref(0)
const labelWpx = ref(0)
const labelHpx = ref(0)
const htmlLinesCache = ref<RenderLine[]>([])
const svgLinesCache = ref<RenderLine[]>([])
const tdCache = ref<PrintTemplateData | null>(null)
const charMode = ref(false)
const charReport = ref<LabelCharDiffReport | null>(null)
const charOverlayDots = ref<CharOverlayDot[]>([])

interface OverlayLine {
  elementId: string
  text: string
  rotation: number
  left: number
  top: number
  width: number
  height: number
  cx: number
  cy: number
  maxDeltaMm: number
  diverging: boolean
}
const overlayLines = ref<OverlayLine[]>([])

interface CharOverlayDot {
  elementId: string
  char: string
  rotation: number
  left: number
  top: number
  cx: number
  cy: number
  deltaMm: number
}

const scale = computed(() => {
  if (!labelWpx.value || !labelHpx.value) return 1
  return Math.min(1, 820 / labelWpx.value, 460 / labelHpx.value)
})

function open(): void {
  dialog.value = true
  void run()
}

// Перестройка оверлея при переключении «показывать все строки»
watch(showAll, () => {
  if (tdCache.value && htmlLinesCache.value.length) {
    overlayLines.value = buildOverlay(
      tdCache.value,
      htmlLinesCache.value,
      svgLinesCache.value,
      thresholdMm.value,
      showAll.value
    )
  }
})

// Посимвольная сверка — полная пересверка при включении/выключении переключателя
// (включается только по явному желанию пользователя — не нагружает основной путь).
watch(charMode, () => {
  if (tdCache.value && htmlLinesCache.value.length) void run()
})

function buildTemplateDataFromStore(): PrintTemplateData {
  const els = store.elements
  return {
    positions: { ...store.positions },
    elements: Object.fromEntries(
      Object.entries(els).map(([id, el]) => [
        id,
        {
          id: el.id,
          type: el.type,
          dataField: el.dataField,
          props: { ...(el.props as PrintLabelElement['props']) }
        }
      ])
    ),
    labelSize: { ...store.labelSize },
    labelBorder: store.labelBorder ? { ...store.labelBorder } : undefined
  }
}

async function resolveProvider(fontFamily: string): Promise<TextMetricsProvider> {
  try {
    const font = await loadFont(fontFamily)
    return font ? createOpentypeTextMetricsProvider(font) : FALLBACK_TEXT_METRICS_PROVIDER
  } catch (e) {
    console.warn('[LabelDiffPanel] loadFont:', e)
    return FALLBACK_TEXT_METRICS_PROVIDER
  }
}

function parsePx(style: string, prop: string): number {
  const m = style.match(new RegExp(prop + ':([-\\d.]+)px'))
  return m ? parseFloat(m[1]) : 0
}

// HTML-слой: парсинг реального выхода htmlRenderer (строки — явные <div> с
// white-space:pre). Если рендер/парсинг недоступен (шрифты/fs/Neutralino) —
// фолбэк на ту же раскладку computeTextLayout, что использует SVG-рендерер.
async function buildHtmlLayer(
  td: PrintTemplateData,
  data: CommonData,
  serial: string
): Promise<RenderLine[]> {
  try {
    const htmlStr = await renderLabelToHTML(td, data, serial)
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html')
    const lineDivs = Array.from(doc.querySelectorAll('div')).filter((d) =>
      (d.getAttribute('style') ?? '').includes('white-space:pre')
    )
    const textEls = Object.entries(td.elements).filter(([, el]) => el.type === 'text')
    const lines: RenderLine[] = []
    let divIdx = 0
    for (const [id, el] of textEls) {
      const pos = td.positions[id]
      if (!pos) continue
      const tp = resolveTextProps(el.props as LabelElementProps)
      const rotation = (el.props.textRotation ?? 0) as TextRotation
      const provider = await resolveProvider(tp.fontFamily)
      const value = resolveValue(el as PrintLabelElement, data, serial, td.elements)
      // Та же раскладка, что и внутри htmlRenderer → число строк и lineHeight
      const layout = computeTextLayout({
        text: value || ' ',
        tp,
        blockWmm: pos.w,
        blockHmm: pos.h,
        textRotation: rotation,
        provider
      })
      for (let i = 0; i < layout.lines.length; i++) {
        const div = lineDivs[divIdx++]
        if (!div) break
        const style = div.getAttribute('style') ?? ''
        lines.push({
          elementId: id,
          text: div.textContent ?? '',
          xPx: parsePx(style, 'left'),
          yPx: parsePx(style, 'top'),
          widthPx: parsePx(style, 'width'),
          heightPx: layout.lineHeightPx,
          rotation,
          layerId: el.props.tableCellMeta?.tableId
        })
      }
    }
    return lines
  } catch (e) {
    warnings.value.push(
      'HTML-парсинг недоступен, HTML-слой построен из computeTextLayout: ' + (e as Error).message
    )
    return buildComputedLayer(td, data, serial)
  }
}

// SVG-слой: та же раскладка computeTextLayout, которую использует renderToSVG
// (SVG-пути не несут текста/координат для обратного парсинга, поэтому слой
// реконструируется из единого алгоритма — это и есть выход SVG-рендерера).
async function buildComputedLayer(
  td: PrintTemplateData,
  data: CommonData,
  serial: string
): Promise<RenderLine[]> {
  const lines: RenderLine[] = []
  for (const [id, el] of Object.entries(td.elements)) {
    if (el.type !== 'text') continue
    const pos = td.positions[id]
    if (!pos) continue
    const tp = resolveTextProps(el.props as LabelElementProps)
    const rotation = (el.props.textRotation ?? 0) as TextRotation
    const provider = await resolveProvider(tp.fontFamily)
    const value = resolveValue(el as PrintLabelElement, data, serial, td.elements)
    const layout = computeTextLayout({
      text: value || ' ',
      tp,
      blockWmm: pos.w,
      blockHmm: pos.h,
      textRotation: rotation,
      provider
    })
    const asc = provider.ascenderPx(tp.fontSize)
    for (const ln of layout.lines) {
      lines.push({
        elementId: id,
        text: ln.text || '\u00A0',
        xPx: ln.xPx,
        yPx: ln.baselineYPx - asc,
        widthPx: ln.widthPx,
        heightPx: layout.lineHeightPx,
        rotation,
        layerId: el.props.tableCellMeta?.tableId
      })
    }
  }
  return lines
}

// Оверлей: строки HTML-слоя в координатах этикетки (мм → px), с поворотом вокруг
// центра блока (та же система координат, что у канваса LabelCanvas).
// Красные рамки — строки, где delta > порога; зелёные — остальные (если showAll).
function buildOverlay(
  td: PrintTemplateData,
  htmlLines: RenderLine[],
  svgLines: RenderLine[],
  threshold: number,
  showAllLines: boolean
): OverlayLine[] {
  const svgByEl = new Map<string, RenderLine[]>()
  for (const l of svgLines) {
    const arr = svgByEl.get(l.elementId)
    if (arr) arr.push(l)
    else svgByEl.set(l.elementId, [l])
  }
  const htmlByEl = new Map<string, RenderLine[]>()
  for (const l of htmlLines) {
    const arr = htmlByEl.get(l.elementId)
    if (arr) arr.push(l)
    else htmlByEl.set(l.elementId, [l])
  }

  const boxes: OverlayLine[] = []
  for (const [id, hArr] of htmlByEl) {
    const pos = td.positions[id]
    const el = td.elements[id]
    if (!pos || !el) continue
    const tp = resolveTextProps(el.props as LabelElementProps)
    const ox = pos.x * MM_TO_PX + mmToPx(tp.paddingLeft)
    const oy = pos.y * MM_TO_PX + mmToPx(tp.paddingTop)
    const cx = pos.x * MM_TO_PX + (pos.w * MM_TO_PX) / 2
    const cy = pos.y * MM_TO_PX + (pos.h * MM_TO_PX) / 2
    const rotation = (el.props.textRotation ?? 0) as number
    const sArr = svgByEl.get(id) ?? []
    for (let i = 0; i < hArr.length; i++) {
      const h = hArr[i]
      const s = sArr[i]
      const maxDeltaMm = lineMaxDeltaMm(h, s)
      const diverging = maxDeltaMm > threshold
      if (!diverging && !showAllLines) continue
      boxes.push({
        elementId: id,
        text: h.text,
        rotation,
        left: ox + h.xPx,
        top: oy + h.yPx,
        width: h.widthPx,
        height: h.heightPx ?? 8,
        cx,
        cy,
        maxDeltaMm,
        diverging
      })
    }
  }
  return boxes
}

// ═══ Посимвольная сверка (тестовая опция) ══════════════════════════════════════
// Реальное браузерное измерение позиций символов HTML-слоя: реальный выход
// renderLabelToHTML() вмонтируется в скрытый оффскрин-контейнер (position:fixed;
// left:-99999px; те же размеры/шрифты), для каждой строки-<div> измеряются
// Range.getClientRects() посимвольно (через text-узел + setStart/setEnd), из
// результата вычитаются координаты контейнера → фактические xPx символов от
// внутренней области блока. После измерения контейнер удаляется.

/**
 * Измеряет фактические браузерные позиции символов для всех текстовых элементов.
 * Возвращает Map: elementId → массив строк (массив CharPos на строку).
 * Только rotation 0: для 90/180/270 внешний rotate искажает горизонтальную ось
 * текстового пространства, поэтому такие элементы НЕ измеряются (undefined →
 * численный фолбэк computeCharPositions в diffRenderCharacters). Если хоть одна
 * строка элемента не измерилась — элемент целиком отдаётся на численный фолбэк.
 */
async function measureHtmlCharPositions(
  td: PrintTemplateData,
  data: CommonData,
  serial: string
): Promise<Map<string, CharPos[][]>> {
  const result = new Map<string, CharPos[][]>()

  // 1) Тот же реальный HTML-выход, что и в buildHtmlLayer
  const htmlStr = await renderLabelToHTML(td, data, serial)

  // 2) Скрытый оффскрин-контейнер с размерами этикетки
  const wMM = td.labelSize.unit === 'mm' ? td.labelSize.width : td.labelSize.width / MM_TO_PX
  const hMM = td.labelSize.unit === 'mm' ? td.labelSize.height : td.labelSize.height / MM_TO_PX
  const container = document.createElement('div')
  container.setAttribute(
    'style',
    [
      'position:fixed',
      'left:-99999px',
      'top:0',
      'width:' + (wMM * MM_TO_PX).toFixed(2) + 'px',
      'height:' + (hMM * MM_TO_PX).toFixed(2) + 'px',
      'overflow:hidden',
      'background:#fff'
    ].join(';')
  )
  container.innerHTML = htmlStr
  document.body.appendChild(container)

  try {
    // 3) Строки-линии (white-space:pre) в порядке элементов (как в buildHtmlLayer)
    const lineDivs = Array.from(container.querySelectorAll('div')).filter((d) =>
      (d.getAttribute('style') ?? '').includes('white-space:pre')
    )
    let divIdx = 0
    for (const [id, el] of Object.entries(td.elements)) {
      if (el.type !== 'text') continue
      const pos = td.positions[id]
      if (!pos) continue
      const tp = resolveTextProps(el.props as LabelElementProps)
      const rotation = (el.props.textRotation ?? 0) as TextRotation
      const provider = await resolveProvider(tp.fontFamily)
      const value = resolveValue(el as PrintLabelElement, data, serial, td.elements)
      const layout = computeTextLayout({
        text: value || ' ',
        tp,
        blockWmm: pos.w,
        blockHmm: pos.h,
        textRotation: rotation,
        provider
      })

      // Повёрнутые элементы не измеряем — численный фолбэк (div'ы потребляем,
      // чтобы не рассинхронизировать индексацию для последующих элементов).
      if (rotation !== 0) {
        divIdx += layout.lines.length
        continue
      }

      const perLine: CharPos[][] = []
      let allMeasured = true
      for (let i = 0; i < layout.lines.length; i++) {
        const lineDiv = lineDivs[divIdx++]
        if (!lineDiv) break
        const contentDiv = lineDiv.parentElement
        const originLeft = contentDiv
          ? contentDiv.getBoundingClientRect().left
          : lineDiv.getBoundingClientRect().left
        const textNode = Array.from(lineDiv.childNodes).find(
          (n) => n.nodeType === Node.TEXT_NODE
        ) as Text | undefined
        const chars = measureCharRects(textNode ?? null, originLeft)
        if (!chars) {
          allMeasured = false
          break
        }
        perLine.push(chars)
      }
      // Только если ВСЕ строки элемента измерены — иначе численный фолбэк
      if (allMeasured && perLine.length === layout.lines.length) result.set(id, perLine)
    }
  } finally {
    container.remove()
  }
  return result
}

/** Измеряет позиции символов одного text-узла через Range.getClientRects().
 *  Возвращает undefined при сбое измерения (нет text-узла / нет rect символа). */
function measureCharRects(textNode: Text | null, originLeft: number): CharPos[] | undefined {
  if (!textNode) return undefined
  const text = textNode.data
  const result: CharPos[] = []
  const range = document.createRange()
  let seqIdx = 0
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)
    if (cp === undefined) break
    const cpLen = cp > 0xffff ? 2 : 1 // суррогатные пары (эмодзи/редкие глифы) — 2 code unit
    range.setStart(textNode, i)
    range.setEnd(textNode, i + cpLen)
    const rects = range.getClientRects()
    const rect = rects.length ? rects[0] : null
    if (!rect) return undefined
    result.push({ char: String.fromCodePoint(cp), xPx: rect.left - originLeft, index: seqIdx })
    seqIdx++
    i += cpLen
  }
  return result
}

// Оверлей посимвольных расхождений: маленькие красные точки на позиции
// расходящихся символов (поверх рамок строк). Координаты — в системе этикетки
// (мм → px, поворот вокруг центра блока — как у buildOverlay).
function buildCharOverlay(
  td: PrintTemplateData,
  htmlLines: RenderLine[],
  charReportData: LabelCharDiffReport,
  threshold: number
): CharOverlayDot[] {
  const htmlByEl = new Map<string, RenderLine[]>()
  for (const l of htmlLines) {
    const arr = htmlByEl.get(l.elementId)
    if (arr) arr.push(l)
    else htmlByEl.set(l.elementId, [l])
  }
  const dots: CharOverlayDot[] = []
  for (const d of charReportData.discrepancies) {
    if (d.charIndex < 0) continue // структурные (текст/перенос) — точки нет
    if (d.deltaMm <= threshold) continue // подсвечиваем только расходящиеся (как рамки)
    const pos = td.positions[d.elementId]
    const el = td.elements[d.elementId]
    if (!pos || !el) continue
    const tp = resolveTextProps(el.props as LabelElementProps)
    const ox = pos.x * MM_TO_PX + mmToPx(tp.paddingLeft)
    const oy = pos.y * MM_TO_PX + mmToPx(tp.paddingTop)
    const cx = pos.x * MM_TO_PX + (pos.w * MM_TO_PX) / 2
    const cy = pos.y * MM_TO_PX + (pos.h * MM_TO_PX) / 2
    const rotation = (el.props.textRotation ?? 0) as number
    const line = htmlByEl.get(d.elementId)?.[d.lineIndex]
    const lineTop = line ? line.yPx : 0
    const lineH = line ? (line.heightPx ?? tp.fontSize * tp.lineHeight) : 8
    dots.push({
      elementId: d.elementId,
      char: d.char,
      rotation,
      left: ox + d.expectedX,
      top: oy + lineTop + lineH / 2,
      cx,
      cy,
      deltaMm: d.deltaMm
    })
  }
  return dots
}

async function run(): Promise<void> {
  running.value = true
  errors.value = []
  warnings.value = []
  report.value = null
  overlayLines.value = []
  charReport.value = null
  charOverlayDots.value = []
  try {
    const td = buildTemplateDataFromStore()
    const data: CommonData = { ...(store.batchCommonData as CommonData) }

    const wMM = td.labelSize.unit === 'mm' ? td.labelSize.width : td.labelSize.width / MM_TO_PX
    const hMM = td.labelSize.unit === 'mm' ? td.labelSize.height : td.labelSize.height / MM_TO_PX
    labelWpx.value = wMM * MM_TO_PX
    labelHpx.value = hMM * MM_TO_PX

    const textCount = Object.values(td.elements).filter((el) => el.type === 'text').length
    if (textCount === 0) {
      errors.value.push(
        'В шаблоне нет текстовых элементов — нечего сверять. Добавьте текст на этикетку.'
      )
    }

    // 1) Реальные выходы рендереров (контроль пайплайна) — каждый в try/catch,
    // чтобы сбой одного пути (шрифты/fs/Neutralino) не ронял сверку.
    try {
      htmlPreviewLen.value = (await renderLabelToHTML(td, data, '')).length
    } catch (e) {
      errors.value.push('HTML-рендер: ' + (e as Error).message)
    }
    try {
      svgPreviewLen.value = (await renderLabelToSVG(td, data, '', false)).length
    } catch (e) {
      errors.value.push('SVG-рендер: ' + (e as Error).message)
    }

    // 2) Слои строк из одного buildTemplateData()
    const htmlLines = await buildHtmlLayer(td, data, '')
    const svgLines = await buildComputedLayer(td, data, '')
    htmlLinesCache.value = htmlLines
    svgLinesCache.value = svgLines
    tdCache.value = td
    htmlLen.value = htmlLines.length
    svgLen.value = svgLines.length

    // 3) Сверка с параметризуемым порогом
    report.value = diffRenderLines(htmlLines, svgLines, {
      thresholdMm: thresholdMm.value
    })

    // 4) Оверлей
    overlayLines.value = buildOverlay(td, htmlLines, svgLines, thresholdMm.value, showAll.value)

    // 5) Посимвольная сверка — ТОЛЬКО при включённом переключателе (не нагружает
    //    основной путь; для типовых этикеток с десятками-сотнями символов быстро).
    if (charMode.value) {
      try {
        // Провайдеры/размеры шрифта по элементу (SVG-сторона — численно)
        const providerMap = new Map<string, TextMetricsProvider>()
        const fontSizeMap = new Map<string, number>()
        for (const [id, el] of Object.entries(td.elements)) {
          if (el.type !== 'text') continue
          const tp = resolveTextProps(el.props as LabelElementProps)
          providerMap.set(id, await resolveProvider(tp.fontFamily))
          fontSizeMap.set(id, tp.fontSize)
        }

        // Реальное браузерное измерение HTML-слоя (или undefined → численный фолбэк)
        let htmlCharPositions: Map<string, CharPos[][]> | undefined
        try {
          htmlCharPositions = await measureHtmlCharPositions(td, data, '')
        } catch (e) {
          warnings.value.push(
            'Браузерное измерение символов недоступно, HTML-слой посчитан численно: ' +
              (e as Error).message
          )
        }

        charReport.value = diffRenderCharacters(htmlLines, svgLines, {
          thresholdMm: thresholdMm.value,
          providerFor: (id) => providerMap.get(id),
          fontSizeFor: (id) => fontSizeMap.get(id) ?? 0,
          htmlCharPositionsFor: (id, lineIndex) => htmlCharPositions?.get(id)?.[lineIndex]
        })
        charOverlayDots.value = buildCharOverlay(td, htmlLines, charReport.value, thresholdMm.value)
      } catch (e) {
        errors.value.push('Посимвольная сверка прервана: ' + (e as Error).message)
        charReport.value = null
        charOverlayDots.value = []
      }
    }
  } catch (e) {
    errors.value.push('Сверка прервана: ' + (e as Error).message)
  } finally {
    running.value = false
  }
}
</script>

<template>
  <div class="ldp-root">
    <v-btn color="primary" variant="tonal" density="compact" @click="open">
      <v-icon size="15" start>mdi-compare-horizontal</v-icon>
      Сверка рендеров
    </v-btn>

    <v-dialog v-model="dialog" width="1180" scrollable>
      <v-card>
        <v-toolbar height="40" color="primary" density="compact">
          <v-toolbar-title class="text-subtitle-1"
            >Сверка рендеров (HTML ↔ SVG · labelDiff)</v-toolbar-title
          >
          <v-spacer></v-spacer>
          <v-btn icon @click="dialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-toolbar>
        <v-card-text>
          <v-row align="center">
            <v-col cols="2">
              <v-text-field
                v-model.number="thresholdMm"
                type="number"
                step="0.01"
                min="0"
                label="Порог, мм"
                density="compact"
                hide-details
                @change="run"
              ></v-text-field>
            </v-col>
            <v-col cols="2">
              <v-switch
                v-model="showAll"
                label="Все строки"
                density="compact"
                hide-details
              ></v-switch>
            </v-col>
            <v-col cols="5">
              <v-switch
                v-model="charMode"
                label="Посимвольная сверка"
                density="compact"
                hide-details
              ></v-switch>
              <div class="text-caption grey--text text--darken-1">
                Тестовая опция: просчёт каждого символа (HTML ↔ SVG) — влияет только на сверку, не
                на основной рендер. Порог по умолчанию 0.1 мм (допуск контракта).
              </div>
            </v-col>
            <v-col cols="3" class="text-right">
              <v-btn color="primary" :loading="running" @click="run">Сверка</v-btn>
            </v-col>
          </v-row>

          <v-alert v-if="errors.length" type="error" density="compact" class="mt-2">
            <div v-for="(e, i) in errors" :key="i">{{ e }}</div>
          </v-alert>
          <v-alert v-if="warnings.length" type="warning" density="compact" class="mt-2">
            <div v-for="(w, i) in warnings" :key="i">{{ w }}</div>
          </v-alert>

          <v-alert
            v-if="report"
            :type="report.aggregate.exceedsThreshold ? 'error' : 'success'"
            density="compact"
            class="mt-2"
          >
            Вердикт: <b>{{ report.aggregate.exceedsThreshold ? 'FAIL' : 'PASS' }}</b> · max delta:
            {{ report.aggregate.maxDeltaMm.toFixed(4) }} мм (порог {{ thresholdMm }} мм) · строк:
            {{ report.aggregate.comparedLines }} / {{ report.aggregate.totalLines }} · расхождений:
            {{ report.discrepancies.length }}
          </v-alert>

          <v-alert
            v-if="charMode && charReport"
            :type="charReport.exceedsThreshold ? 'error' : 'success'"
            density="compact"
            class="mt-2"
          >
            Посимвольный вердикт: <b>{{ charReport.exceedsThreshold ? 'FAIL' : 'PASS' }}</b> · max
            delta: {{ charReport.maxDeltaMm.toFixed(4) }} мм (порог {{ thresholdMm }} мм) · сравнено
            символов: {{ charReport.comparedChars }} · расхождений:
            {{ charReport.discrepancies.length }}
          </v-alert>

          <v-row class="mt-3">
            <v-col cols="5">
              <div
                class="ldp-canvas-wrap"
                :style="{
                  width: labelWpx * scale + 'px',
                  height: labelHpx * scale + 'px'
                }"
              >
                <div
                  class="ldp-canvas"
                  :style="{
                    width: labelWpx + 'px',
                    height: labelHpx + 'px',
                    transform: 'scale(' + scale + ')',
                    transformOrigin: 'top left'
                  }"
                >
                  <div
                    v-for="(box, i) in overlayLines"
                    :key="i"
                    class="ldp-box-wrap"
                    :style="{
                      left: box.cx + 'px',
                      top: box.cy + 'px',
                      transform: box.rotation ? 'rotate(' + box.rotation + 'deg)' : undefined
                    }"
                  >
                    <div
                      class="ldp-box"
                      :class="box.diverging ? 'ldp-box--bad' : 'ldp-box--ok'"
                      :style="{
                        left: box.left - box.cx + 'px',
                        top: box.top - box.cy + 'px',
                        width: box.width + 'px',
                        height: box.height + 'px'
                      }"
                      :title="
                        '[' +
                        box.elementId +
                        '] ' +
                        box.text +
                        ' · Δ ' +
                        box.maxDeltaMm.toFixed(4) +
                        ' мм'
                      "
                    ></div>
                  </div>
                  <div
                    v-for="(dot, i) in charOverlayDots"
                    :key="'c' + i"
                    class="ldp-box-wrap"
                    :style="{
                      left: dot.cx + 'px',
                      top: dot.cy + 'px',
                      transform: dot.rotation ? 'rotate(' + dot.rotation + 'deg)' : undefined
                    }"
                  >
                    <div
                      class="ldp-char-dot"
                      :style="{
                        left: dot.left - dot.cx + 'px',
                        top: dot.top - dot.cy + 'px'
                      }"
                      :title="
                        '[' +
                        dot.elementId +
                        '] символ «' +
                        dot.char +
                        '» · Δ ' +
                        dot.deltaMm.toFixed(4) +
                        ' мм'
                      "
                    ></div>
                  </div>
                  <div v-if="report && !overlayLines.length" class="ldp-empty">
                    Нет строк для подсветки
                  </div>
                </div>
              </div>
              <div class="text-caption mt-1">
                Оверлей в системе координат этикетки (мм → px, масштаб
                {{ scale.toFixed(2) }}). Красные рамки — строки с delta > {{ thresholdMm }} мм.
              </div>
            </v-col>
            <v-col cols="7">
              <div class="ldp-report">
                <div v-if="!report" class="ldp-empty">Нажмите «Сверка»</div>
                <table v-else class="ldp-table">
                  <thead>
                    <tr>
                      <th>Элемент</th>
                      <th>Строка</th>
                      <th>Ось</th>
                      <th>expected</th>
                      <th>actual</th>
                      <th>Δ px</th>
                      <th>Δ мм</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(d, i) in report.discrepancies"
                      :key="i"
                      :class="{
                        'ldp-row--bad':
                          d.deltaMm > thresholdMm || d.axis === 'text' || d.axis === 'lines'
                      }"
                    >
                      <td>{{ d.elementId }}</td>
                      <td>{{ d.lineText }}</td>
                      <td>{{ d.axis }}</td>
                      <td>{{ d.expected }}</td>
                      <td>{{ d.actual }}</td>
                      <td>{{ d.deltaPx.toFixed(3) }}</td>
                      <td>{{ d.deltaMm.toFixed(4) }}</td>
                    </tr>
                    <tr v-if="!report.discrepancies.length">
                      <td colspan="7" class="ldp-empty">Расхождений нет — слои совпадают</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="text-caption mt-1">
                HTML-слой: {{ htmlLen }} строк · SVG-слой: {{ svgLen }} строк · HTML-строка:
                {{ htmlPreviewLen }} симв. · SVG-строка: {{ svgPreviewLen }} симв.
              </div>

              <div v-if="charMode && charReport" class="mt-3">
                <div class="ldp-section-title">Посимвольные расхождения</div>
                <div class="ldp-report">
                  <table class="ldp-table">
                    <thead>
                      <tr>
                        <th>Элемент</th>
                        <th>Строка</th>
                        <th>Символ</th>
                        <th>expected</th>
                        <th>actual</th>
                        <th>Δ px</th>
                        <th>Δ мм</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(d, i) in charReport.discrepancies"
                        :key="'d' + i"
                        :class="{ 'ldp-row--bad': d.deltaMm > thresholdMm || d.charIndex < 0 }"
                      >
                        <td>{{ d.elementId }}</td>
                        <td>{{ d.lineIndex }}</td>
                        <td>{{ d.char }}</td>
                        <td>{{ d.expectedX }}</td>
                        <td>{{ d.actualX }}</td>
                        <td>{{ d.deltaPx.toFixed(3) }}</td>
                        <td>{{ d.deltaMm.toFixed(4) }}</td>
                      </tr>
                      <tr v-if="!charReport.discrepancies.length">
                        <td colspan="7" class="ldp-empty">Посимвольных расхождений нет</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.ldp-root {
  display: inline-flex;
}

.ldp-canvas-wrap {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #b0b0b0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.ldp-canvas {
  position: relative;
  background:
    linear-gradient(#f5f5f5 1px, transparent 1px),
    linear-gradient(90deg, #f5f5f5 1px, transparent 1px);
  background-size: 20px 20px;
}

.ldp-box-wrap {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.ldp-box {
  position: absolute;
  border: 1.5px solid #f44336;
  box-sizing: border-box;
  background: rgba(244, 67, 54, 0.12);
}

.ldp-box--bad {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.18);
}

.ldp-box--ok {
  border-color: rgba(76, 175, 80, 0.55);
  background: rgba(76, 175, 80, 0.08);
}

.ldp-char-dot {
  position: absolute;
  width: 5px;
  height: 5px;
  margin-left: -2.5px;
  margin-top: -2.5px;
  border-radius: 50%;
  background: #f44336;
  border: 1px solid #b71c1c;
  box-sizing: border-box;
}

.ldp-section-title {
  font-size: 12px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.ldp-empty {
  padding: 12px;
  text-align: center;
  color: #777;
}

.ldp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.ldp-table th,
.ldp-table td {
  border: 1px solid #e0e0e0;
  padding: 3px 6px;
  text-align: left;
  font-family: ui-monospace, Consolas, monospace;
}

.ldp-table thead th {
  background: #f5f5f5;
  position: sticky;
  top: 0;
}

.ldp-table .ldp-row--bad {
  background: rgba(244, 67, 54, 0.08);
}

.ldp-report {
  max-height: 460px;
  overflow: auto;
  border: 1px solid #e0e0e0;
}
</style>
