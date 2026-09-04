/**
 * generateDimensionDrawing.ts — генерация SVG-оверлея с границами элементов.
 *
 * Принимает TemplateData и возвращает SVG-строку с прямоугольниками-рамками
 * для всех нетable-элементов + контур этикетки.
 * Размерные линии НЕ рисуются — только границы.
 *
 * Используется:
 *   - на канвасе (showElementBorders)
 *   - при экспорте SVG (renderToSVG.ts — напрямую)
 */

import type { TemplateData } from '@/types/label'
import { MM_TO_PX } from '@/assets/textLayout'

const SCALE = 10

function mmToSvg(v: number): number {
  return v * SCALE
}

export function generateDimensionDrawing(data: TemplateData): string {
  const { positions, elements, labelSize } = data

  // px→mm: используем единый MM_TO_PX из textLayout.ts (pxToMm эквивалентно)
  const labelW = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
  const labelH = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX

  const parts: string[] = []

  parts.push(`<rect width="100%" height="100%" fill="none"/>`)

  // Контур этикетки
  parts.push(
    `<rect x="0" y="0" width="${mmToSvg(labelW).toFixed(1)}" height="${mmToSvg(labelH).toFixed(1)}" ` +
      `fill="none" stroke="#999" stroke-width="0.5"/>`
  )

  // Рамки элементов
  for (const [id, el] of Object.entries(elements)) {
    const pos = positions[id]
    if (!pos) continue
    if (el.type === 'table') continue
    if (el.props.tableCellMeta) continue

    const x = mmToSvg(pos.x).toFixed(1)
    const y = mmToSvg(pos.y).toFixed(1)
    const w = mmToSvg(pos.w).toFixed(1)
    const h = mmToSvg(pos.h).toFixed(1)

    parts.push(
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" ` +
        `fill="none" stroke="#999" stroke-width="0.5"/>`
    )
  }

  const svgW = mmToSvg(labelW).toFixed(1)
  const svgH = mmToSvg(labelH).toFixed(1)

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${svgW} ${svgH}">\n` +
    parts.join('\n') +
    `\n</svg>`
  )
}
