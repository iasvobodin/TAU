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
import { resolveValue } from './resolveValue'
import { createOpentypeTextMetricsProvider } from './opentypeTextMetrics'
import { MM_TO_PX, computeTextLayout, getTextContainerBox } from './textLayout'
import type { TextMetricsProvider } from './textLayout'
import type {
  PrintTemplateData,
  PrintLabelElement,
  ElementPosition,
  LabelElementProps,
  CommonData,
  TextRenderProps,
  BatchItem,
  PrintLayoutConfig
} from '@/types/label'
import { resolveTextProps } from '@/types/label'

// ─── Константы ───────────────────────────────────────────────────────────────
// MM_TO_PX — единый коэффициент мм→px, импортируется из textLayout.ts (Фаза 3).

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

// ─── Провайдеры метрик (единый TextMetricsProvider из textLayout.ts) ─────────
// Адаптер над opentype-шрифтом вынесен в общий чистый модуль
// opentypeTextMetrics.ts — используется и SVG-, и HTML-рендерером,
// чтобы метрики/раскладка были едиными (допуск ≤ 0.1 мм HTML↔SVG).

// Провайдер-заглушка, когда шрифт не загружен. Консервативные метрики:
//   width ≈ 0.6 em/символ, ascender = 0.8 em, descender = 0.2 em.
// Позиции строк считаются тем же алгоритмом (единая раскладка).
// Экспортируется, чтобы HTML-рендерер использовал тот же fallback (без дублей).
export const FALLBACK_TEXT_METRICS_PROVIDER: TextMetricsProvider = {
  measureWidth(text, fontSizePx, letterSpacingPx) {
    const charCount = Array.from(text).length
    const spacingPx = letterSpacingPx * Math.max(0, charCount - 1)
    return charCount * fontSizePx * 0.6 + spacingPx
  },
  ascenderPx(fontSizePx) {
    return fontSizePx * 0.8
  },
  descenderPx(fontSizePx) {
    return fontSizePx * 0.2
  }
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
    textRotation?: 0 | 90 | 180 | 270
  }
): string {
  const { text, font, x, y, w, h, textRotation = 0 } = opts

  // Координаты блока в px
  const xPx = x * MM_TO_PX
  const yPx = y * MM_TO_PX
  const wPx = w * MM_TO_PX
  const hPx = h * MM_TO_PX

  // Повёрнутый контейнер строк — единый источник с computeTextLayout: при 90/270
  // оси свопаются и контейнер центрируется, чтобы rotate(θ) вокруг центра
  // контейнера держал текст внутри блока.
  const box = getTextContainerBox(wPx, hPx, opts, textRotation)
  const innerX = xPx + box.x
  const innerY = yPx + box.y

  // Единая раскладка: wrap + align + verticalAlign + поворот 0/90/180/270 —
  // из textLayout.ts (Фаза 3). Провайдер метрик — адаптер над opentype-шрифтом.
  const layout = computeTextLayout({
    text,
    tp: opts,
    blockWmm: w,
    blockHmm: h,
    textRotation,
    provider: createOpentypeTextMetricsProvider(font)
  })

  const paths = layout.lines
    .map((ln) => {
      if (!ln.text) return ''
      const lx = innerX + ln.xPx
      const ly = innerY + ln.baselineYPx
      const svgStr = font.getPath(ln.text, lx, ly, opts.fontSize).toSVG(2)
      const d = svgStr.match(/d="([^"]+)"/)?.[1]
      return d ? `<path d="${d}" fill="#000"/>` : ''
    })
    .filter(Boolean)
    .join('\n')

  // Внешний поворот вокруг центра контейнера строк (= центр внутренней области).
  // Единый способ для HTML/SVG/канваса: текст раскладывается в системе повёрнутого
  // текста, затем rotate(θ) вокруг центра контейнера держит его внутри блока.
  if (textRotation) {
    const cx = (xPx + box.x + box.w / 2).toFixed(2)
    const cy = (yPx + box.y + box.h / 2).toFixed(2)
    return `<g transform="rotate(${textRotation} ${cx} ${cy})">${paths}</g>`
  }

  return paths
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

  // Удаляем XML-декларацию и обёртку <svg> — оставляем только содержимое
  const inner = rawSVG
    .replace(/<\?xml[^>]*\?>/, '')
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
      .replace(/<\?xml[^>]*\?>/, '')
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

