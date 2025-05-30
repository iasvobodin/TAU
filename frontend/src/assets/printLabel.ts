import type { TransformSpecification } from '@/assets/transformSP'
import type { ModulesType, Barcodes, ProductType } from '@/assets/interfaces'
import { filesystem, resources, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'

// Типизация входных параметров
interface Props {
  information: ProductType['information']
  product: TransformSpecification
}

// Интерфейс для конфигурации окна
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

// Класс для работы с штрихкодами
class BarcodeGenerator {
  static generateDataUrl(data: string): string {
    data.endsWith('-02') ? data.slice(0, -3) : data

    const canvas = document.createElement('canvas')
    try {
      bwipjs.toCanvas(canvas, {
        bcid: 'code128',
        text: data,
        height: 4,
        textxalign: 'center'
      })
      return canvas.toDataURL('image/png')
    } catch (error) {
      throw new Error(`Ошибка генерации штрихкода: ${JSON.stringify(error)}`)
    }
  }
}

// Класс для работы с файловой системой
class FileSystemManager {
  private basePath: string

  constructor(basePath: string) {
    this.basePath = basePath
  }

  async readTemplate(fileName: string): Promise<string> {
    const templatePath = `/frontend/dist/${fileName}.html`
    try {
      return await resources.readFile(templatePath)
    } catch (error) {
      throw new Error(`Ошибка чтения шаблона ${fileName}: ${JSON.stringify(error)}`)
    }
  }

  async writeTemplate(content: string, outputFile: string): Promise<void> {
    const data = new TextEncoder().encode(content)
    const outputPath = `${this.basePath}/.tmp/${outputFile}`
    try {
      await filesystem.writeBinaryFile(outputPath, data)
      console.log(`Файл ${outputFile} успешно создан`)
    } catch (error) {
      throw new Error(`Ошибка записи файла ${outputFile}: ${JSON.stringify(error)}`)
    }
  }
}

// Класс для обработки данных этикетки
class LabelDataProcessor {
  private props: Props

  constructor(props: Props) {
    this.props = props
  }

  private getBoardKey(): string {
    const productType = this.props.information!['Тип изделия']
    const isTerminal = productType === 'TerminalBlocks' || productType === 'SupportPanels'
    return isTerminal ? 'плата 1' : 'плата 2'
  }

  private getTemplateFileName(type: ModulesType): string {
    switch (type) {
      case 'Controller':
      case 'PowerSupply':
      case 'Modules':
      case 'PAZ':
        return 'printLabel30x20module'
      case 'TerminalBlocks':
      case 'SupportPanels':
        return 'printLabel30x20terminal'
      case 'Defective':
        return 'printLabel30x20defect'
      default:
        throw new Error(`Неизвестный тип изделия: ${type}`)
    }
  }

  process(): Barcodes {
    const { specification, information, snProduct } = this.props.product

    if (!information || !specification) {
      throw new Error('Отсутствует информация о продукте или спецификация')
    }
    const type = information['Тип изделия'] as ModulesType
    const fileName = this.getTemplateFileName(type)

    if (type === 'Defective') {
      if (!snProduct) {
        throw new Error('Отсутствует snProduct для бракованного изделия')
      }
      console.log(`Используется snProduct для бракованного изделия`)
      return {
        barcode: snProduct,
        partNumber: information['Артикул изделия'],
        productName: information['Наименование изделия'],
        type,
        fileName
      }
    }
    const boardKey = this.getBoardKey()
    for (const [key, value] of Object.entries(specification)) {
      if (key.toLowerCase().includes(boardKey)) {
        console.log(`Найдена плата для ${information['Тип изделия']}`)
        const fileName = this.getTemplateFileName(information['Тип изделия'] as ModulesType)
        return {
          barcode: value.SN,
          partNumber: information['Артикул изделия'],
          productName: information['Наименование изделия'],
          type: information['Тип изделия'] as ModulesType,
          fileName
        }
      }
    }

    throw new Error('Подходящая плата не найдена')
  }
}

// Класс для создания и печати этикетки
class LabelPrinter {
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

  private replaceTemplateValues(template: string, data: Barcodes): string {
    return template
      .replace(
        '${barcodeDataUrl}',
        BarcodeGenerator.generateDataUrl(
          data.barcode.endsWith('-02') ? data.barcode.slice(0, -3) : data.barcode
        )
      )
      .replace(
        '${LabelInfo.barcode}',
        data.barcode.endsWith('-02') ? data.barcode.slice(0, -3) : data.barcode
      )
      .replace('${LabelInfo.partNumber}', data.partNumber)
      .replace('${LabelInfo.productName}', data.productName)
  }

  async print(labelInfo: Barcodes): Promise<void> {
    const template = await this.fileSystem.readTemplate(labelInfo.fileName!)
    const updatedContent = this.replaceTemplateValues(template, labelInfo)
    await this.fileSystem.writeTemplate(updatedContent, 'print-label.html')

    try {
      await neuWindow.create('/.tmp/print-label.html', this.windowConfig)
      console.log('Файл на печать успешно выведен')
    } catch (error) {
      throw new Error(`Ошибка открытия окна: ${JSON.stringify(error)}`)
    }
  }
}

// Основная функция для печати этикетки
export const printLabel = async (props: Props): Promise<void> => {
  console.log(props)

  try {
    const processor = new LabelDataProcessor(props)
    const labelInfo = processor.process()
    console.log(window.NL_PATH)

    const printer = new LabelPrinter(window.NL_PATH)
    await printer.print(labelInfo)
  } catch (error) {
    console.error('Ошибка печати этикетки:', error)
    throw error
  }
}
