/**
 * htmlRenderer.ts — чистый HTML-рендерер этикеток.
 *
 * Принимает тот же PrintTemplateData, что и SVG-рендерер (renderToSVG.ts).
 * Не содержит логики печати — только генерация HTML-строки.
 *
 * Всё позиционирование в процентах от размера этикетки.
 * Отступы берутся из TextRenderProps в мм и конвертируются в px.
 *
 * ЕДИНАЯ РАСКЛАДКА ТЕКСТА (Фаза 4): строки текста — ЯВНЫЕ DOM-элементы на
 * вычисленных координатах из computeTextLayout() (textLayout.ts), а не
 * браузерный CSS-перенос / align-items / justify-content. Провайдер метрик —
 * общий opentype-адаптер (opentypeTextMetrics.ts) — тот же, что в SVG-рендерере,
 * поэтому HTML↔SVG совпадают ≤ 0.1 мм. Повороты 0/90/180/270 — внешний
 * transform:rotate(θ) вокруг центра блока (координаты строк в системе
 * «повёрнутого текста»).
 */

import bwipjs from 'bwip-js'
import { getFontBase64, loadFont, FALLBACK_TEXT_METRICS_PROVIDER } from '@/assets/renderToSVG'
import { createOpentypeTextMetricsProvider } from '@/assets/opentypeTextMetrics'
import { resolveValue } from '@/assets/resolveValue'
import { MM_TO_PX, computeTextLayout, getTextContainerBox } from '@/assets/textLayout'
import type { TextMetricsProvider } from '@/assets/textLayout'
import type {
  ElementPosition,
  PrintLabelElement,
  PrintTemplateData,
  LabelElementProps,
  CommonData,
  BatchItem,
  PrintLayoutConfig
} from '@/types/label'
import { resolveTextProps } from '@/types/label'

// ── Штрихкоды ─────────────────────────────────────────────────────────────────

async function generateDataMatrix(text: string, scale = 2): Promise<string> {
  const canvas = document.createElement('canvas')
  await bwipjs.toCanvas(canvas, { bcid: 'datamatrix', text, scale, height: 6, width: 6 })
  return canvas.toDataURL('image/png')
}

async function generateCode128(text: string, height = 6, scale = 2): Promise<string> {
  const canvas = document.createElement('canvas')
  await bwipjs.toCanvas(canvas, { bcid: 'code128', text, scale, height })
  return canvas.toDataURL('image/png')
}

// ── Позиция → CSS-проценты ────────────────────────────────────────────────────

function positionToPercent(
  pos: ElementPosition,
  labelWidthMM: number,
  labelHeightMM: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: (pos.x / labelWidthMM) * 100,
    top: (pos.y / labelHeightMM) * 100,
    width: (pos.w / labelWidthMM) * 100,
    height: (pos.h / labelHeightMM) * 100
  }
}

