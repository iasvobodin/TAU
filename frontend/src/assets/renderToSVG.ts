/**
 * renderToSVG.ts — векторный рендерер этикеток.
 *
 * Что делает:
 *   - Текст → SVG path через opentype.js (шрифты из /frontend/dist/fonts/)
 *   - Штрихкоды → SVG path через bwip-js toSVG (named export)
 *   - Растровые изображения → <image> base64 (единственное исключение)
 *   - SVG-изображения → inline (полностью векторный результат)
 *
 * Контракт:
 *   - Принимает PrintTemplateData — тот же объект что и HTML-принтер
 *   - Шрифты лежат рядом с приложением: /frontend/dist/fonts/<Name>.ttf
 *   - Возвращает строку SVG готовую к вставке в HTML или сохранению в файл
 */

import opentype from 'opentype.js'
import bwipjs from 'bwip-js'
import { filesystem } from '@neutralinojs/lib'
import type {
  PrintTemplateData,
  PrintLabelElement,
  ElementPosition,
  CommonData
} from '@/types/label'

// ─── Константы ───────────────────────────────────────────────────────────────

const MM_TO_PX = 3.78

// Папка со шрифтами приложения (fallback)
export const FONTS_DIR = `${window.NL_PATH}/.tmp/fonts`

// Системные папки шрифтов по платформам
const SYSTEM_DIRS = [
  'C:/Windows/Fonts',
  '/Library/Fonts',
  '/System/Library/Fonts',
  '/usr/share/fonts'
]

// ─── Типы ────────────────────────────────────────────────────────────────────

/**
 * Элемент списка шрифтов для UI.
 * label обновляется лениво после загрузки бинарника.
 */
export interface FontItem {
  label: string // отображаемое имя: сначала имя файла, затем реальное из таблиц
  value: string // ключ для fontPathIndex (имя файла без расширения)
  loaded?: boolean // true = FontFace зарегистрирован, превью работает
}

// Обратная совместимость — labelEditor.ts импортирует FontInfo
export type FontInfo = FontItem

// ─── Индексы (заполняются один раз при initFontIndex) ────────────────────────

// fileBase.toLowerCase() → абсолютный путь
const fontPathIndex = new Map<string, string>()
// fileBase.toLowerCase() → зарегистрирован ли FontFace
const loadedFonts = new Set<string>()
// fileBase.toLowerCase() → кэш opentype.Font для SVG-рендерера
const fontCache = new Map<string, opentype.Font | null>()
// fileBase.toLowerCase() → бинарник шрифта (для base64 в HTML-принтере)
const fontBufCache = new Map<string, ArrayBuffer>()

/**
 * Возвращает base64 data URL шрифта для встраивания в @font-face HTML-принтера.
 * Читает из кэша если уже загружен, иначе читает с диска.
 */
export async function getFontBase64(family: string): Promise<string | null> {
  const key = family.toLowerCase()
  let buf = fontBufCache.get(key)
  if (!buf) {
    const path = fontPathIndex.get(key)
    if (!path) return null
    try {
      buf = await filesystem.readBinaryFile(path)
      fontBufCache.set(key, buf)
    } catch {
      return null
    }
  }
  const b64 = btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))
  const ext = (fontPathIndex.get(key) ?? '').split('.').pop()?.toLowerCase()
  const mime = ext === 'otf' ? 'font/otf' : 'font/truetype'
  return `data:${mime};base64,${b64}`
}

// ─── Вспомогательные функции ──────────────────────────────────────────────────

/**
 * Извлекает полное название шрифта (Family + Subfamily).
 * Сохраняет начертание (Narrow, Condensed, …), но отбрасывает "Regular".
 */
function getFriendlyName(buf: ArrayBuffer, fallback: string): string {
  try {
    const font = opentype.parse(buf)
    const names = font.names as any
    const family = names.preferredFamily?.en || names.fontFamily?.en || ''
    const subfamily = names.preferredSubfamily?.en || names.fontSubfamily?.en || ''
    if (family && subfamily && subfamily !== 'Regular') {
      return `${family} ${subfamily}`.trim()
    }
    return family || fallback
  } catch {
    return fallback
  }
}

// ─── Публичное API ────────────────────────────────────────────────────────────

/**
 * Быстрое построение индекса: только обход директорий, без чтения бинарников.
 * Возвращает список FontItem с label = имя файла (уточняется лениво в ensureFontFace).
 * Вызывается один раз при старте приложения.
 */