// ─── Контур элемента (outline) ───────────────────────────────────────────────
function renderElementOutlineSVG(pos: ElementPosition, el: PrintLabelElement): string {
  if (!el.props.outlineEnabled) return ''
  const x = (pos.x * MM_TO_PX).toFixed(2)
  const y = (pos.y * MM_TO_PX).toFixed(2)
  const w = (pos.w * MM_TO_PX).toFixed(2)
  const h = (pos.h * MM_TO_PX).toFixed(2)
  const width = ((el.props.outlineWidth ?? 0.5) * MM_TO_PX).toFixed(2)
  const color = el.props.outlineColor ?? '#333'
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${width}" />`
}

// ─── Границы элементов (чертёжный режим) ─────────────────────────────────────
function renderElementBorderSVG(pos: ElementPosition, el: PrintLabelElement): string {
  if (el.type === 'table') return ''
  if (el.props.tableCellMeta) return ''
  const x = (pos.x * MM_TO_PX).toFixed(2)
  const y = (pos.y * MM_TO_PX).toFixed(2)
  const w = (pos.w * MM_TO_PX).toFixed(2)
  const h = (pos.h * MM_TO_PX).toFixed(2)
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#999" stroke-width="0.5"/>`
}

// ─── Сетка таблицы → SVG ─────────────────────────────────────────────────────
// Рисует рамки вокруг ячеек таблицы, если включены showBorders.
// Позиции вычисляются математически из параметров table-контейнера.
function renderTableGridSVG(pos: ElementPosition, props: LabelElementProps): string {
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
  const cw = (tableCellWidth ?? 17) * MM_TO_PX
  const ch = (tableCellHeight ?? 9) * MM_TO_PX
  const gapH = (tableGapH ?? 0.4) * MM_TO_PX
  const gapV = (tableGapV ?? 0.4) * MM_TO_PX
  const x0 = pos.x * MM_TO_PX
  const y0 = pos.y * MM_TO_PX

  const rects: string[] = []
  // Границы ячеек (только если включены)
  if (tableShowBorders) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = x0 + c * (cw + gapH)
        const y = y0 + r * (ch + gapV)
        rects.push(
          `<rect x="${x}" y="${y}" width="${cw}" height="${ch}" fill="none" stroke="#999" stroke-width="0.5" />`
        )
      }
    }
  }
  // Контур вокруг всей таблицы (только если включён)
  if (tableOutline) {
    const totalW = cols * cw + (cols - 1) * gapH
    const totalH = rows * ch + (rows - 1) * gapV
    rects.push(
      `<rect x="${x0}" y="${y0}" width="${totalW}" height="${totalH}" fill="none" stroke="#333" stroke-width="1" />`
    )
  }
  return rects.join('\n')
}

// ─── Одна этикетка → SVG строка ──────────────────────────────────────────────
// resolveValue() — общий модуль ./resolveValue.ts (единый для HTML и SVG)