// ── HTML-эскейпинг ────────────────────────────────────────────────────────────
// Порядок важен: сначала &, затем <, >, " и ' — чтобы уже экранированные
// сущности не экранировались повторно. Раньше `.replace(/&/g, '&')` был no-op
// (символ & оставался неэкранированным — баг из плана 3.2.2). Замены строятся
// через String.fromCharCode(38) + суффикс, чтобы исходный код не содержал
// литеральных HTML-сущностей.
function escapeHTML(value: string): string {
  const amp = String.fromCharCode(38) // '&'
  return value
    .replace(/&/g, amp + 'amp;')
    .replace(/</g, amp + 'lt;')
    .replace(/>/g, amp + 'gt;')
    .replace(/"/g, amp + 'quot;')
    .replace(/'/g, amp + '#39;')
}

// ── Текстовый элемент → HTML (единая раскладка из textLayout.ts) ─────────────
// Строки — ЯВНЫЕ DOM-элементы (абсолютно позиционированные <div> на координатах
// из computeTextLayout), а не браузерный перенос / align-items / justify-content.
// top = baselineY - ascender, left = xPx — относительно внутренней области
// (без паддингов). Поворот — внешний rotate вокруг центра блока.
async function renderTextElementHTML(
  element: PrintLabelElement,
  pos: ElementPosition,
  pct: { left: number; top: number; width: number; height: number },
  fieldValue: string
): Promise<string> {
  const tp = resolveTextProps(element.props)
  const textRotation = (element.props.textRotation ?? 0) as 0 | 90 | 180 | 270

  // Повёрнутый контейнер строк (единый источник с computeTextLayout): при 90/270
  // оси свопаются (wrapW=innerH, wrapH=innerW) и контейнер центрируется, чтобы
  // внешний rotate(θ) вокруг центра контейнера держал текст внутри блока.
  const box = getTextContainerBox(pos.w * MM_TO_PX, pos.h * MM_TO_PX, tp, textRotation)

  // Метрики — из opentype-шрифта (общий адаптер с SVG-рендерером). Если шрифт
  // не загружен — консервативный fallback-провайдер (тот же, что в SVG).
  const font = await loadFont(tp.fontFamily)
  const provider: TextMetricsProvider = font
    ? createOpentypeTextMetricsProvider(font)
    : FALLBACK_TEXT_METRICS_PROVIDER

  // Единая раскладка: wrap + align + verticalAlign + поворот 0/90/180/270.
  // Координаты строк — в системе «повёрнутого текста» (от 0,0 контейнера box);
  // внешний rotate(θ) вокруг центра контейнера добавляется ниже.
  const layout = computeTextLayout({
    text: fieldValue || ' ',
    tp,
    blockWmm: pos.w,
    blockHmm: pos.h,
    textRotation,
    provider
  })

  const ascPx = provider.ascenderPx(tp.fontSize)

  const lineBaseStyle = [
    `font-size:${tp.fontSize}px`,
    `font-family:'${tp.fontFamily}'`,
    `font-weight:${tp.bold ? 'bold' : 'normal'}`,
    `color:${tp.textColor}`
  ].join(';')

  // ЯВНЫЕ строки: absolute-позиционирование, top = baselineY - ascender,
  // left = xPx (координаты из computeTextLayout). white-space:pre — браузерный
  // перенос строк НЕ используется (строки уже разложены единым алгоритмом).
  const linesHtml = layout.lines
    .map((ln) => {
      const text = escapeHTML(ln.text || '\u00A0')
      const top = (ln.baselineYPx - ascPx).toFixed(2)
      const left = ln.xPx.toFixed(2)
      const width = ln.widthPx.toFixed(2)
      return `<div style="position:absolute;left:${left}px;top:${top}px;width:${width}px;white-space:pre;${lineBaseStyle}">${text}</div>`
    })
    .join('\n')

  // Повёрнутый контейнер строк — система координат для строк (box из getTextContainerBox).
  // При 90/270 ширина/высота свопаются и контейнер центрируется относительно блока.
  const contentStyle = [
    'position:absolute',
    `left:${box.x.toFixed(2)}px`,
    `top:${box.y.toFixed(2)}px`,
    `width:${box.w.toFixed(2)}px`,
    `height:${box.h.toFixed(2)}px`,
    'box-sizing:border-box'
  ].join(';')

  // Внешний контейнер — блок элемента. Только позиционирование и обрезка по габаритам
  // блока (overflow:hidden). ВАЖНО: НЕ вешаем сюда transform:rotate — overflow:hidden
  // режет содержимое в НЕПОВЁРНУТОЙ локальной системе элемента, а контейнер строк при
  // 90/270 намеренно выступает за блок по вертикали (чтобы внешний rotate(θ) вокруг
  // центра вернул его на место). Если rotate и overflow окажутся на одном элементе,
  // верх/низ повёрнутого контейнера обрезается до поворота — «невидимые рамки сверху
  // и снизу». Поэтому поворот вынесен на промежуточный rotator (полный размер блока) —
  // как в канвасе (getTextRotatorStyle) и SVG (<g transform="rotate(θ cx cy)">).
  const outerStyle = [
    'position:absolute',
    `left:${pct.left.toFixed(4)}%`,
    `top:${pct.top.toFixed(4)}%`,
    `width:${pct.width.toFixed(4)}%`,
    `height:${pct.height.toFixed(4)}%`,
    'box-sizing:border-box',
    'overflow:hidden'
  ].join(';')

  // Промежуточный rotator: полный размер блока, единый внешний rotate(θ) вокруг центра
  // (transform-origin:center center). БЕЗ overflow:hidden — иначе обрезка снова была бы
  // в неповёрнутой системе. После поворота контейнер строк ложится точно в габариты
  // блока, поэтому overflow:hidden внешнего блока ничего не срезает.
  const contentHtml = `<div style="${contentStyle}">${linesHtml}</div>`
  const innerHtml = textRotation
    ? `<div style="position:absolute;left:0;top:0;width:100%;height:100%;transform:rotate(${textRotation}deg);transform-origin:center center">${contentHtml}</div>`
    : contentHtml

  return `<div style="${outerStyle}">${innerHtml}</div>`
}

// ── Сетка таблицы → HTML ─────────────────────────────────────────────────────
// Добавляет рамки вокруг ячеек таблицы при showBorders = true.
// Позиции вычисляются математически из параметров table-контейнера.
function renderTableGridHTML(
  pos: ElementPosition,
  props: LabelElementProps,
  labelWidthMM: number,
  labelHeightMM: number
): string {
  const {
    tableRows,
    tableCols,
    tableCellWidth,
    tableCellHeight,
    tableGapH,
    tableGapV,
    tableShowBorders,
    tableOutline
  } = props
  if (!tableShowBorders && !tableOutline) return ''

  const rows = tableRows ?? 5
  const cols = tableCols ?? 5
  const cw = tableCellWidth ?? 17
  const ch = tableCellHeight ?? 9
  const gapH = tableGapH ?? 0.4
  const gapV = tableGapV ?? 0.4

  const pctX = (pos.x / labelWidthMM) * 100
  const pctY = (pos.y / labelHeightMM) * 100
  const cwPct = (cw / labelWidthMM) * 100
  const chPct = (ch / labelHeightMM) * 100
  const gapHPct = (gapH / labelWidthMM) * 100
  const gapVPct = (gapV / labelHeightMM) * 100

  const divs: string[] = []
  // Границы ячеек (только если включены)
  if (tableShowBorders) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const left = pctX + c * (cwPct + gapHPct)
        const top = pctY + r * (chPct + gapVPct)
        divs.push(`<div style="
          position:absolute;
          left:${left.toFixed(4)}%;
          top:${top.toFixed(4)}%;
          width:${cwPct.toFixed(4)}%;
          height:${chPct.toFixed(4)}%;
          border:1px solid #999;
          box-sizing:border-box;
          pointer-events:none;
        "></div>`)
      }
    }
  }
  // Контур вокруг всей таблицы (только если включён)
  if (tableOutline) {
    const totalWPct = ((cols * cw + (cols - 1) * gapH) / labelWidthMM) * 100
    const totalHPct = ((rows * ch + (rows - 1) * gapV) / labelHeightMM) * 100
    divs.push(`<div style="
      position:absolute;
      left:${pctX.toFixed(4)}%;
      top:${pctY.toFixed(4)}%;
      width:${totalWPct.toFixed(4)}%;
      height:${totalHPct.toFixed(4)}%;
      border:1.5px solid #333;
      box-sizing:border-box;
      pointer-events:none;
    "></div>`)
  }
  return divs.join('\n')
}

