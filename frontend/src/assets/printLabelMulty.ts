import { filesystem, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'

interface BarcodesItem {
  serial: string
}

interface CommonData {
  partNumber: string
  description: string
  manufacturer: string
}

interface CSSOptions {
  labelWidth: number
  labelHeight: number
  codeSize: number
  fontMain: number
  fontSmall: number
  padding: number
  gap: number
}

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

  // Генерация DataMatrix в Base64
  private async generateDataMatrix(text: string): Promise<string> {
    const canvas = document.createElement('canvas')
    await bwipjs.toCanvas(canvas, { bcid: 'datamatrix', text, scale: 3 })
    return canvas.toDataURL('image/png')
  }

  // ===== Печать: размножение шаблона для всех серийников =====
  public async print(
    items: BarcodesItem[],
    common: CommonData,
    css: CSSOptions,
    templateHtml: string // готовый шаблон одной этикетки без масштабирования
  ) {
    const { labelWidth, labelHeight } = css

    const pagesHtml = await Promise.all(
      items.map(async (item) => {
        // Подставляем DataMatrix
        const barcode = await this.generateDataMatrix(item.serial)

        // Заменяем переменные в шаблоне
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
${pagesHtml.join('')}
`

    const outputPath = `${this.basePath}/.tmp/print-multy.html`
    // создаём BOM + контент
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]) // UTF-8 BOM
    const content = encoder.encode(fullHtml)

    // объединяем BOM и контент в новый ArrayBuffer
    const dataWithBOM = new Uint8Array(bom.length + content.length)
    dataWithBOM.set(bom, 0)
    dataWithBOM.set(content, bom.length)

    // передаём именно ArrayBuffer
    await filesystem.writeBinaryFile(outputPath, dataWithBOM.buffer)
    await neuWindow.create('/.tmp/print-multy.html', this.windowConfig)
  }
}
