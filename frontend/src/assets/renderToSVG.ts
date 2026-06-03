/**
 * renderToSVG.ts — векторный SVG-рендерер этикеток.
 *
 * Что делает:
 *   - Текст → SVG path через opentype.js (с корректным вертикальным выравниванием)
 *   - Штрихкоды → SVG path через bwip-js toSVG
 *   - Растровые изображения → <image> base64
 *   - SVG-изображения → inline
 *
 * Принимает тот же PrintTemplateData и CommonData, что и htmlRenderer.ts.
 * Все отступы — в мм (TextRenderProps.paddingTop/Right/Bottom/Left).
 */

import opentype from 'opentype.js'
import bwipjs from 'bwip-js'
import { filesystem } from '@neutralinojs/lib'
import { fontManager } from './fontManager'
import type {
  PrintTemplateData,
  PrintLabelElement,
  ElementPosition,
  CommonData,
  TextRenderProps
} from '@/types/label'
import { resolveTextProps } from '@/types/label'

// ─── Константы ───────────────────────────────────────────────────────────────

const MM_TO_PX = 3.78

const APP_FONTS_DIR = `${window.NL_PATH}/.tmp/fonts`

// ─── Типы ────────────────────────────────────────────────────────────────────

export interface FontItem {
  label: string
  value: string
  svgPreviewPath: string
}

// Обратная совместимость — labelEditor.ts импортирует FontInfo
export type FontInfo = FontItem

// ─── Кэши ────────────────────────────────────────────────────────────────────

const loadedFonts = new Set<string>()
const fontCache = new Map<string, opentype.Font | null>()
const fontBufCache = new Map<string, ArrayBuffer>()

// ─── Загрузка бинарника шрифта ────────────────────────────────────────────────

async function readFontBuffer(
  fullName: string
): Promise<{ buf: ArrayBuffer; path: string } | null> {
  const key = fullName.toLowerCase()

  const cached = fontBufCache.get(key)
  if (cached) {
    const path = fontManager.getPathByFullName(fullName) ?? `${APP_FONTS_DIR}/${fullName}.ttf`
    return { buf: cached, path }
  }

  let path = fontManager.getPathByFullName(fullName)

  if (!path) {
    for (const ext of ['ttf', 'otf']) {
      const fallback = `${APP_FONTS_DIR}/${fullName}.${ext}`
      try {
        const buf = await filesystem.readBinaryFile(fallback)
        fontBufCache.set(key, buf)
        return { buf, path: fallback }
      } catch {
        /* следующий */
      }
    }
    console.warn(`[renderToSVG] шрифт не найден: "${fullName}"`)
    return null
  }

  try {
    const buf = await filesystem.readBinaryFile(path)
    fontBufCache.set(key, buf)
    return { buf, path }
  } catch {
    console.warn(`[renderToSVG] не удалось прочитать файл шрифта: ${path}`)
    return null
  }
}

// ─── Публичное API ────────────────────────────────────────────────────────────

/**
 * Base64 data URL шрифта — используется htmlRenderer для @font-face.
 */
export async function getFontBase64(family: string): Promise<string | null> {
  const result = await readFontBuffer(family)
  if (!result) return null
  const { buf, path } = result
  const ext = path.split('.').pop()?.toLowerCase()
  const mime = ext === 'otf' ? 'font/otf' : 'font/truetype'
  const b64 = btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))
  return `data:${mime};base64,${b64}`
}

/**
 * Регистрирует шрифт через FontFace API + инжект <style>.
 * Вызывается при выборе шрифта пользователем.
 */
export async function ensureFontFace(fullName: string): Promise<boolean> {
  const key = fullName.toLowerCase()
  if (loadedFonts.has(key)) return true

  const result = await readFontBuffer(fullName)
  if (!result) return false

  const { buf, path } = result
  const ext = path.split('.').pop()?.toLowerCase() ?? 'ttf'
  const mime = ext === 'otf' ? 'font/otf' : 'font/truetype'
  const b64 = btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))

  try {
    const face = new FontFace(fullName, buf)
    await face.load()
    document.fonts.add(face)

    const injectId = `ff-${key.replace(/[^a-z0-9]/g, '-')}`
    if (!document.getElementById(injectId)) {
      const style = document.createElement('style')
      style.id = injectId
      style.textContent = `@font-face { font-family: "${fullName}"; src: url("data:${mime};base64,${b64}"); font-weight: normal; font-style: normal; }`
      document.head.appendChild(style)
    }

    loadedFonts.add(key)
    return true
  } catch (e) {
    console.error(`[ensureFontFace] ошибка при загрузке "${fullName}":`, e)
    return false
  }
}

