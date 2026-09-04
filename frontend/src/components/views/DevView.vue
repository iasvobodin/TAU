<script setup lang="ts">
import { fetchCheckList, updateCheckList } from '@/api/checkListServices'
import type { Specification } from '@/assets/interfaces'
import { fetchSpecifications } from '@/api/specificationServices'
import CheckListView from './CheckListView.vue'
import DefectsView from './DefectsView.vue'
import { openSecondWindow } from '@/assets/utils/openSecondWindow'
import { usePathsStore } from '@/stores/paths'
const pathsStore = usePathsStore()
import {
  server,
  filesystem,
  os,
  events,
  window as neuWindow,
  type DirectoryEntry
} from '@neutralinojs/lib'
import { computed, onMounted, shallowRef, ref, watch } from 'vue'
import SettingsView from './SettingsView.vue'
import LabelEditor from '../LabelEditor.vue'
import SVGeditor from '../SvgEditor.vue'
import AdminLog from '../AdminLog.vue'
import ClientsApp from '../ClientsApp.vue'
import OrderToProduction from './OrderToProduction.vue'
import { getClients } from '@/api/userServices'

// ── Сверка рендеров (labelDiff, Фаза 6) ───────────────────────────────────────
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
import { diffRenderLines, lineMaxDeltaMm } from '@/assets/labelDiff'
import type { LabelDiffReport, RenderLine } from '@/assets/labelDiff'

// import { printDocxFile } from '@/assets/printer'

const props = defineProps<{ payload: Record<string, any> }>()

watch(
  () => props.payload,
  (p) => {
    if (p.sn) {
    }
  },
  { immediate: true }
)

// Интерфейс для клиента
interface Client {
  clientId: string
  lastActive: string // ISO-строка даты
}

// Интерфейс для структуры ответа API
interface ClientsResponse {
  count: number
  clients: Client[]
}

const clientsData = ref<ClientsResponse | null>(null)

// Заголовки таблицы
const headers = [
  { title: 'ID Клиента', key: 'clientId' },
  { title: 'Последняя активность', key: 'lastActive' }
]

// Форматирование даты
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const dialog = ref(false)
const closeDialogAndCheck = () => {
  dialog.value = false
}

// .tmp\print-label.html
const print = () => {
  console.log('print')

  // printDocxFile('.tmp/DC.docx')
  //     .then(() => console.log('✔️ Печать завершена.'))
  //     .catch((err) => console.error('Ошибка при печати:', err));
}

const current = shallowRef(CheckListView)

const selectComponent = (component: string) => {
  dialog.value = true
  current.value = componentsMap[component] || null
}

const componentsMap: Record<string, any> = {
  checklist: CheckListView,
  defects: DefectsView,
  settings: SettingsView,
  znp: OrderToProduction,
  label: LabelEditor,
  svg: SVGeditor
}

const templateCheckList = ref('')
const doTemplate = async (e: string) => {
  try {
    await updateCheckList(selectedSP.value.split(' ')[0], {
      checkListTemplate: e
    })
    console.log('event', e)
  } catch (error) {
    console.log(error)
  }

  templateCheckList.value = e
}
const specifications = ref<Specification[] | null>(null)
const selectedSP = ref('')
const templateFromServer = ref('')
const checkListFromServer = ref<Specification['checkList'][] | null>(null)
const getSpecification = async () => {
  try {
    const sp = await fetchSpecifications()
    if (sp.data) {
      specifications.value = sp.data
      console.log(sp.data)

      checkListFromServer.value = specifications.value?.map((e) => e.checkList)
    }
  } catch (error) {
    console.log(error)
  }
}

watch(
  () => selectedSP.value,
  async (newValue) => {
    if (newValue) {
      //попробовать запросить чек лист
      try {
        const result = await fetchCheckList(newValue.split(' ')[0])
        console.log(newValue.split(' ')[0], result.data)
        if (result.data?.checkListTemplate) {
          templateFromServer.value = result.data?.checkListTemplate
          templateCheckList.value = result.data?.checkListTemplate
          console.log(templateCheckList.value, templateFromServer.value)
        } else {
          templateFromServer.value = ''
          templateCheckList.value = ''
        }
      } catch (e) {
        console.error('Invalid template string:', e)
      }
    }
  },
  { immediate: true }
)