export async function renderLabelToSVG(
  templateData: PrintTemplateData,
  data: CommonData,
  serial?: string,
  showBorders?: boolean
): Promise<string> {
  const { positions, elements, labelSize } = templateData
  const wMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const hMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX
  const wMMFormatted = wMM.toFixed(2)
  const hMMFormatted = hMM.toFixed(2)
  const wPX = (wMM * MM_TO_PX).toFixed(2)
  const hPX = (hMM * MM_TO_PX).toFixed(2)

  const parts: string[] = []

  for (const [id, el] of Object.entries(elements)) {
    const pos = positions[id]
    if (!pos) continue

    if (el.type === 'text') {
      const fieldValue = resolveValue(el, data, serial, elements)
      const tp = resolveTextProps(el.props)
      const font = await loadFont(tp.fontFamily)

      const textRotation = (el.props.textRotation ?? 0) as 0 | 90 | 180 | 270

      if (font) {
        parts.push(
          renderTextPaths({
            ...tp,
            text: fieldValue || ' ',
            font,
            x: pos.x,
            y: pos.y,
            w: pos.w,
            h: pos.h,
            textRotation
          })
        )
      } else {
        // Fallback — SVG <text> с <tspan> на тех же TextLine[] из computeTextLayout,
        // что и основной путь (единая раскладка: wrap + align + verticalAlign + поворот).
        // Провайдер-заглушка с консервативными метриками (шрифт не загружен).
        const box = getTextContainerBox(pos.w * MM_TO_PX, pos.h * MM_TO_PX, tp, textRotation)
        const xPx = pos.x * MM_TO_PX + box.x
        const yPx = pos.y * MM_TO_PX + box.y

        const layout = computeTextLayout({
          text: fieldValue || ' ',
          tp,
          blockWmm: pos.w,
          blockHmm: pos.h,
          textRotation,
          provider: FALLBACK_TEXT_METRICS_PROVIDER
        })

        const lineH = layout.lineHeightPx
        const first = layout.lines[0]

        // Каждая строка — свой левый край (xPx уже учитывает align),
        // поэтому text-anchor='start' и индивидуальный x для каждого <tspan>.
        const tspans = layout.lines
          .map((ln, i) => {
            // HTML-эскейпинг fallback: экранируем & ПЕРВЫМ, затем < и > —
            // чтобы уже экранированные сущности не экранировались повторно
            // (баг плана 3.2.2 на SVG-пути). Сущности строятся через
            // String.fromCharCode(38) + суффикс, чтобы исходник не содержал
            // литеральных HTML-сущностей.
            const amp = String.fromCharCode(38) // '&'
            const safe = (ln.text || '\u00A0')
              .replace(/&/g, amp + 'amp;')
              .replace(/</g, amp + 'lt;')
              .replace(/>/g, amp + 'gt;')
            // Первая строка — без dy (наследует y из <text>),
            // остальные — со смещением вниз на lineH
            const dy = i === 0 ? '' : ` dy="${lineH.toFixed(2)}"`
            return `<tspan x="${(xPx + ln.xPx).toFixed(2)}"${dy}>${safe}</tspan>`
          })
          .join('')

        let fallbackText =
          `<text x="${(xPx + (first?.xPx ?? 0)).toFixed(2)}"` +
          ` y="${(yPx + (first?.baselineYPx ?? 0)).toFixed(2)}"` +
          ` font-family="${tp.fontFamily}" font-size="${tp.fontSize}"` +
          ` font-weight="${tp.bold ? 'bold' : 'normal'}" text-anchor="start"` +
          ` fill="#000">${tspans}</text>`

        // Поворот fallback текста — внешний rotate вокруг центра контейнера
        // (как основной путь: контейнер свопается/центрируется через getTextContainerBox)
        if (textRotation) {
          const cx = (pos.x * MM_TO_PX + box.x + box.w / 2).toFixed(2)
          const cy = (pos.y * MM_TO_PX + box.y + box.h / 2).toFixed(2)
          fallbackText = `<g transform="rotate(${textRotation} ${cx} ${cy})">${fallbackText}</g>`
        }

        parts.push(fallbackText)
      }
      // Контур элемента
      parts.push(renderElementOutlineSVG(pos, el))
    } else if (el.type === 'barcode') {
      const val = resolveValue(el, data, serial, elements)
      if (val) parts.push(renderBarcodeSVG(el.props.barcodeType ?? 'code128', val, el.props, pos))
      // Контур элемента
      parts.push(renderElementOutlineSVG(pos, el))
    } else if (el.type === 'image') {
      parts.push(renderImageSVG(el.props.src ?? '', pos))
      // Контур элемента
      parts.push(renderElementOutlineSVG(pos, el))
    } else if (el.type === 'table') {
      // Контейнер таблицы пропускаем — ячейки рендерятся как text
      // Сетка отрисовывается отдельным проходом ниже
      continue
    }
  }

  // Второй проход: рендеринг сетки для table-контейнеров
  for (const [id, el] of Object.entries(elements)) {
    if (el.type !== 'table') continue
    const pos = positions[id]
    if (!pos) continue
    const gridSvg = renderTableGridSVG(pos, el.props)
    if (gridSvg) parts.push(gridSvg)
  }

  // Третий проход: границы элементов для чертёжного режима
  if (showBorders) {
    // Контур этикетки
    parts.push(
      `<rect x="0" y="0" width="${wPX}" height="${hPX}" fill="none" stroke="#999" stroke-width="0.5"/>`
    )
    for (const [id, el] of Object.entries(elements)) {
      const pos = positions[id]
      if (!pos) continue
      // Фикс бага (план 3.2.1): результат renderElementBorderSVG ранее не добавлялся
      // в parts — границы элементов пропадали в чертёжном режиме SVG-экспорта.
      const borderSvg = renderElementBorderSVG(pos, el)
      if (borderSvg) parts.push(borderSvg)
    }
  }

  // ── Рамка всей этикетки ──
  if (templateData.labelBorder?.enabled) {
    const bw = ((templateData.labelBorder.width ?? 1.0) * MM_TO_PX).toFixed(2)
    const color = templateData.labelBorder.color ?? '#000'
    parts.push(
      `<rect x="0" y="0" width="${wPX}" height="${hPX}" fill="none" stroke="${color}" stroke-width="${bw}" />`
    )
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${wMMFormatted}mm" height="${hMMFormatted}mm" viewBox="0 0 ${wPX} ${hPX}">
  <defs><clipPath id="lc"><rect width="${wPX}" height="${hPX}"/></clipPath></defs>
  <g clip-path="url(#lc)">
    ${parts.join('\n    ')}
  </g>
</svg>`
}

// ─── Пакет этикеток → HTML-страница с SVG ────────────────────────────────────

export async function renderLabelsToHTML(
  items: BatchItem[],
  common: CommonData,
  templateData: PrintTemplateData
): Promise<string> {
  const ls = templateData.labelSize
  const wMM = ls.unit === 'mm' ? ls.width : ls.width / MM_TO_PX
  const hMM = ls.unit === 'mm' ? ls.height : ls.height / MM_TO_PX

  const pages = await Promise.all(
    items.map((item) =>
      renderLabelToSVG(templateData, { ...common, ...item } as CommonData, item.serial ?? '')
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

// ── Multi-label: SVG — одна страница-лист с N этикетками ──────────────────────

/**
 * Рендерит один физический лист с несколькими SVG-этикетками.
 */
export async function renderLabelSheetToSVG(
  sheetItems: BatchItem[],
  common: CommonData,
  templateData: PrintTemplateData,
  layout: PrintLayoutConfig
): Promise<string> {
  const { labelSize } = templateData
  const twMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const thMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX

  const swMM = layout.sheetWidth
  const shMM = layout.sheetHeight
  const swPX = (swMM * MM_TO_PX).toFixed(2)
  const shPX = (shMM * MM_TO_PX).toFixed(2)

  const svgParts: string[] = []

  for (let i = 0; i < sheetItems.length; i++) {
    const col = i % layout.cols
    const row = Math.floor(i / layout.cols)
    if (row >= layout.rows) break

    const item = sheetItems[i]
    const itemData = { ...common, ...item } as CommonData

    // Рендерим SVG этикетки с её собственным размером
    const labelSvg = await renderLabelToSVG(templateData, itemData, item.serial ?? '')

    // Вычисляем позицию на листе в мм
    const leftMM = layout.marginLeft + col * (twMM + layout.gapX)
    const topMM = layout.marginTop + row * (thMM + layout.gapY)

    // Извлекаем содержимое SVG (всё между <svg ...> и </svg>)
    // и размещаем его через <g transform="translate(x, y)">
    const svgMatch = labelSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i)
    if (!svgMatch) continue

    const innerContent = svgMatch[1]
    const tx = (leftMM * MM_TO_PX).toFixed(2)
    const ty = (topMM * MM_TO_PX).toFixed(2)
    svgParts.push(`<g transform="translate(${tx}, ${ty})">${innerContent}</g>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${swPX}" height="${shPX}" viewBox="0 0 ${swPX} ${shPX}">
${svgParts.join('\n')}
</svg>`
}

/**
 * Генерирует полную HTML-страницу для multi-label печати (SVG-режим).
 */
export async function renderLabelSheetsToHTML(
  sheets: BatchItem[][],
  common: CommonData,
  templateData: PrintTemplateData,
  layout: PrintLayoutConfig
): Promise<string> {
  const swMM = layout.sheetWidth
  const shMM = layout.sheetHeight

  const pages = await Promise.all(
    sheets.map((sheetItems) => renderLabelSheetToSVG(sheetItems, common, templateData, layout))
  )

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print Labels (SVG Multi)</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{margin:0;background:#fff;}
  .page{width:${swMM}mm;height:${shMM}mm;page-break-after:always;overflow:hidden;display:block;}
  .page svg{display:block;}
  @media print{@page{margin:0;size:${swMM}mm ${shMM}mm;}body{margin:0;}}
</style></head><body>
${pages.map((svg) => `<div class="page">${svg}</div>`).join('\n')}
</body></html>`
}
