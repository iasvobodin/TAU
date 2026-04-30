import { filesystem, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'
import { renderLabelsToHTML, getFontBase64 } from '@/assets/renderToSVG'
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

    const widthPX = labelSize.unit === 'mm' ? labelSize.width * MM_TO_PX : labelSize.width
    const heightPX = labelSize.unit === 'mm' ? labelSize.height * MM_TO_PX : labelSize.height
    const widthMM = labelSize.unit === 'mm' ? labelSize.width : labelSize.width / MM_TO_PX
    const heightMM = labelSize.unit === 'mm' ? labelSize.height : labelSize.height / MM_TO_PX

    let elementsHTML = ''

    for (const [id, element] of Object.entries(elements)) {
      const pos = positions[id]
      if (!pos) continue

      const pct = this.positionToPercent(pos, widthMM, heightMM)

      // Базовые стили позиционирования — без переносов строк, без кавычек внутри
      const baseStyle = [
        `position:absolute`,
        `left:${pct.left}%`,
        `top:${pct.top}%`,
        `width:${pct.width}%`,
        `height:${pct.height}%`,
        `box-sizing:border-box`,
        `overflow:hidden`
      ].join(';')

      if (element.type === 'text') {
        const fieldValue = this.resolveFieldValue(element, data, serial)
        const justifyContent =
          element.props.align === 'center'
            ? 'center'
            : element.props.align === 'right'
              ? 'flex-end'
              : 'flex-start'

        const style =
          baseStyle +
          ';' +
          [
            `font-size:${element.props.fontSize ?? 12}px`,
            `line-height:1`,
            `font-weight:${element.props.bold ? 'bold' : 'normal'}`,
            `font-family:'${element.props.fontFamily ?? 'Arial'}'`,
            `text-align:${element.props.align ?? 'left'}`,
            `display:flex`,
            `align-items:center`,
            `justify-content:${justifyContent}`,
            `padding:0px`,
            `word-break:break-word`
          ].join(';')

        elementsHTML += `<div style="${style}">${fieldValue || ' '}</div>`
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
          : `<img src="${src}" style="max-width:100%;max-height:100%;object-fit:contain${element.props.imageWidth ? `;width:${element.props.imageWidth}px` : ''}${element.props.imageHeight ? `;height:${element.props.imageHeight}` : ''}" alt=""/>`
        elementsHTML += `<div style="${style}">${imageContent}</div>`
      }
    }

    return `<div class="page" style="width:${widthPX}px;height:${heightPX}px;position:relative">${elementsHTML}</div>`
  }

  // ── Сбор уникальных шрифтов из шаблона и генерация @font-face блока ────────

  private async buildFontFaceCSS(templateData: PrintTemplateData): Promise<string> {
    const families = new Set<string>()
    for (const el of Object.values(templateData.elements)) {
      if (el.type === 'text' && el.props.fontFamily) {
        families.add(el.props.fontFamily)
      }
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

  // ── Public API ─────────────────────────────────────────────────────────────

  public async printFromTemplate(
    items: BatchItem[],
    common: CommonData,
    templateData: PrintTemplateData
  ): Promise<void> {
    const [pagesHtml, fontFaceCSS] = await Promise.all([
      Promise.all(
        items.map((item) =>
          this.generateLabelHTML(templateData, { ...common, serial: item.serial }, item.serial)
        )
      ),
      this.buildFontFaceCSS(templateData)
    ])

    const fullHtml = `<!DOCTYPE html>
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

  public async printFromTemplateSVG(
    items: BatchItem[],
    common: CommonData,
    templateData: PrintTemplateData
  ): Promise<void> {
    const html = await renderLabelsToHTML(items, common, templateData)

    const outputPath = `${this.basePath}/.tmp/print-svg.html`
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = encoder.encode(html)
    const out = new Uint8Array(bom.length + content.length)
    out.set(bom, 0)
    out.set(content, bom.length)

    await filesystem.writeBinaryFile(outputPath, out.buffer)
    await neuWindow.create('/.tmp/print-svg.html', this.windowConfig)
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