onMounted(async () => {
  const result = await getClients()
  if (result.data) {
    clientsData.value = result.data
  }

  // await getSpecification()
})

const files = ref<DirectoryEntry[]>([])
const pdfData = ref<ArrayBuffer>()

const serverMount = async () => {
  // await server.mount('/KD', '//rucekaspinffs05.metran.local/Dept-MP/Production/Internal/Продукты/ТАУ/КД');
  try {
    await server.mount('/KD', './KD')
    console.log('server is mounted on /KD')
    await server.mount('/.temp', './temp')
    console.log('server is mounted on /KD')
  } catch (error) {
    console.log(error)
  }
  // await server.mount('/KD', '/KD');
  // await server.mount('/KD', './KD');
  // await events.on('trayMenuItemClicked', onTrayMenuItemClicked);
}

const readFile = async () => {
  pdfData.value = await filesystem.readBinaryFile(window.NL_PATH + '/temp/1.pdf')
  console.log(pdfData.value)
}

const copyDir = async () => {
  try {
    await filesystem.readDirectory(window.NL_PATH + '/KD')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/KD')
  }
  await filesystem.copy(pathsStore.paths.kd, window.NL_PATH + '/KD')
}

const openFile = async () => {
  console.log(window.NL_PATH)
  // await filesystem.createDirectory(window.NL_PATH + '/app-res');
  files.value = await filesystem.readDirectory(pathsStore.paths.kd)
  console.log('Content: ', files.value)
  let fileId = await filesystem.openFile(files.value[1].path)
  console.log(`ID: ${fileId}`)
}

// const createFile = async () => {
//   const htmlContent = `
//   <!DOCTYPE html>
//   <html lang="en">
//   <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>PDF Viewer</title>
//     <style>
//       body, html {
//         margin: 0;
//         padding: 0;
//         height: 100%;
//         overflow: hidden;
//       }
//       embed {
//         width: 100%;
//         height: 100%;
//       }
//     </style>
//   </head>
//   <body>
//     <embed src="http://127.0.0.1:8080/KD/19.5389.101.00 СБ.pdf" type="application/pdf" />
//   </body>
//   </html>
// `
//   // Функция для конвертации строки в Uint8Array
//   function stringToUint8Array(str: string) {
//     const encoder = new TextEncoder()
//     return encoder.encode(str)
//   }

//   // Преобразуем HTML в Uint8Array
//   const data = stringToUint8Array(htmlContent)
//   try {
//     await filesystem.readDirectory(window.NL_PATH + '/temp')
//   } catch (error) {
//     await filesystem.createDirectory(window.NL_PATH + '/temp')
//   }

//   // Запись файла в Neutralino
//   try {
//     await filesystem.writeBinaryFile(window.NL_PATH + '/temp/pdf-viewer.html', data)
//     console.log('Файл pdf-viewer.html успешно создан')
//   } catch (error) {
//     console.error('Ошибка при создании файла:', error)
//   }
//   try {
//     // Открываем новое окно
//     await neuWindow.create('/temp/pdf-viewer.html', {
//       x: 0,
//       y: 0,
//       width: 800,
//       height: 650,
//       maximizable: false,
//       exitProcessOnClose: true,
//       enableInspector: false,
//       processArgs: '--window-id=W_PDF'
//     })
//   } catch (error) {
//     console.log(error)
//   }
// }

const createWindow = async () => {
  // Открываем новое окно
  await neuWindow.create('/temp/pdf-viewer.html', {
    x: 0,
    y: 0,
    width: 800,
    height: 650,
    maximizable: false,
    exitProcessOnClose: true,
    enableInspector: false,
    processArgs: '--window-id=W_PDF'
  })
}