export async function getAvailableFonts(): Promise<FontItem[]> {
  const dirs = [...SYSTEM_DIRS, FONTS_DIR]
  const items: FontItem[] = []

  for (const dir of dirs) {
    try {
      const entries = await filesystem.readDirectory(dir)
      for (const e of entries as any[]) {
        if (e.type !== 'FILE' || !/\.(ttf|otf)$/i.test(e.entry)) continue
        const fileBase = e.entry.replace(/\.(ttf|otf)$/i, '')
        const key = fileBase.toLowerCase()
        if (fontPathIndex.has(key)) continue // дубликат из другой папки
        fontPathIndex.set(key, `${dir}/${e.entry}`)
        items.push({ label: fileBase, value: fileBase, loaded: false })
      }
    } catch {
      // папка недоступна на этой платформе — пропускаем
    }
  }

  return items.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Ленивая загрузка шрифта: читает бинарник, уточняет label, регистрирует FontFace.
 * Вызывается из UI когда элемент списка становится видимым (IntersectionObserver)
 * или при выборе шрифта пользователем.
 * item — опционально: если передан, обновляет label и loaded на месте (реактивно).
 */
export async function ensureFontFace(value: string, item?: FontItem): Promise<boolean> {
  const key = value.toLowerCase()
  console.log(
    `[ensureFontFace] value="${value}" key="${key}" already loaded=${loadedFonts.has(key)}`
  )
  console.log(`[ensureFontFace] fontPathIndex.has(key)=${fontPathIndex.has(key)}`)
  console.log(
    `[ensureFontFace] fontPathIndex keys (first 5):`,
    [...fontPathIndex.keys()].slice(0, 5)
  )

  if (loadedFonts.has(key)) {
    if (item && !item.loaded) item.loaded = true
    console.log(`[ensureFontFace] уже загружен, выходим`)
    return true
  }

  const path = fontPathIndex.get(key)
  if (!path) {
    console.warn(`[ensureFontFace] путь НЕ НАЙДЕН для key="${key}"`)
    console.log(`[ensureFontFace] все ключи в индексе:`, [...fontPathIndex.keys()])
    return false
  }
  console.log(`[ensureFontFace] путь: ${path}`)

  try {
    const buf = await filesystem.readBinaryFile(path)
    const friendlyName = getFriendlyName(buf, value)
    const friendlyKey = friendlyName.toLowerCase()
    console.log(`[ensureFontFace] friendlyName="${friendlyName}"`)

    if (item) {
      item.label = friendlyName
      item.loaded = true
    }

    // ── FontFace API ────────────────────────────────────────────────────────────
    const face = new FontFace(friendlyName, buf)
    await face.load()
    document.fonts.add(face)

    // Alias под именем файла — страховка от race condition
    if (value !== friendlyName) {
      try {
        const faceAlias = new FontFace(value, buf)
        await faceAlias.load()
        document.fonts.add(faceAlias)
      } catch {
        /* alias не критичен */
      }
    }

    // ── Инжект <style>@font-face{...} в DOM ─────────────────────────────────
    // document.fonts.add() регистрирует шрифт, но браузер не пересчитывает
    // стили уже отрендеренных элементов. Инжект <style> форсирует немедленный
    // CSS recompute — именно так работал старый код через статические @font-face.
    const ext = path.split('.').pop()?.toLowerCase() ?? 'ttf'
    const mime = ext === 'otf' ? 'font/otf' : 'font/truetype'
    const b64 = btoa(Array.from(new Uint8Array(buf), (b) => String.fromCharCode(b)).join(''))
    const injectId = `ff-${friendlyKey.replace(/[^a-z0-9]/g, '-')}`
    if (!document.getElementById(injectId)) {
      const style = document.createElement('style')
      style.id = injectId
      style.textContent = [
        `@font-face {`,
        `  font-family: "${friendlyName}";`,
        `  src: url("data:${mime};base64,${b64}");`,
        `  font-weight: normal; font-style: normal;`,
        `}`,
        // alias по имени файла
        value !== friendlyName
          ? [
              `@font-face {`,
              `  font-family: "${value}";`,
              `  src: url("data:${mime};base64,${b64}");`,
              `  font-weight: normal; font-style: normal;`,
              `}`
            ].join('')
          : ''
      ].join('')
      document.head.appendChild(style)
      console.log(`[ensureFontFace] <style> инжектирован id="${injectId}"`)
    }

    loadedFonts.add(key)
    loadedFonts.add(friendlyKey)

    if (!fontPathIndex.has(friendlyKey)) {
      fontPathIndex.set(friendlyKey, path)
    }

    fontBufCache.set(friendlyKey, buf)
    fontBufCache.set(key, buf)

    if (item) {
      console.log(`[ensureFontFace] item.value: "${item.value}" → "${friendlyName}"`)
      item.value = friendlyName
    }
    return true
  } catch (e) {
    console.error(`[ensureFontFace] ошибка при загрузке "${value}":`, e)
    return false
  }
}

/**
 * Возвращает opentype.Font для SVG-рендерера.
 * Если шрифт ещё не загружен — загружает (ensureFontFace уже вызван при выборе,
 * но на случай прямой печати без открытия дропдауна делаем это здесь).
 */
export async function loadFont(family: string): Promise<opentype.Font | null> {
  const key = family.toLowerCase()
  if (fontCache.has(key)) return fontCache.get(key)!

  // Найдём путь — сначала по friendlyName, потом по fileBase
  let path = fontPathIndex.get(key)
  if (!path) {
    // Может быть сохранён под friendlyName (после ensureFontFace обновил value)
    // Ищем перебором — Map маленькая, это нормально
    for (const [k, p] of fontPathIndex) {
      if (k === key) {
        path = p
        break
      }
    }
  }
  if (!path) path = `${FONTS_DIR}/${family}.ttf`

  try {
    const buf = await filesystem.readBinaryFile(path)
    // Убедимся что FontFace тоже зарегистрирован
    if (!loadedFonts.has(key)) {
      const face = new FontFace(family, buf)
      await face.load()
      document.fonts.add(face)
      loadedFonts.add(key)
    }
    const font = opentype.parse(buf)
    fontCache.set(key, font)
    return font
  } catch {
    console.warn(`[SVG renderer] Font not found: ${path}`)
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

function renderTextPaths(opts: {
  text: string
  font: opentype.Font
  fontSizePx: number
  x: number
  y: number
  w: number
  h: number
  align: 'left' | 'center' | 'right'
  bold: boolean
}): string {
  const { text, font, fontSizePx, x, y, w, h, align } = opts
  const xPx = x * MM_TO_PX
  const yPx = y * MM_TO_PX
  const wPx = w * MM_TO_PX
  const hPx = h * MM_TO_PX
  const lineH = fontSizePx * 1.2
  const asc = (font.ascender / font.unitsPerEm) * fontSizePx

  const lines = wrapText(font, text, fontSizePx, wPx - 8)
  const totalH = lines.length * lineH
  const startY = yPx + (hPx - totalH) / 2 + asc

  return lines
    .map((ln, i) => {
      if (!ln.text) return ''
      let lx = xPx + 4
      if (align === 'center') lx = xPx + (wPx - ln.widthPx) / 2
      if (align === 'right') lx = xPx + wPx - ln.widthPx - 4
      const ly = startY + i * lineH
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

// ─── Изображение: растр → <image>, SVG → inline ──────────────────────────────

function renderImageSVG(src: string, pos: ElementPosition): string {
  if (!src) return ''
  const x = (pos.x * MM_TO_PX).toFixed(2)
  const y = (pos.y * MM_TO_PX).toFixed(2)
  const w = (pos.w * MM_TO_PX).toFixed(2)
  const h = (pos.h * MM_TO_PX).toFixed(2)

  // Inline SVG: вырезаем корневой тег, вставляем содержимое в <g transform>
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

  // Растровое изображение (PNG/JPG/base64)
  return `<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`
}

// ─── Резолвер значения поля ───────────────────────────────────────────────────

function resolveValue(el: PrintLabelElement, data: CommonData, serial?: string): string {
  if (el.type === 'barcode') {
    return el.dataField.includes('serial') && serial
      ? serial
      : (data[el.dataField] ?? data[el.dataField.split('_')[0]] ?? '')
  }
  return data[el.dataField] ?? data[el.dataField.split('_')[0]] ?? ''
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
      const family = el.props.fontFamily ?? 'Arial'
      const sizePx = el.props.fontSize ?? 12
      const align = el.props.align ?? 'left'
      const font = await loadFont(family)

      if (font) {
        parts.push(
          renderTextPaths({
            text: fieldValue || ' ',
            font,
            fontSizePx: sizePx,
            x: pos.x,
            y: pos.y,
            w: pos.w,
            h: pos.h,
            align,
            bold: el.props.bold ?? false
          })
        )
      } else {
        // Fallback — SVG <text> без конвертации в path
        const xPx = (pos.x * MM_TO_PX + 4).toFixed(2)
        const yPx = (pos.y * MM_TO_PX + (pos.h * MM_TO_PX) / 2).toFixed(2)
        const cxPx = (pos.x * MM_TO_PX + (pos.w * MM_TO_PX) / 2).toFixed(2)
        const rxPx = (pos.x * MM_TO_PX + pos.w * MM_TO_PX - 4).toFixed(2)
        const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
        const tx = align === 'center' ? cxPx : align === 'right' ? rxPx : xPx
        const safe = (fieldValue || ' ')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
        parts.push(`<text x="${tx}" y="${yPx}" font-family="${family}" font-size="${sizePx}"
          font-weight="${el.props.bold ? 'bold' : 'normal'}" text-anchor="${anchor}"
          dominant-baseline="middle" fill="#000">${safe}</text>`)
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

// ─── Несколько этикеток → HTML с SVG на каждой странице ──────────────────────

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