/**
 * Загружает opentype.Font для SVG-рендерера.
 */
export async function loadFont(family: string): Promise<opentype.Font | null> {
  const key = family.toLowerCase()
  if (fontCache.has(key)) return fontCache.get(key)!

  const result = await readFontBuffer(family)
  if (!result) {
    fontCache.set(key, null)
    return null
  }

  const { buf } = result
  try {
    if (!loadedFonts.has(key)) {
      const face = new FontFace(family, buf)
      await face.load()
      document.fonts.add(face)
      loadedFonts.add(key)
    }
    const font = opentype.parse(buf)
    fontCache.set(key, font)
    return font
  } catch (e) {
    console.warn(`[SVG renderer] не удалось разобрать шрифт "${family}":`, e)
    fontCache.set(key, null)
    return null
  }
}

// ─── Word wrap ────────────────────────────────────────────────────────────────

interface WrappedLine {
  text: string
  widthPx: number
}

function wrapText(
  font: opentype.Font,
  text: string,
  fontSizePx: number,
  maxWidthPx: number
): WrappedLine[] {
  function measureStr(s: string) {
    return font.getAdvanceWidth(s, fontSizePx)
  }
  const spaceW = measureStr(' ')
  const result: WrappedLine[] = []

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ').filter(Boolean)
    if (!words.length) {
      result.push({ text: '', widthPx: 0 })
      continue
    }

    let line = words[0]
    let lineW = measureStr(words[0])

    for (let i = 1; i < words.length; i++) {
      const wW = measureStr(words[i])
      if (lineW + spaceW + wW <= maxWidthPx) {
        line += ' ' + words[i]
        lineW += spaceW + wW
      } else {
        result.push({ text: line, widthPx: lineW })
        line = words[i]
        lineW = wW
      }
    }
    result.push({ text: line, widthPx: lineW })
  }
  return result
}

// ─── Текст → SVG path ─────────────────────────────────────────────────────────

function renderTextPaths(
  opts: TextRenderProps & {
    text: string
    font: opentype.Font
    x: number // мм
    y: number // мм
    w: number // мм
    h: number // мм
  }
): string {
  const {
    text,
    font,
    x,
    y,
    w,
    h,
    fontSize: fontSizePx,
    align,
    verticalAlign,
    lineHeight,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft
  } = opts

  // Координаты блока в px
  const xPx = x * MM_TO_PX
  const yPx = y * MM_TO_PX
  const wPx = w * MM_TO_PX
  const hPx = h * MM_TO_PX

  // Отступы мм → px
  const padTopPx = paddingTop * MM_TO_PX
  const padRightPx = paddingRight * MM_TO_PX
  const padBottomPx = paddingBottom * MM_TO_PX
  const padLeftPx = paddingLeft * MM_TO_PX

  // Рабочая область с учётом отступов
  const innerX = xPx + padLeftPx
  const innerY = yPx + padTopPx
  const innerW = Math.max(1, wPx - padLeftPx - padRightPx)
  const innerH = Math.max(1, hPx - padTopPx - padBottomPx)

  const lineH = fontSizePx * lineHeight
  const asc = (font.ascender / font.unitsPerEm) * fontSizePx

  const lines = wrapText(font, text, fontSizePx, innerW)
  const totalH = lines.length * lineH

  // Вертикальное выравнивание текстового блока внутри рабочей области
  let baselineY: number
  if (verticalAlign === 'top') {
    baselineY = innerY + asc
  } else if (verticalAlign === 'bottom') {
    baselineY = innerY + innerH - totalH + asc
  } else {
    // middle (по умолчанию)
    baselineY = innerY + (innerH - totalH) / 2 + asc
  }

  return lines
    .map((ln, i) => {
      if (!ln.text) return ''
      // Горизонтальное выравнивание строки внутри рабочей области
      let lx = innerX
      if (align === 'center') lx = innerX + (innerW - ln.widthPx) / 2
      if (align === 'right') lx = innerX + innerW - ln.widthPx

      const ly = baselineY + i * lineH
      const svgStr = font.getPath(ln.text, lx, ly, fontSizePx).toSVG(2)
      const d = svgStr.match(/d="([^"]+)"/)?.[1]
      return d ? `<path d="${d}" fill="#000"/>` : ''
    })
    .filter(Boolean)
    .join('\n')
}

