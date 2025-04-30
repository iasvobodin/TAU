import type { TransformSpecification } from '@/assets/transformSP'
import type { ModulesType, Barcodes, ProductType, StageType } from '@/assets/interfaces'
import { server, filesystem, os, events, window as neuWindow } from '@neutralinojs/lib'
import bwipjs from 'bwip-js'

type props = {
  information: ProductType['information']
  product: TransformSpecification
}

const generateBarcodeDataUrl = (data: string) => {
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
    console.error('Error generating barcode:', error)
    return null
  }
}

const readTemplate = async (fileName: string) => {
  // Загружаем шаблон из frontend/dist/
  const templatePath = window.NL_PATH + `/frontend/dist/${fileName}.html`
  try {
    const htmlContent = await filesystem.readFile(templatePath)
    return htmlContent
  } catch (error) {
    console.error('Ошибка при чтении шаблона:', error)
    return null
  }
}

// Функция для конвертации строки в Uint8Array
const stringToUint8Array = (str: string) => {
  const encoder = new TextEncoder()
  return encoder.encode(str)
}

// Запись файла в Neutralino
const writeTemplate = async (data: Uint8Array<ArrayBufferLike>) => {
  try {
    await filesystem.writeBinaryFile(window.NL_PATH + '/.tmp/print-label.html', data)
    console.log('Файл print-label.html успешно создан')
  } catch (error) {
    console.error('Ошибка при создании файла:', error)
  }
}

const createFile = async (LabelInfo: Barcodes) => {
  const barcodeDataUrl = generateBarcodeDataUrl(LabelInfo.barcode)

  let htmlContent = await readTemplate(LabelInfo.fileName!)

  // Подставляем значения
  if (htmlContent && barcodeDataUrl) {
    htmlContent = htmlContent
      .replace('${barcodeDataUrl}', barcodeDataUrl)
      .replace('${LabelInfo.barcode}', LabelInfo.barcode)
      .replace('${LabelInfo.partNumber}', LabelInfo.partNumber)
      .replace('${LabelInfo.productName}', LabelInfo.productName)
  }

  const data = stringToUint8Array(htmlContent!)

  await writeTemplate(data)

  try {
    // Открываем новое окно
    await neuWindow.create('/.tmp/print-label.html', {
      x: 0,
      y: 0,
      width: 650,
      height: 500,
      maximizable: false,
      exitProcessOnClose: true,
      enableInspector: false,
      processArgs: '--window-id=W_PDF'
    })
  } catch (error) {
    console.log(error)
  }
}
const prepareData = async (props: props, fileName: string) => {
  // Проверка на null
  if (!props.product?.information || !props.product?.specification) {
    console.error('Missing product information or specification')
    return
  }
  const {
    product: { specification, information }
  } = props
  const productType = information['Тип изделия']
  const isTerminal = productType === 'TerminalBlocks' || productType === 'SupportPanels'
  const boardKey = isTerminal ? 'плата 1' : 'плата 2'

  let printInformation: Barcodes = {
    barcode: '',
    productName: '',
    partNumber: '',
    type: '' as ModulesType,
    fileName
  }

  for (const [key, value] of Object.entries(specification)) {
    if (key.toLowerCase().includes(boardKey)) {
      console.log(`то что надо для ${productType === 'TerminalBlocks' ? 'клеммника' : 'модуля'}`)
      printInformation = {
        barcode: value.SN,
        partNumber: information['Артикул изделия'],
        productName: information['Наименование изделия'],
        type: information['Тип изделия'] as ModulesType,
        fileName
      }
      break // Выходим из цикла после нахождения нужной платы
    }
  }

  console.log('print', printInformation)
  return printInformation // Возвращаем результат для дальнейшего использования
}
export const printLabel = async (props: props, fileName: string) => {
  const data = await prepareData(props, fileName)
  if (data) {
    await createFile(data)
    console.log('файл на печать успешно выведен')
  }
}