// ── Одна этикетка → HTML-строка ───────────────────────────────────────────────

export async function renderLabelToHTML(
  templateData: PrintTemplateData,
  data: CommonData,
  serial?: string
): Promise<string> {
  const { positions, elements, labelSize } = templateData

  const widthMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const heightMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX
  const widthPX = widthMM * MM_TO_PX
  const heightPX = heightMM * MM_TO_PX

  let elementsHTML = ''

  for (const [id, element] of Object.entries(elements)) {
    const pos = positions[id]
    if (!pos) continue

    const pct = positionToPercent(pos, widthMM, heightMM)

    // Внешний контейнер — оригинальная позиция и размер
    const outerStyle = [
      'position:absolute',
      `left:${pct.left.toFixed(4)}%`,
      `top:${pct.top.toFixed(4)}%`,
      `width:${pct.width.toFixed(4)}%`,
      `height:${pct.height.toFixed(4)}%`,
      'box-sizing:border-box',
      'overflow:hidden'
    ].join(';')

    if (element.type === 'text') {
      const fieldValue = resolveValue(element, data, serial, elements)
      elementsHTML += await renderTextElementHTML(element, pos, pct, fieldValue)
    } else if (element.type === 'barcode') {
      const fieldValue = resolveValue(element, data, serial)
      let barcodeImage = ''
      if (fieldValue) {
        barcodeImage =
          element.props.barcodeType === 'datamatrix'
            ? await generateDataMatrix(fieldValue, element.props.barcodeScale ?? 2)
            : await generateCode128(
                fieldValue,
                element.props.barcodeHeight ?? 6,
                element.props.barcodeScale ?? 2
              )
      }
      const style = outerStyle + ';display:flex;align-items:center;justify-content:center'
      const inner = barcodeImage
        ? `<img src="${barcodeImage}" style="max-width:100%;max-height:100%;object-fit:contain"/>`
        : `<span style="color:#999">[Штрихкод]</span>`
      elementsHTML += `<div style="${style}">${inner}</div>`
    } else if (element.type === 'image') {
      const src = element.props.src ?? ''
      const style = outerStyle + ';display:flex;align-items:center;justify-content:center'
      const imageContent = src.trimStart().startsWith('<svg')
        ? `<div style="max-width:100%;max-height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center">${src}</div>`
        : `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain" alt=""/>`
      elementsHTML += `<div style="${style}">${imageContent}</div>`
    } else if (element.type === 'table') {
      // Контейнер таблицы пропускаем — ячейки рендерятся как text
      // Сетка отрисовывается отдельным проходом ниже
      continue
    }

    // Добавляем контур (outline) для элемента (не для контейнера таблицы)
    if (element.props.outlineEnabled) {
      const ow = ((element.props.outlineWidth ?? 0.5) * MM_TO_PX).toFixed(2)
      const oc = element.props.outlineColor ?? '#333'
      elementsHTML += `<div style="
        position:absolute;
        left:${pct.left.toFixed(4)}%;
        top:${pct.top.toFixed(4)}%;
        width:${pct.width.toFixed(4)}%;
        height:${pct.height.toFixed(4)}%;
        border:${ow}px solid ${oc};
        box-sizing:border-box;
        pointer-events:none;
      "></div>`
    }
  }

  // Второй проход: рендеринг сетки для table-контейнеров
  for (const [id, element] of Object.entries(elements)) {
    if (element.type !== 'table') continue
    const pos = positions[id]
    if (!pos) continue
    const gridHtml = renderTableGridHTML(pos, element.props, widthMM, heightMM)
    if (gridHtml) elementsHTML += gridHtml
  }

  // Рамка всей этикетки
  if (templateData.labelBorder?.enabled) {
    const bw = ((templateData.labelBorder.width ?? 1.0) * MM_TO_PX).toFixed(2)
    const color = templateData.labelBorder.color ?? '#000'
    elementsHTML += `<div style="
      position:absolute;
      left:0;top:0;
      width:100%;height:100%;
      border:${bw}px solid ${color};
      box-sizing:border-box;
      pointer-events:none;
    "></div>`
  }

  return `<div class="page" style="width:${widthPX.toFixed(2)}px;height:${heightPX.toFixed(2)}px;position:relative">${elementsHTML}</div>`
}