// ─── Штрихкод → SVG group ─────────────────────────────────────────────────────

function renderBarcodeSVG(
  barcodeType: 'code128' | 'datamatrix',
  text: string,
  props: PrintLabelElement['props'],
  pos: ElementPosition
): string {
  let rawSVG: string
  try {
    rawSVG =
      barcodeType === 'datamatrix'
        ? // @ts-ignore
          bwipjs.toSVG({
            bcid: 'datamatrix',
            text,
            scale: props.barcodeScale ?? 2,
            height: 6,
            width: 6,
            pad: 1
          })
        : // @ts-ignore
          bwipjs.toSVG({
            bcid: 'code128',
            text,
            scale: props.barcodeScale ?? 2,
            height: props.barcodeHeight ?? 6
          })
  } catch (e) {
    console.error('[SVG renderer] Barcode error:', e)
    return `<rect x="${(pos.x * MM_TO_PX).toFixed(2)}" y="${(pos.y * MM_TO_PX).toFixed(2)}"
      width="${(pos.w * MM_TO_PX).toFixed(2)}" height="${(pos.h * MM_TO_PX).toFixed(2)}"
      fill="none" stroke="#ccc" stroke-dasharray="4"/>`
  }

  const vbMatch = rawSVG.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!vbMatch) return ''
  const natW = parseFloat(vbMatch[1])
  const natH = parseFloat(vbMatch[2])
  const destW = pos.w * MM_TO_PX
  const destH = pos.h * MM_TO_PX
  const scale = Math.min(destW / natW, destH / natH)
  const ox = pos.x * MM_TO_PX + (destW - natW * scale) / 2
  const oy = pos.y * MM_TO_PX + (destH - natH * scale) / 2

  const inner = rawSVG
    .replace(/<svg[^>]*>/, '')
    .replace(/<\/svg>/, '')
    .trim()
  return `<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>`
}

// ─── Изображение → SVG ────────────────────────────────────────────────────────