const newRenderPDF = async () => {
  // Функция для конвертации строки в ArrayBuffer
  function stringToArrayBuffer(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str).buffer // Возвращаем ArrayBuffer напрямую
  }
  console.log(pdfData.value)

  // Преобразуем ArrayBuffer в Blob
  const blob = new Blob([pdfData.value!], { type: 'application/pdf' })
  console.log(blob)
  // Создаем URL для Blob
  const pdfUrl = URL.createObjectURL(blob)
  console.log(pdfUrl)

  // Создаем HTML-страницу с встроенным PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>PDF Viewer</title>
      <style>
        body, html {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }
        embed {
          width: 100%;
          height: 100%;
        }
      </style>
    </head>
    <body>
      <embed src="${pdfUrl}" type="application/pdf" />
    </body>
    </html>
  `
  console.log(htmlContent)

  // Преобразуем HTML-строку в ArrayBuffer
  const htmlArrayBuffer = stringToArrayBuffer(htmlContent)

  try {
    await filesystem.readDirectory(window.NL_PATH + '/temp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/temp')
  }

  // Запись файла в Neutralino
  try {
    await filesystem.writeBinaryFile(
      window.NL_PATH + '/temp/pdf-viewer.html',
      htmlArrayBuffer as ArrayBuffer
    )
    console.log('Файл pdf-viewer.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  }
}

const createPDFJS = async () => {
  // Функция для конвертации строки в ArrayBuffer
  function stringToArrayBuffer2(str: string) {
    const encoder = new TextEncoder()
    return encoder.encode(str).buffer
  }

  // Ваш PDF в ArrayBuffer
  const pdfArrayBuffer2 = pdfData.value!

  // HTML-контент с использованием pdf.js
  const htmlContent2 = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PDF Viewer with pdf.js</title>
    <style>
      body, html {
        margin: 0;
        padding: 0;
        height: 100%;
        overflow: hidden;
      }
      #pdf-canvas {
      display: block;
      object-fit: cover;
        width: 100%;
        height: 100%;
      }
    </style>
    <!-- Подключаем pdf.js из CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.min.js"><\/script>
  </head>
  <body>
    <canvas id="pdf-canvas"></canvas>
    <script>
  async function renderPDF(pdfData) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js';
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.id = 'pdf-canvas-' + pageNum;
      document.body.appendChild(canvas);
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    }
  }

  const pdfData = new Uint8Array([${new Uint8Array(pdfArrayBuffer2).join(',')}]);
  renderPDF(pdfData);
    <\/script>
  </body>
  </html>
`

  // Преобразуем HTML в ArrayBuffer
  const htmlArrayBuffer2 = stringToArrayBuffer2(htmlContent2)

  try {
    await filesystem.readDirectory(window.NL_PATH + '/temp')
  } catch (error) {
    await filesystem.createDirectory(window.NL_PATH + '/temp')
  }

  // Записываем файл
  await filesystem.writeBinaryFile(
    window.NL_PATH + '/temp/pdf-viewer.html',
    htmlArrayBuffer2 as ArrayBuffer
  )
}

const tab = ref(null)

// ═══ Dev-панель «Сверка рендеров» (labelDiff, Фаза 6) ════════════════════════
// Аддитивная правка: не меняет существующие вкладки/функции DevView.
const labelStore = useLabelEditorStore()

const diffDialog = ref(false)
const diffRunning = ref(false)
const diffThresholdMm = ref(0.1)
const diffShowAll = ref(true)
const diffErrors = ref<string[]>([])
const diffWarnings = ref<string[]>([])
const diffReport = ref<LabelDiffReport | null>(null)
const diffHtmlLen = ref(0)
const diffSvgLen = ref(0)
const diffHtmlPreviewLen = ref(0)
const diffSvgPreviewLen = ref(0)
const diffLabelWpx = ref(0)
const diffLabelHpx = ref(0)
const diffHtmlLinesCache = ref<RenderLine[]>([])
const diffSvgLinesCache = ref<RenderLine[]>([])
const diffTdCache = ref<PrintTemplateData | null>(null)

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
const diffOverlayLines = ref<OverlayLine[]>([])

