import { filesystem, resources, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'

// ===== Интерфейсы =====

interface LabelItem {
  serial: string
}

interface CommonData {
  partNumber: string
  description: string
  manufacturer: string
}

// ===== Конфиг окна =====

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

// ===== Генерация штрихкода =====

class BarcodeGenerator {
  static generateDataUrl(data: string): string {
    const canvas = document.createElement('canvas')

    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'datamatrix', // 🔥 используем DataMatrix
        text: data,
        scale: 3
      })

      return canvas.toDataURL('image/png')
    } catch (error) {
      throw new Error(`Ошибка генерации штрихкода: ${JSON.stringify(error)}`)
    }
  }
}

// ===== Работа с файлами =====

class FileSystemManager {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async readTemplate(fileName: string): Promise<string> {
    const templatePath = `/frontend/dist/${fileName}.html`
    return await resources.readFile(templatePath)
  }

  async writeTemplate(content: string, outputFile: string): Promise<void> {
    const data = new TextEncoder().encode(content)
    const outputPath = `${this.basePath}/.tmp/${outputFile}`

    await filesystem.writeBinaryFile(outputPath, data)
  }
}

// ===== Утилиты =====

function normalizeBarcode(barcode: string): string {
  return barcode.endsWith('-02') ? barcode.slice(0, -3) : barcode
}

function extractTemplateParts(template: string): {
  styles: string
  content: string
} {
  const styleMatch = template.match(/<style[^>]*>([\s\S]*?)<\/style>/)
  const templateMatch = template.match(/<template[^>]*>([\s\S]*?)<\/template>/)

  if (!styleMatch || !templateMatch) {
    throw new Error('Ошибка структуры шаблона')
  }

  return {
    styles: styleMatch[0],
    content: templateMatch[1]
  }
}

// ===== Рендер одной этикетки =====

function renderLabel(template: string, item: LabelItem, common: CommonData): string {
  const serial = normalizeBarcode(item.serial)

  const barcode = BarcodeGenerator.generateDataUrl(serial)

  return template
    .replace('${barcode}', barcode)
    .replace('${serial}', serial)
    .replace('${partNumber}', common.partNumber)
    .replace('${description}', common.description)
    .replace('${manufacturer}', common.manufacturer)
}

// ===== Сборка документа =====

function buildDocument(content: string): string {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Print</title>

  <style>
    body {
      margin: 0;
    }
  </style>
</head>

<body>
  ${content}

  <script>
    window.onload = () => {
      window.print()
    }
  </script>
</body>
</html>
`
}

// ===== Основной класс =====

export class LabelPrinterMulty {
  private fileSystem: FileSystemManager
  private windowConfig: WindowConfig

  constructor(basePath: string) {
    this.fileSystem = new FileSystemManager(basePath)

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

  async print(items: LabelItem[], common: CommonData): Promise<void> {
    if (!items.length) {
      throw new Error('Нет данных для печати')
    }

    const rawTemplate = await this.fileSystem.readTemplate('label-template')

    const { styles, content: template } = extractTemplateParts(rawTemplate)

    const pages = items.map((item) => renderLabel(template, item, common)).join('')

    const html = buildDocument(styles + pages)

    await this.fileSystem.writeTemplate(html, 'print-multy.html')

    await neuWindow.create('/.tmp/print-multy.html', this.windowConfig)
  }
}