function renderImageSVG(src: string, pos: ElementPosition): string {
  if (!src) return ''
  const x = (pos.x * MM_TO_PX).toFixed(2)
  const y = (pos.y * MM_TO_PX).toFixed(2)
  const w = (pos.w * MM_TO_PX).toFixed(2)
  const h = (pos.h * MM_TO_PX).toFixed(2)

  if (src.trimStart().startsWith('<svg') || src.startsWith('data:image/svg')) {
    const rawSVG = src.startsWith('data:image/svg') ? atob(src.split(',')[1]) : src
    const vbMatch = rawSVG.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
    const inner = rawSVG
      .replace(/<svg[^>]*>/, '')
      .replace(/<\/svg>/, '')
      .trim()

    if (vbMatch) {
      const natW = parseFloat(vbMatch[1])
      const natH = parseFloat(vbMatch[2])
      const destW = pos.w * MM_TO_PX
      const destH = pos.h * MM_TO_PX
      const scale = Math.min(destW / natW, destH / natH)
      const ox = pos.x * MM_TO_PX + (destW - natW * scale) / 2
      const oy = pos.y * MM_TO_PX + (destH - natH * scale) / 2
      return `<g transform="translate(${ox.toFixed(2)},${oy.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>`
    }
    return `<g transform="translate(${x},${y})">${inner}</g>`
  }

  return `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
}

// ─── Резолвер значения поля ───────────────────────────────────────────────────

function resolveValue(el: PrintLabelElement, data: CommonData, serial?: string): string {
  if (el.props.isSerial && serial !== undefined) return serial
  if (el.type === 'barcode') return serial ?? data['serial'] ?? data[el.dataField] ?? ''
  return data[el.dataField] ?? ''
}

// ─── Одна этикетка → SVG строка ──────────────────────────────────────────────

export async function renderLabelToSVG(
  templateData: PrintTemplateData,
  data: CommonData,
  serial?: string
): Promise<string> {
  const { positions, elements, labelSize } = templateData
  const wMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const hMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX
  const wPX = (wMM * MM_TO_PX).toFixed(2)
  const hPX = (hMM * MM_TO_PX).toFixed(2)

  const parts: string[] = []

  for (const [id, el] of Object.entries(elements)) {
    const pos = positions[id]
    if (!pos) continue

    if (el.type === 'text') {
      const fieldValue = resolveValue(el, data, serial)
      const tp = resolveTextProps(el.props)
      const font = await loadFont(tp.fontFamily)

      if (font) {
        parts.push(
          renderTextPaths({
            ...tp,
            text: fieldValue || ' ',
            font,
            x: pos.x,
            y: pos.y,
            w: pos.w,
            h: pos.h
          })
        )
      } else {
        // Fallback — SVG <text> без конвертации в path
        const xPx = (pos.x * MM_TO_PX + tp.paddingLeft * MM_TO_PX).toFixed(2)
        const cxPx = (pos.x * MM_TO_PX + (pos.w * MM_TO_PX) / 2).toFixed(2)
        const rxPx = (pos.x * MM_TO_PX + pos.w * MM_TO_PX - tp.paddingRight * MM_TO_PX).toFixed(2)

        // Вертикальное выравнивание для fallback <text>
        const innerH = pos.h * MM_TO_PX - tp.paddingTop * MM_TO_PX - tp.paddingBottom * MM_TO_PX
        let yPx: number
        if (tp.verticalAlign === 'top') {
          yPx = pos.y * MM_TO_PX + tp.paddingTop * MM_TO_PX + tp.fontSize * 0.8
        } else if (tp.verticalAlign === 'bottom') {
          yPx = pos.y * MM_TO_PX + tp.paddingTop * MM_TO_PX + innerH - tp.fontSize * 0.2
        } else {
          yPx = pos.y * MM_TO_PX + tp.paddingTop * MM_TO_PX + innerH / 2
        }

        const anchor = tp.align === 'center' ? 'middle' : tp.align === 'right' ? 'end' : 'start'
        const tx = tp.align === 'center' ? cxPx : tp.align === 'right' ? rxPx : xPx
        const dominantBaseline =
          tp.verticalAlign === 'top'
            ? 'text-before-edge'
            : tp.verticalAlign === 'bottom'
              ? 'text-after-edge'
              : 'middle'
        const safe = (fieldValue || ' ')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        parts.push(
          `<text x="${tx}" y="${yPx.toFixed(2)}" font-family="${tp.fontFamily}" font-size="${tp.fontSize}"` +
            ` font-weight="${tp.bold ? 'bold' : 'normal'}" text-anchor="${anchor}"` +
            ` dominant-baseline="${dominantBaseline}" fill="#000">${safe}</text>`
        )
      }
    } else if (el.type === 'barcode') {
      const val = resolveValue(el, data, serial)
      if (val) parts.push(renderBarcodeSVG(el.props.barcodeType ?? 'code128', val, el.props, pos))
    } else if (el.type === 'image') {
      parts.push(renderImageSVG(el.props.src ?? '', pos))
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${wPX}px" height="${hPX}px" viewBox="0 0 ${wPX} ${hPX}">
  <defs><clipPath id="lc"><rect width="${wPX}" height="${hPX}"/></clipPath></defs>
  <g clip-path="url(#lc)">
    ${parts.join('\n    ')}
  </g>
</svg>`
}

// ─── Пакет этикеток → HTML-страница с SVG ────────────────────────────────────

export async function renderLabelsToHTML(
  items: Array<{ serial: string }>,
  common: CommonData,
  templateData: PrintTemplateData
): Promise<string> {
  const ls = templateData.labelSize
  const wMM = ls.unit === 'mm' ? ls.width : ls.width / MM_TO_PX
  const hMM = ls.unit === 'mm' ? ls.height : ls.height / MM_TO_PX

  const pages = await Promise.all(
    items.map((item) =>
      renderLabelToSVG(templateData, { ...common, serial: item.serial }, item.serial)
    )
  )

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print Labels (SVG)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{margin:0;background:#fff;}
  .page{width:${wMM}mm;height:${hMM}mm;page-break-after:always;overflow:hidden;display:block;}
  .page svg{display:block;}
  @media print{@page{margin:0;size:${wMM}mm ${hMM}mm;}body{margin:0;}}
</style></head><body>
${pages.map((svg) => `<div class="page">${svg}</div>`).join('\n')}
</body></html>`
}
