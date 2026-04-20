import { filesystem, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'
import type {
  ElementPosition,
  PrintLabelElement,
  PrintTemplateData,
  CommonData,
  BatchItem
} from '@/types/label'

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

const MM_TO_PX = 3.78

export class LabelPrinterMulty {
  private basePath: string
  private windowConfig: WindowConfig

  constructor(basePath: string) {
    this.basePath = basePath
    this.windowConfig = {
      x: 0,
      y: 0,
      width: 650,
      height: 500,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: true,
      processArgs: '--window-id=W_PDF'
    }
  }

  // ── Barcode generators ─────────────────────────────────────────────────────
  // Параметры зеркалят store.generateBarcode

  private async generateDataMatrix(text: string, scale = 2): Promise<string> {
    const canvas = document.createElement('canvas')
    await bwipjs.toCanvas(canvas, { bcid: 'datamatrix', text, scale, height: 6, width: 6 })
    return canvas.toDataURL('image/png')
  }

  private async generateCode128(text: string, height = 6, scale = 2): Promise<string> {
    const canvas = document.createElement('canvas')
    await bwipjs.toCanvas(canvas, { bcid: 'code128', text, scale, height })
    return canvas.toDataURL('image/png')
  }

  // ── Position → CSS ─────────────────────────────────────────────────────────
  // Принимает позицию в мм и размер этикетки в мм, возвращает % для CSS.
  // Нет ничего про gridCols/gridRows — только мм.
  private positionToPercent(pos: ElementPosition, labelWidthMM: number, labelHeightMM: number) {
    return {
      left: (pos.x / labelWidthMM) * 100,
      top: (pos.y / labelHeightMM) * 100,
      width: (pos.w / labelWidthMM) * 100,
      height: (pos.h / labelHeightMM) * 100
    }
  }

  // ── Field value resolver ───────────────────────────────────────────────────
  private resolveFieldValue(element: PrintLabelElement, data: CommonData, serial?: string): string {
    if (element.type === 'barcode') {
      if (element.dataField.includes('serial') && serial) return serial
      return data[element.dataField] ?? data[element.dataField.split('_')[0]] ?? ''
    }
    if (element.type === 'text') {
      return data[element.dataField] ?? data[element.dataField.split('_')[0]] ?? ''
    }
    return ''
  }

  // ── HTML for one label ─────────────────────────────────────────────────────
  private async generateLabelHTML(
    templateData: PrintTemplateData,
    data: CommonData,
    serial?: string
  ): Promise<string> {
    const { positions, elements, labelSize } = templateData

    // Размер этикетки всегда в px для HTML-рендера
    const widthPX = labelSize.unit === 'mm' ? labelSize.width * MM_TO_PX : labelSize.width
    const heightPX = labelSize.unit === 'mm' ? labelSize.height * MM_TO_PX : labelSize.height
    const widthMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
    const heightMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX

    let elementsHTML = ''

    for (const [id, element] of Object.entries(elements)) {
      const pos = positions[id]
      if (!pos) continue

      const pct = this.positionToPercent(pos, widthMM, heightMM)

      const wrapStyle = `
        position: absolute;
        left:   ${pct.left}%;
        top:    ${pct.top}%;
        width:  ${pct.width}%;
        height: ${pct.height}%;
        box-sizing: border-box;
        overflow: hidden;
      `

      if (element.type === 'text') {
        const fieldValue = this.resolveFieldValue(element, data, serial)
        const justifyContent =
          element.props.align === 'center'
            ? 'center'
            : element.props.align === 'right'
              ? 'flex-end'
              : 'flex-start'
        // ${element.props.fontFamily ?? '"Arial Narrow", Arial, sans-serif'};
        elementsHTML += `
          <div style="${wrapStyle}
            font-size:       ${element.props.fontSize ?? 12}px;
            line-height:     1;
            font-weight:     ${element.props.bold ? 'bold' : 'normal'};
            font-family:     ${element.props.fontFamily ?? '"Arial Narrow", Arial, sans-serif'};
            text-align:      ${element.props.align ?? 'left'};
            display:         flex;
            align-items:     center;
            justify-content: ${justifyContent};
            padding:         1px;
            word-break:      break-word;
          ">${fieldValue || ' '}</div>
        `
      } else if (element.type === 'barcode') {
        const fieldValue = this.resolveFieldValue(element, data, serial)
        let barcodeImage = ''
        if (fieldValue) {
          barcodeImage =
            element.props.barcodeType === 'datamatrix'
              ? await this.generateDataMatrix(fieldValue, element.props.barcodeScale ?? 2)
              : await this.generateCode128(
                  fieldValue,
                  element.props.barcodeHeight ?? 6,
                  element.props.barcodeScale ?? 2
                )
        }
        elementsHTML += `
          <div style="${wrapStyle} display:flex; align-items:center; justify-content:center;">
            ${
              barcodeImage
                ? `<img src="${barcodeImage}" style="max-width:100%; max-height:100%; object-fit:contain;" />`
                : '<span style="color:#999;">[Штрихкод]</span>'
            }
          </div>
        `
      } else if (element.type === 'image') {
        elementsHTML += `
          <div style="${wrapStyle} display:flex; align-items:center; justify-content:center;">
            <img src="${element.props.src ?? ''}"
              style="max-width:100%; max-height:100%; object-fit:contain;
                ${element.props.imageWidth ? `width:${element.props.imageWidth}px;` : ''}
                ${element.props.imageHeight ? `height:${element.props.imageHeight};` : ''}"
              alt="image" />
          </div>
        `
      }
    }
    console.log(elementsHTML)

    return `
      <div class="page" style="width:${widthPX}px; height:${heightPX}px; position:relative;">
        ${elementsHTML}
      </div>
    `
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  public async printFromTemplate(
    items: BatchItem[],
    common: CommonData,
    templateData: PrintTemplateData
  ): Promise<void> {
    const pagesHtml = await Promise.all(
      items.map((item) =>
        this.generateLabelHTML(templateData, { ...common, serial: item.serial }, item.serial)
      )
    )

    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Labels</title>
  <style>
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

    const outputPath = `${this.basePath}/.tmp/print-multy.html`
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = encoder.encode(fullHtml)
    const out = new Uint8Array(bom.length + content.length)
    out.set(bom, 0)
    out.set(content, bom.length)

    await filesystem.writeBinaryFile(outputPath, out.buffer)
    await neuWindow.create('/.tmp/print-multy.html', this.windowConfig)
  }

  // Старый метод для обратной совместимости
  public async print(
    items: BatchItem[],
    common: CommonData,
    css: CSSOptions,
    templateHtml: string
  ): Promise<void> {
    const { labelWidth, labelHeight } = css
    const pagesHtml = await Promise.all(
      items.map(async (item) => {
        const barcode = await this.generateDataMatrix(item.serial)
        return templateHtml
          .replaceAll('${serial}', item.serial)
          .replaceAll('${barcode}', barcode)
          .replaceAll('${partNumber}', common.partNumber ?? '')
          .replaceAll('${description}', common.description ?? '')
          .replaceAll('${manufacturer}', common.manufacturer ?? '')
      })
    )

    const fullHtml = `<style>.page{width:${labelWidth}mm;height:${labelHeight}mm;page-break-after:always;}</style>${pagesHtml.join('')}`
    const outputPath = `${this.basePath}/.tmp/print-multy.html`
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = encoder.encode(fullHtml)
    const out = new Uint8Array(bom.length + content.length)
    out.set(bom, 0)
    out.set(content, bom.length)
    await filesystem.writeBinaryFile(outputPath, out.buffer)
    await neuWindow.create('/.tmp/print-multy.html', this.windowConfig)
  }
}

// Используется только в старом методе print()
interface CSSOptions {
  labelWidth: number
  labelHeight: number
  codeSize: number
  fontMain: number
  fontSmall: number
  gap: number
}