const diffScale = computed(() => {
  if (!diffLabelWpx.value || !diffLabelHpx.value) return 1
  return Math.min(1, 820 / diffLabelWpx.value, 460 / diffLabelHpx.value)
})

function openDiffDialog(): void {
  diffDialog.value = true
  void runDiff()
}

// Перестройка оверлея при переключении «показывать все строки»
watch(diffShowAll, () => {
  if (diffTdCache.value && diffHtmlLinesCache.value.length) {
    diffOverlayLines.value = buildOverlay(
      diffTdCache.value,
      diffHtmlLinesCache.value,
      diffSvgLinesCache.value,
      diffThresholdMm.value,
      diffShowAll.value
    )
  }
})

function buildTemplateDataFromStore(): PrintTemplateData {
  const els = labelStore.elements
  return {
    positions: { ...labelStore.positions },
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
    labelSize: { ...labelStore.labelSize },
    labelBorder: labelStore.labelBorder ? { ...labelStore.labelBorder } : undefined
  }
}

async function resolveProvider(fontFamily: string): Promise<TextMetricsProvider> {
  try {
    const font = await loadFont(fontFamily)
    return font ? createOpentypeTextMetricsProvider(font) : FALLBACK_TEXT_METRICS_PROVIDER
  } catch (e) {
    console.warn('[DevView.labelDiff] loadFont:', e)
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
    diffWarnings.value.push(
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
// центра блока (та же система координат, что у LabelCanvas dim-overlay/канваса).
// Красные рамки — строки, где delta > порога; серые — остальные (если showAll).
function buildOverlay(
  td: PrintTemplateData,
  htmlLines: RenderLine[],
  svgLines: RenderLine[],
  thresholdMm: number,
  showAll: boolean
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
      const diverging = maxDeltaMm > thresholdMm
      if (!diverging && !showAll) continue
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

async function runDiff(): Promise<void> {
  diffRunning.value = true
  diffErrors.value = []
  diffWarnings.value = []
  diffReport.value = null
  diffOverlayLines.value = []
  try {
    const td = buildTemplateDataFromStore()
    const data: CommonData = { ...(labelStore.batchCommonData as CommonData) }

    const wMM = td.labelSize.unit === 'mm' ? td.labelSize.width : td.labelSize.width / MM_TO_PX
    const hMM = td.labelSize.unit === 'mm' ? td.labelSize.height : td.labelSize.height / MM_TO_PX
    diffLabelWpx.value = wMM * MM_TO_PX
    diffLabelHpx.value = hMM * MM_TO_PX

    const textCount = Object.values(td.elements).filter((el) => el.type === 'text').length
    if (textCount === 0) {
      diffErrors.value.push(
        'В шаблоне нет текстовых элементов — нечего сверять. Откройте редактор этикеток и добавьте текст.'
      )
    }

    // 1) Реальные выходы рендереров (контроль пайплайна) — каждый в try/catch,
    // чтобы сбой одного пути (шрифты/fs/Neutralino) не ронял сверку.
    try {
      diffHtmlPreviewLen.value = (await renderLabelToHTML(td, data, '')).length
    } catch (e) {
      diffErrors.value.push('HTML-рендер: ' + (e as Error).message)
    }
    try {
      diffSvgPreviewLen.value = (await renderLabelToSVG(td, data, '', false)).length
    } catch (e) {
      diffErrors.value.push('SVG-рендер: ' + (e as Error).message)
    }

    // 2) Слои строк из одного buildTemplateData()
    const htmlLines = await buildHtmlLayer(td, data, '')
    const svgLines = await buildComputedLayer(td, data, '')
    diffHtmlLinesCache.value = htmlLines
    diffSvgLinesCache.value = svgLines
    diffTdCache.value = td
    diffHtmlLen.value = htmlLines.length
    diffSvgLen.value = svgLines.length

    // 3) Сверка с параметризуемым порогом
    diffReport.value = diffRenderLines(htmlLines, svgLines, {
      thresholdMm: diffThresholdMm.value
    })

    // 4) Оверлей
    diffOverlayLines.value = buildOverlay(
      td,
      htmlLines,
      svgLines,
      diffThresholdMm.value,
      diffShowAll.value
    )
  } catch (e) {
    diffErrors.value.push('Сверка прервана: ' + (e as Error).message)
  } finally {
    diffRunning.value = false
  }
}
</script>

<template>
  <v-container>
    <v-row>
      <v-col>
        <h1>DEV</h1>
      </v-col>
    </v-row>
  </v-container>
  <v-divider class="border-opacity-50" color="info"></v-divider>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('checklist')">
          Создание и редактирование чеклистов для функциональных тестов
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('defects')"> Работа с браком </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('znp')">
          Работа с заказом на производство
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('settings')">
          Настройки приложения
        </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('label')"> Печать этикеток </v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="gray" @click="selectComponent('svg')">SVG editor</v-btn>
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12">
        <v-btn block color="primary" @click="openDiffDialog"> Сверка рендеров (labelDiff) </v-btn>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog :fullscreen="true" v-model="dialog" width="100%">
    <v-toolbar height="40" color="white" density="compact">
      <v-spacer></v-spacer>
      <v-btn icon @click="closeDialogAndCheck">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-toolbar>
    <v-card>
      <component :is="current" />
      <template v-slot:actions> </template>
    </v-card>
  </v-dialog>

  <!-- ═══ Dev-панель «Сверка рендеров» (labelDiff, Фаза 6) ═══ -->
  <v-dialog v-model="diffDialog" width="1180" scrollable>
    <v-card>
      <v-toolbar height="40" color="primary" density="compact">
        <v-toolbar-title class="text-subtitle-1"
          >Сверка рендеров (HTML ↔ SVG · labelDiff)</v-toolbar-title
        >
        <v-spacer></v-spacer>
        <v-btn icon @click="diffDialog = false"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>
      <v-card-text>
        <v-row align="center">
          <v-col cols="2">
            <v-text-field
              v-model.number="diffThresholdMm"
              type="number"
              step="0.01"
              min="0"
              label="Порог, мм"
              density="compact"
              hide-details
              @change="runDiff"
            ></v-text-field>
          </v-col>
          <v-col cols="3">
            <v-switch
              v-model="diffShowAll"
              label="Все строки"
              density="compact"
              hide-details
            ></v-switch>
          </v-col>
          <v-col cols="4" class="text-caption grey--text text--darken-1">
            Порог по умолчанию 0.1 мм (допуск контракта). Сверка из одного buildTemplateData().
          </v-col>
          <v-col cols="3" class="text-right">
            <v-btn color="primary" :loading="diffRunning" @click="runDiff">Сверка</v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="diffErrors.length" type="error" density="compact" class="mt-2">
          <div v-for="(e, i) in diffErrors" :key="i">{{ e }}</div>
        </v-alert>
        <v-alert v-if="diffWarnings.length" type="warning" density="compact" class="mt-2">
          <div v-for="(w, i) in diffWarnings" :key="i">{{ w }}</div>
        </v-alert>

        <v-alert
          v-if="diffReport"
          :type="diffReport.aggregate.exceedsThreshold ? 'error' : 'success'"
          density="compact"
          class="mt-2"
        >
          Вердикт: <b>{{ diffReport.aggregate.exceedsThreshold ? 'FAIL' : 'PASS' }}</b> · max delta:
          {{ diffReport.aggregate.maxDeltaMm.toFixed(4) }} мм (порог {{ diffThresholdMm }} мм) ·
          строк: {{ diffReport.aggregate.comparedLines }} / {{ diffReport.aggregate.totalLines }} ·
          расхождений: {{ diffReport.discrepancies.length }}
        </v-alert>

        <v-row class="mt-3">
          <v-col cols="5">
            <div
              class="diff-canvas-wrap"
              :style="{
                width: diffLabelWpx * diffScale + 'px',
                height: diffLabelHpx * diffScale + 'px'
              }"
            >
              <div
                class="diff-canvas"
                :style="{
                  width: diffLabelWpx + 'px',
                  height: diffLabelHpx + 'px',
                  transform: 'scale(' + diffScale + ')',
                  transformOrigin: 'top left'
                }"
              >
                <div
                  v-for="(box, i) in diffOverlayLines"
                  :key="i"
                  class="diff-box-wrap"
                  :style="{
                    left: box.cx + 'px',
                    top: box.cy + 'px',
                    transform: box.rotation ? 'rotate(' + box.rotation + 'deg)' : undefined
                  }"
                >
                  <div
                    class="diff-box"
                    :class="box.diverging ? 'diff-box--bad' : 'diff-box--ok'"
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
                <div v-if="diffReport && !diffOverlayLines.length" class="diff-empty">
                  Нет строк для подсветки
                </div>
              </div>
            </div>
            <div class="text-caption mt-1">
              Оверлей в системе координат этикетки (мм → px, масштаб
              {{ diffScale.toFixed(2) }}). Красные рамки — строки с delta >
              {{ diffThresholdMm }} мм.
            </div>
          </v-col>
          <v-col cols="7">
            <div class="diff-report">
              <div v-if="!diffReport" class="diff-empty">Нажмите «Сверка»</div>
              <table v-else class="diff-table">
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
                    v-for="(d, i) in diffReport.discrepancies"
                    :key="i"
                    :class="{
                      'row--bad':
                        d.deltaMm > diffThresholdMm || d.axis === 'text' || d.axis === 'lines'
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
                  <tr v-if="!diffReport.discrepancies.length">
                    <td colspan="7" class="diff-empty">Расхождений нет — слои совпадают</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="text-caption mt-1">
              HTML-слой: {{ diffHtmlLen }} строк · SVG-слой: {{ diffSvgLen }} строк · HTML-строка:
              {{ diffHtmlPreviewLen }} симв. · SVG-строка: {{ diffSvgPreviewLen }} симв.
            </div>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </v-dialog>

  <ClientsApp />
  <AdminLog />
  <v-btn @click="openSecondWindow('path', 'Редактор этикеток', '', '/about', 'labelEditor')">
    Печать этикеток
  </v-btn>
  <!-- <button @click="readFile">readFile</button>
  <button @click="serverMount">mount server</button>
  <button @click="openFile">openFile</button>
  <button @click="createFile">createFile</button>
  <button @click="createWindow">createWindow</button>
  <button @click="copyDir">copyDir</button>
  {{ files }} -->
  <!-- <v-btn color="success" @click="getSpecification" >getSpecification</v-btn> -->

  <!-- <button @click="print">printDocxFile</button> -->
</template>

<style scoped>
.diff-canvas-wrap {
  position: relative;
  overflow: hidden;
  background: #fff;
  border: 1px solid #b0b0b0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}
.diff-canvas {
  position: relative;
  background:
    linear-gradient(#f5f5f5 1px, transparent 1px),
    linear-gradient(90deg, #f5f5f5 1px, transparent 1px);
  background-size: 20px 20px;
}
.diff-box-wrap {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}
.diff-box {
  position: absolute;
  border: 1.5px solid #f44336;
  box-sizing: border-box;
  background: rgba(244, 67, 54, 0.12);
}
.diff-box--bad {
  border-color: #f44336;
  background: rgba(244, 67, 54, 0.18);
}
.diff-box--ok {
  border-color: rgba(76, 175, 80, 0.55);
  background: rgba(76, 175, 80, 0.08);
}
.diff-empty {
  padding: 12px;
  text-align: center;
  color: #777;
}
.diff-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.diff-table th,
.diff-table td {
  border: 1px solid #e0e0e0;
  padding: 3px 6px;
  text-align: left;
  font-family: ui-monospace, Consolas, monospace;
}
.diff-table thead th {
  background: #f5f5f5;
  position: sticky;
  top: 0;
}
.diff-table .row--bad {
  background: rgba(244, 67, 54, 0.08);
}
.diff-report {
  max-height: 460px;
  overflow: auto;
  border: 1px solid #e0e0e0;
}
</style>
