/**
 * printLabelMultyСopy.ts — оркестратор пакетной печати.
 *
 * Отвечает только за:
 *   1. Выбор рендерера (HTML или SVG)
 *   2. Запись HTML-файла в .tmp/
 *   3. Открытие окна Neutralino для печати
 *
 * Логика рендеринга вынесена в отдельные модули:
 *   - htmlRenderer.ts  — HTML-рендерер (позиции в %, отступы в px)
 *   - renderToSVG.ts   — SVG-рендерер (текст → path, векторные штрихкоды)
 *
 * Оба рендерера принимают одинаковый PrintTemplateData — расширяй типы
 * только там, и оба модуля подхватят изменения автоматически.
 */

import { filesystem, window as neuWindow } from '@neutralinojs/lib'
import { renderLabelsToHTMLPage, renderLabelSheetsToHTMLPage } from '@/assets/htmlRenderer'
import {
  renderLabelsToHTML as renderLabelsToSVGHTML,
  renderLabelSheetsToHTML
} from '@/assets/renderToSVG'
import type { PrintTemplateData, CommonData, BatchItem, PrintLayoutConfig } from '@/types/label'

// ─── Конфигурация окна печати ─────────────────────────────────────────────────

interface WindowConfig {
  x: number
  y: number
  width: number
  height: number
  maximizable: boolean
  exitProcessOnClose: boolean
  enableInspector: boolean
  processArgs: string
}

const DEFAULT_WINDOW_CONFIG: WindowConfig = {
  x: 0,
  y: 0,
  width: 650,
  height: 500,
  maximizable: false,
  exitProcessOnClose: true,
  enableInspector: false,
  processArgs: '--window-id=W_PDF'
}

// ─── Внутренний хелпер: запись + открытие окна ────────────────────────────────

async function writeAndOpen(
  basePath: string,
  fileName: string,
  html: string,
  config: WindowConfig
): Promise<void> {
  const outputPath = `${basePath}/.tmp/${fileName}`
  const encoder = new TextEncoder()
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const content = encoder.encode(html)
  const out = new Uint8Array(bom.length + content.length)
  out.set(bom, 0)
  out.set(content, bom.length)
  await filesystem.writeBinaryFile(outputPath, out.buffer)
  await neuWindow.create(`/.tmp/${fileName}`, config)
}

// ─── Публичный класс ──────────────────────────────────────────────────────────

export class LabelPrinterMulty {
  private basePath: string
  private windowConfig: WindowConfig

  constructor(basePath: string, windowConfig?: Partial<WindowConfig>) {
    this.basePath = basePath
    this.windowConfig = { ...DEFAULT_WINDOW_CONFIG, ...windowConfig }
  }

  /**
   * Печать через HTML-рендерер.
   * Шрифты встраиваются как @font-face base64.
   */
  async printFromTemplate(
    items: BatchItem[],
    common: CommonData,
    templateData: PrintTemplateData
  ): Promise<void> {
    const html = await renderLabelsToHTMLPage(items, common, templateData)
    await writeAndOpen(this.basePath, 'print-multy.html', html, this.windowConfig)
  }

  /**
   * Печать через SVG-рендерер.
   * Текст конвертируется в path — не зависит от системных шрифтов при печати.
   */
  async printFromTemplateSVG(
    items: BatchItem[],
    common: CommonData,
    templateData: PrintTemplateData
  ): Promise<void> {
    const html = await renderLabelsToSVGHTML(items, common, templateData)
    await writeAndOpen(this.basePath, 'print-svg.html', html, this.windowConfig)
  }

  // ── Multi-label (листы с несколькими этикетками) ─────────────────────────

  /**
   * Печать листов с несколькими этикетками (HTML-рендерер).
   */
  async printSheets(
    sheets: BatchItem[][],
    common: CommonData,
    templateData: PrintTemplateData,
    layout: PrintLayoutConfig
  ): Promise<void> {
    const html = await renderLabelSheetsToHTMLPage(sheets, common, templateData, layout)
    await writeAndOpen(this.basePath, 'print-multi-sheet.html', html, this.windowConfig)
  }

  /**
   * Печать листов с несколькими этикетками (SVG-рендерер).
   */
  async printSheetsSVG(
    sheets: BatchItem[][],
    common: CommonData,
    templateData: PrintTemplateData,
    layout: PrintLayoutConfig
  ): Promise<void> {
    const html = await renderLabelSheetsToHTML(sheets, common, templateData, layout)
    await writeAndOpen(this.basePath, 'print-multi-sheet-svg.html', html, this.windowConfig)
  }
}