// ── @font-face CSS для встроенных шрифтов ────────────────────────────────────

export async function buildFontFaceCSS(templateData: PrintTemplateData): Promise<string> {
  const families = new Set<string>()
  for (const el of Object.values(templateData.elements)) {
    if (el.type === 'text' && el.props.fontFamily) families.add(el.props.fontFamily)
  }
  const blocks: string[] = []
  for (const family of families) {
    const dataUrl = await getFontBase64(family)
    if (dataUrl) {
      blocks.push(
        `@font-face { font-family: '${family}'; src: url("${dataUrl}"); font-weight: normal; font-style: normal; }`
      )
    }
  }
  return blocks.join('\n')
}

// ── Пакет этикеток → полная HTML-страница ─────────────────────────────────────

export async function renderLabelsToHTMLPage(
  items: BatchItem[],
  common: CommonData,
  templateData: PrintTemplateData
): Promise<string> {
  const [pagesHtml, fontFaceCSS] = await Promise.all([
    Promise.all(
      items.map((item) =>
        renderLabelToHTML(templateData, { ...common, ...item } as CommonData, item.serial ?? '')
      )
    ),
    buildFontFaceCSS(templateData)
  ])

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Labels</title>
  <style>
    ${fontFaceCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .page { position: relative; page-break-after: always; overflow: hidden; }
    @media print {
      @page { margin: 0; size: auto; }
      body  { margin: 0; }
    }
  </style>
</head>
<body>${pagesHtml.join('')}</body>
</html>`
}

// ── Multi-label: одна страница-лист с N этикетками ───────────────────────────

/**
 * Рендерит один физический лист с несколькими этикетками, расположенными в grid.
 * @param sheetItems — элементы для этого листа (максимум cols*rows штук)
 * @param common — общие данные
 * @param templateData — шаблон этикетки
 * @param layout — настройки компоновки
 */
export async function renderLabelSheetToHTML(
  sheetItems: BatchItem[],
  common: CommonData,
  templateData: PrintTemplateData,
  layout: PrintLayoutConfig
): Promise<string> {
  const { positions, elements, labelSize } = templateData
  const twMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const thMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX

  const swMM = layout.sheetWidth
  const shMM = layout.sheetHeight

  // Рендерим каждую мини-этикетку как отдельный HTML-блок
  const labelsHtml: string[] = []

  for (let i = 0; i < sheetItems.length; i++) {
    const col = i % layout.cols
    const row = Math.floor(i / layout.cols)
    if (row >= layout.rows) break // не выходим за пределы листа

    const item = sheetItems[i]
    const itemData = { ...common, ...item } as CommonData

    // Рендерим этикетку как обычно, но с её собственным размером
    const labelHtml = await renderLabelToHTML(templateData, itemData, item.serial ?? '')

    // Вычисляем позицию на листе в мм
    const leftMM = layout.marginLeft + col * (twMM + layout.gapX)
    const topMM = layout.marginTop + row * (thMM + layout.gapY)

    // Оборачиваем каждую этикетку в контейнер с абсолютным позиционированием
    const leftPx = (leftMM * MM_TO_PX).toFixed(2)
    const topPx = (topMM * MM_TO_PX).toFixed(2)
    const wPx = (twMM * MM_TO_PX).toFixed(2)
    const hPx = (thMM * MM_TO_PX).toFixed(2)

    labelsHtml.push(`<div style="
      position:absolute;
      left:${leftPx}px;
      top:${topPx}px;
      width:${wPx}px;
      height:${hPx}px;
      overflow:hidden;
    ">${labelHtml}</div>`)
  }

  const swPx = (swMM * MM_TO_PX).toFixed(2)
  const shPx = (shMM * MM_TO_PX).toFixed(2)

  return `<div class="page" style="width:${swPx}px;height:${shPx}px;position:relative;overflow:hidden;">${labelsHtml.join('')}</div>`
}

/**
 * Генерирует полную HTML-страницу для multi-label печати.
 * Каждый лист содержит несколько этикеток.
 */
export async function renderLabelSheetsToHTMLPage(
  sheets: BatchItem[][],
  common: CommonData,
  templateData: PrintTemplateData,
  layout: PrintLayoutConfig
): Promise<string> {
  const swMM = layout.sheetWidth
  const shMM = layout.sheetHeight

  const [pagesHtml, fontFaceCSS] = await Promise.all([
    Promise.all(
      sheets.map((sheetItems) => renderLabelSheetToHTML(sheetItems, common, templateData, layout))
    ),
    buildFontFaceCSS(templateData)
  ])

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Labels (Multi)</title>
  <style>
    ${fontFaceCSS}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { margin: 0; padding: 0; }
    .page { position: relative; page-break-after: always; overflow: hidden; }
    @media print {
      @page { margin: 0; size: ${swMM}mm ${shMM}mm; }
      body  { margin: 0; }
    }
  </style>
</head>
<body>${pagesHtml.join('')}</body>
</html>`
}
