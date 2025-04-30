import bwipjs from 'bwip-js'
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  TextRun,
  type PositiveUniversalMeasure,
  convertMillimetersToTwip
} from 'docx'
import { filesystem, os } from '@neutralinojs/lib'
import type { ModulesType } from '@/assets/interfaces'
import { createSvg } from './createSVG'

const generateBarcodeDataUrl = (data: string): string => {
  try {
    const canvas = document.createElement('canvas')
    bwipjs.toCanvas(canvas, {
      bcid: 'code128', // Тип штрихкода
      text: data, // Текст для штрихкода
      height: 5,
      textxalign: 'center' // Выравнивание текста
    })
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Error generating barcode:', error)
    throw error
  }
}

export const createDocWithBarcodes = async (
  barcodes: string[],
  productName: string,
  partNumber: string,
  type: ModulesType
) => {
  // Размеры страницы в twips (1 twip = 1/1440 дюйма)
  let customWidth = '30mm' as PositiveUniversalMeasure // 45 мм в twips
  let customHeight = '20mm' as PositiveUniversalMeasure // 30 мм в twips

  if (type === 'TerminalBlocks' || 'SupportPanels') {
    //меняем размер листа 25 на 43
    customWidth = '43mm'
    customHeight = '25mm'
  }

  let data = await filesystem.readBinaryFile('./EAC.png')

  // Настройки для секции с кастомными размерами
  const sectionProperties = {
    page: {
      size: { width: customWidth, height: customHeight },
      margin: { top: 20, right: 60, bottom: 20, left: 120 }
    }
  }

  const sections = []

  for (const barcode of barcodes) {
    try {
      const barcodeDataUrl = generateBarcodeDataUrl(barcode)
      const imageBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

      const product = new Paragraph({
        children: [
          new TextRun({
            text: productName,
            size: 11,
            font: 'Arial Narrow'
          })
        ]
        // alignment: 'center',
        // spacing: { before: 250, after: 20 }
      })

      const imageEAC = new Paragraph({
        children: [
          new ImageRun({
            data: data,
            type: 'png',
            transformation: {
              width: 50 / 2.65,
              height: 50 / 2.65
            },
            floating: {
              horizontalPosition: {
                align: 'right'
                // offset: 5104800 // relative: HorizontalPositionRelativeFrom.PAGE by default
              },
              verticalPosition: {
                // align: 36000
                offset: 36000 // relative: VerticalPositionRelativeFrom.PAGE by default
              }
            }
          })
        ],
        alignment: 'right' // Выравнивание изображения по правому краю
      })

      const production = [
        new Paragraph({
          children: [
            new TextRun({
              text: `OOO "Метран Проект"`,
              size: 10,
              font: 'Arial Narrow'
            })
          ],
          alignment: 'end',
          spacing: { before: 40 }
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Россия`,
              size: 10,
              font: 'Arial Narrow'
            })
          ],
          alignment: 'end',
          spacing: { after: 0 }
        })
      ]

      const partN = new Paragraph({
        children: [
          new TextRun({
            text: `PN: ${partNumber}`,
            size: 10,
            font: 'Arial Narrow'
          })
        ]
        // alignment: 'center',
        // spacing: { before: 250 }
      })
      const serialN = new Paragraph({
        children: [
          new TextRun({
            text: `SN: ${barcode}`,
            size: 10,
            font: 'Arial Narrow'
          })
        ],
        // alignment: 'center',
        spacing: { before: 130 }
      })

      const image = new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            type: 'png',
            transformation: {
              width: 270 / 2.65,
              height: 50 / 2.65
            },
            floating: {
              horizontalPosition: {
                offset: 72000
              },
              verticalPosition: {
                offset: 36000
                // align: 'center'
              }
            }
          }),
          new ImageRun({
            data: data,
            type: 'png',
            transformation: {
              width: 50 / 2.65,
              height: 50 / 2.65
            },
            floating: {
              horizontalPosition: {
                // align: 'right'
                offset: 1330000 // relative: HorizontalPositionRelativeFrom.PAGE by default
              },
              verticalPosition: {
                // align: 36000
                offset: 36000 // relative: VerticalPositionRelativeFrom.PAGE by default
              }
            }
          })
        ]
      })
      console.log(convertMillimetersToTwip(10), 'convertMillimetersToTwip(10)')

      sections.push({
        properties: sectionProperties,
        children: [image, serialN, partN, product, ...production]
      })
    } catch (error) {
      console.error('Error generating barcode:', error)
    }
  }

  const today = new Date()
  const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getMinutes()}`
  const fileName = `barcodes_${formattedDate}.docx`
  const doc = new Document({ sections })

  try {
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    const entry = await os.showSaveDialog('Сохранить файл', {
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['docx'] }]
    })
    await filesystem.writeBinaryFile(entry, arrayBuffer)
    console.log('Document created successfully')
  } catch (error: any) {
    console.error('Error creating document:', error)
    throw new Error(error.message)
  }
}

export const createDocWithBarcodesTerminal = async (
  barcodes: string[],
  productName: string,
  partNumber: string
) => {
  // Размеры страницы в twips (1 twip = 1/1440 дюйма)
  const customWidth = '30mm' as PositiveUniversalMeasure // 45 мм в twips
  const customHeight = '20mm' as PositiveUniversalMeasure // 30 мм в twips
  // Настройки для секции с кастомными размерами
  const sectionProperties = {
    page: {
      size: { width: customWidth, height: customHeight },
      margin: { top: 20, right: 60, bottom: 20, left: 60 }
    }
  }

  const sections = []

  for (const barcode of barcodes) {
    try {
      const barcodeDataUrl = generateBarcodeDataUrl(barcode)
      const imageBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

      const product = new Paragraph({
        children: [
          new TextRun({
            text: productName,
            size: 11,
            font: 'Arial Narrow'
          })
        ]
        // alignment: 'center',
        // spacing: { before: 250, after: 20 }
      })

      const partN = new Paragraph({
        children: [
          new TextRun({
            text: `PN: ${partNumber}`,
            size: 12,
            font: 'Arial Narrow'
          })
        ]
        // alignment: 'center',
        // spacing: { before: 250 }
      })
      const serialN = new Paragraph({
        children: [
          new TextRun({
            text: `SN: ${barcode}`,
            size: 12,
            font: 'Arial Narrow'
          })
        ],
        // alignment: 'center',
        spacing: { before: 150 }
      })

      const image = new Paragraph({
        children: [
          new ImageRun({
            data: imageBuffer,
            type: 'png',
            transformation: {
              width: 270 / 2.65,
              height: 50 / 2.65
            },
            floating: {
              horizontalPosition: {
                align: 'center'
              },
              verticalPosition: {
                offset: 36000
                // align: 'center'
              }
            }
          })
        ]
      })
      console.log(convertMillimetersToTwip(10), 'convertMillimetersToTwip(10)')

      sections.push({
        properties: sectionProperties,
        children: [image, serialN, partN, product]
      })
    } catch (error) {
      console.error('Error generating barcode:', error)
    }
  }

  const today = new Date()
  const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getMinutes()}`
  const fileName = `barcodes_${formattedDate}.docx`
  const doc = new Document({ sections })

  try {
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    const entry = await os.showSaveDialog('Сохранить файл', {
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['docx'] }]
    })
    await filesystem.writeBinaryFile(entry, arrayBuffer)
    console.log('Document created successfully')
  } catch (error: any) {
    console.error('Error creating document:', error)
    throw new Error(error.message)
  }
}
