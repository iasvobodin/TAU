/**
 * htmlRenderer.ts — чистый HTML-рендерер этикеток.
 *
 * Принимает тот же PrintTemplateData, что и SVG-рендерер (renderToSVG.ts).
 * Не содержит логики печати — только генерация HTML-строки.
 *
 * Всё позиционирование в процентах от размера этикетки.
 * Отступы берутся из TextRenderProps в мм и конвертируются в px.
 */

import bwipjs from 'bwip-js'
import { getFontBase64 } from '@/assets/renderToSVG'
import type {
  ElementPosition,
  PrintLabelElement,
  PrintTemplateData,
  CommonData,
  BatchItem
} from '@/types/label'
import { resolveTextProps } from '@/types/label'

const MM_TO_PX = 3.78

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

// ── Резолвер значения поля ────────────────────────────────────────────────────

function resolveValue(element: PrintLabelElement, data: CommonData, serial?: string): string {
  if (element.props.isSerial && serial !== undefined) return serial
  if (element.type === 'barcode') return serial ?? data['serial'] ?? data[element.dataField] ?? ''
  if (element.type === 'text') return data[element.dataField] ?? ''
  return ''
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

    // Базовые стили — позиция в процентах, overflow:hidden
    const baseStyle = [
      'position:absolute',
      `left:${pct.left.toFixed(4)}%`,
      `top:${pct.top.toFixed(4)}%`,
      `width:${pct.width.toFixed(4)}%`,
      `height:${pct.height.toFixed(4)}%`,
      'box-sizing:border-box',
      'overflow:hidden'
    ].join(';')

    if (element.type === 'text') {
      const fieldValue = resolveValue(element, data, serial)
      const tp = resolveTextProps(element.props)

      // Вертикальное выравнивание через align-items flex-контейнера
      const alignItems =
        tp.verticalAlign === 'top'
          ? 'flex-start'
          : tp.verticalAlign === 'bottom'
            ? 'flex-end'
            : 'center'

      // Горизонтальное — через justify-content (для визуального центрирования блока)
      // Сам text-align применяется к span внутри, чтобы работало при переносах
      const justifyContent =
        tp.align === 'center' ? 'center' : tp.align === 'right' ? 'flex-end' : 'flex-start'

      // Отступы: мм → px
      const padTop = (tp.paddingTop * MM_TO_PX).toFixed(2)
      const padRight = (tp.paddingRight * MM_TO_PX).toFixed(2)
      const padBottom = (tp.paddingBottom * MM_TO_PX).toFixed(2)
      const padLeft = (tp.paddingLeft * MM_TO_PX).toFixed(2)

      const style =
        baseStyle +
        ';' +
        [
          `font-size:${tp.fontSize}px`,
          `line-height:${tp.lineHeight}`,
          `font-weight:${tp.bold ? 'bold' : 'normal'}`,
          `font-family:'${tp.fontFamily}'`,
          'display:flex',
          `align-items:${alignItems}`,
          `justify-content:${justifyContent}`,
          `padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px`,
          'word-break:break-word'
        ].join(';')

      // span растягивается на всю ширину — text-align работает при переносах
      const safe = (fieldValue || '\u00A0')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      const inner = `<span style="width:100%;text-align:${tp.align}">${safe}</span>`
      elementsHTML += `<div style="${style}">${inner}</div>`
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
      const style = baseStyle + ';display:flex;align-items:center;justify-content:center'
      const inner = barcodeImage
        ? `<img src="${barcodeImage}" style="max-width:100%;max-height:100%;object-fit:contain"/>`
        : `<span style="color:#999">[Штрихкод]</span>`
      elementsHTML += `<div style="${style}">${inner}</div>`
    } else if (element.type === 'image') {
      const src = element.props.src ?? ''
      const style = baseStyle + ';display:flex;align-items:center;justify-content:center'
      const imageContent = src.trimStart().startsWith('<svg')
        ? `<div style="max-width:100%;max-height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center">${src}</div>`
        : `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain" alt=""/>`
      elementsHTML += `<div style="${style}">${imageContent}</div>`
    }
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
        renderLabelToHTML(templateData, { ...common, serial: item.serial }, item.serial)
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
