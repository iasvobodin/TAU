import { filesystem, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'
import type {
  LayoutItem,
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
      enableInspector: false,
      processArgs: '--window-id=W_PDF'
    }
  }

  // Параметры зеркалят store.generateBarcode (datamatrix)
  private async generateDataMatrix(text: string, scale: number = 2): Promise<string> {
    const canvas = document.createElement('canvas')
    await bwipjs.toCanvas(canvas, {
      bcid: 'datamatrix',
      text,
      scale,
      height: 6,
      width: 6
    })
    return canvas.toDataURL('image/png')
  }

  // Параметры зеркалят store.generateBarcode (code128)
  // includetext убран — в редакторе тоже не используется
  private async generateCode128(
    text: string,
    height: number = 6,
    scale: number = 2
  ): Promise<string> {
    const canvas = document.createElement('canvas')
    await bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text,
      scale,
      height
    })
    return canvas.toDataURL('image/png')
  }

  // Редактор: margin=[0,0], поэтому позиция = чистая пропорция от размера этикетки
  private gridToPercent(item: LayoutItem, gridCols: number, gridRows: number) {
    return {
      left: (item.x / gridCols) * 100,
      top: (item.y / gridRows) * 100,
      width: (item.w / gridCols) * 100,
      height: (item.h / gridRows) * 100
    }
  }

  private resolveFieldValue(
    element: PrintLabelElement,
    data: Record<string, string>,
    serial?: string
  ): string {
    if (element.type === 'barcode') {
      if (element.dataField.includes('serial') && serial) return serial
      // Пробуем полный dataField, потом базовое имя (обратная совместимость)
      return data[element.dataField] ?? data[element.dataField.split('_')[0]] ?? ''
    }
    if (element.type === 'text') {
      // Пробуем полный dataField (description_1, description_2 и т.д.)
      // потом базовое имя как fallback для старых шаблонов
      return data[element.dataField] ?? data[element.dataField.split('_')[0]] ?? ''
    }
    return ''
  }

  private async generateLabelHTML(
    templateData: PrintTemplateData,
    data: Record<string, string>,
    serial?: string
  ): Promise<string> {
    const { layout, elements, labelSize } = templateData

    // Берём из шаблона; старые шаблоны (без поля) используют 12×12
    const gridCols = templateData.gridCols ?? 12
    const gridRows = templateData.gridRows ?? 12

    // Используем px с тем же MM_TO_PX что и редактор — исключает погрешность браузерного mm→px
    const widthPX = labelSize.unit === 'mm' ? labelSize.width * MM_TO_PX : labelSize.width
    const heightPX = labelSize.unit === 'mm' ? labelSize.height * MM_TO_PX : labelSize.height

    let elementsHTML = ''

    for (const item of layout) {
      const element = elements[item.i]
      if (!element) continue

      const pos = this.gridToPercent(item, gridCols, gridRows)

      // Общая обёртка — position, size, overflow идентичны редактору
      const wrapStyle = `
        position: absolute;
        left:   ${pos.left}%;
        top:    ${pos.top}%;
        width:  ${pos.width}%;
        height: ${pos.height}%;
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

        // Стили идентичны .element-content + editable-text в редакторе
        elementsHTML += `
          <div style="
            ${wrapStyle}
            font-size:       ${element.props.fontSize ?? 12}px;
            line-height:     1.2;
            font-weight:     ${element.props.bold ? 'bold' : 'normal'};
            font-family:     ${element.props.fontFamily ?? 'Arial'};
            text-align:      ${element.props.align ?? 'left'};
            display:         flex;
            align-items:     center;
            justify-content: ${justifyContent};
            padding:         4px;
            word-break:      break-word;
          ">${fieldValue || ' '}</div>
        `
      } else if (element.type === 'barcode') {
        const fieldValue = this.resolveFieldValue(element, data, serial)
        let barcodeImage = ''

        if (fieldValue) {
          if (element.props.barcodeType === 'datamatrix') {
            barcodeImage = await this.generateDataMatrix(
              fieldValue,
              element.props.barcodeScale ?? 2
            )
          } else {
            barcodeImage = await this.generateCode128(
              fieldValue,
              element.props.barcodeHeight ?? 6,
              element.props.barcodeScale ?? 2
            )
          }
        }

        elementsHTML += `
          <div style="
            ${wrapStyle}
            display:         flex;
            align-items:     center;
            justify-content: center;
          ">
            ${
              barcodeImage
                ? `<img src="${barcodeImage}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />`
                : '<span style="color: #999;">[Штрихкод]</span>'
            }
          </div>
        `
      } else if (element.type === 'image') {
        elementsHTML += `
          <div style="
            ${wrapStyle}
            display:         flex;
            align-items:     center;
            justify-content: center;
          ">
            <img
              src="${element.props.src ?? ''}"
              style="
                max-width:  100%;
                max-height: 100%;
                object-fit: contain;
                ${element.props.imageWidth ? `width: ${element.props.imageWidth}px;` : ''}
                ${element.props.imageHeight ? `height: ${element.props.imageHeight};` : ''}
              "
              alt="image"
            />
          </div>
        `
      }
    }

    return `
      <div class="page" style="width: ${widthPX}px; height: ${heightPX}px; position: relative;">
        ${elementsHTML}
      </div>
    `
  }

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
    .page {
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    @media print {
      @page { margin: 0; size: auto; }
      body  { margin: 0; }
    }
  </style>
</head>
<body>
  ${pagesHtml.join('')}
</body>
</html>`

    const outputPath = `${this.basePath}/.tmp/print-multy.html`
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = encoder.encode(fullHtml)
    const dataWithBOM = new Uint8Array(bom.length + content.length)
    dataWithBOM.set(bom, 0)
    dataWithBOM.set(content, bom.length)

    await filesystem.writeBinaryFile(outputPath, dataWithBOM.buffer)
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
          .replaceAll('${partNumber}', common.partNumber)
          .replaceAll('${description}', common.description)
          .replaceAll('${manufacturer}', common.manufacturer)
      })
    )

    const fullHtml = `
<style>
.page { width: ${labelWidth}mm; height: ${labelHeight}mm; page-break-after: always; }
</style>
${pagesHtml.join('')}`

    const outputPath = `${this.basePath}/.tmp/print-multy.html`
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const content = encoder.encode(fullHtml)
    const dataWithBOM = new Uint8Array(bom.length + content.length)
    dataWithBOM.set(bom, 0)
    dataWithBOM.set(content, bom.length)

    await filesystem.writeBinaryFile(outputPath, dataWithBOM.buffer)
    await neuWindow.create('/.tmp/print-multy.html', this.windowConfig)
  }
}

// Используется только старым методом print() для обратной совместимости
interface CSSOptions {
  labelWidth: number
  labelHeight: number
  codeSize: number
  fontMain: number
  fontSmall: number
  gap: number
}
