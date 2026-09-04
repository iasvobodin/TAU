/**
 * resolveValue.ts — ЕДИНЫЙ резолвер значения поля для всех рендереров (HTML / SVG).
 *
 * Контракт: plans/text-layout-unification-plan.md (п. 2.2/2.3, раздел «Вынести resolveValue»).
 *
 * Чистая функция без зависимостей от Neutralino/DOM — используется:
 *  - renderToSVG.ts (Фаза 3)
 *  - htmlRenderer.ts (Фаза 4)
 *
 * Логика:
 *  - barcode  → data[dataField] ?? serial ?? data['serial'] ?? ''
 *  - text     → linkedBarcodeId (рекурсия) > tableCellMeta (ключ = id) > data[dataField]
 *  - прочее   → ''
 *
 * Сигнатура совместима с обеими предыдущими копиями:
 *  resolveValue(el, data, serial?, elements?) — элементы опциональны и нужны
 *  только для рекурсивного разрешения linkedBarcodeId.
 */

import type { CommonData, PrintLabelElement } from '@/types/label'

export function resolveValue(
  el: PrintLabelElement,
  data: CommonData,
  serial?: string,
  elements?: Record<string, PrintLabelElement>
): string {
  if (el.type === 'barcode') {
    // Для barcode: dataField из common/batch data (может быть итерируемым или обычным)
    if (data[el.dataField]) return data[el.dataField]
    return serial ?? data['serial'] ?? ''
  }

  if (el.type === 'text') {
    // Текст, связанный с barcode → рекурсивно берём значение barcode
    if (el.props.linkedBarcodeId && elements?.[el.props.linkedBarcodeId]) {
      return resolveValue(elements[el.props.linkedBarcodeId], data, serial, elements)
    }
    // Ячейки таблицы: все имеют dataField='', используем уникальный ID как ключ
    if (el.props.tableCellMeta) {
      return data[el.id] ?? ''
    }
    return data[el.dataField] ?? ''
  }

  return ''
}
