// const bord: IBorderOptions = { style: 'none', size: 0, color: 'FFFFFF' }
// const borders: ITableBordersOptions = {
//   top: bord,
//   bottom: bord,
//   left: bord,
//   right: bord,
//   insideHorizontal: bord,
//   insideVertical: bord
// }

import bwipjs from 'bwip-js'
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  TextRun,
  type PositiveUniversalMeasure,
  type ITableBordersOptions,
  type ISectionPropertiesOptions,
  type IBorderOptions
} from 'docx'
import { filesystem, os } from '@neutralinojs/lib'
import type { ModulesType } from '@/assets/interfaces'

const generateBarcodeDataUrl = (data: string): string => {
  const canvas = document.createElement('canvas')
  try {
    bwipjs.toCanvas(canvas, {
      bcid: 'code128',
      text: data,
      height: 5,
      textxalign: 'center'
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
  const imageEac = await filesystem.readBinaryFile('./frontend/src/assets/EAC.png')

  // Определение размеров страницы
  const isTerminalOrSupport = type === 'TerminalBlocks' || type === 'SupportPanels'
  const customWidth: PositiveUniversalMeasure = isTerminalOrSupport ? '43mm' : '30mm'
  const customHeight: PositiveUniversalMeasure = isTerminalOrSupport ? '25mm' : '20mm'

  const sectionProperties: ISectionPropertiesOptions = {
    page: {
      size: { width: customWidth, height: customHeight },
      margin: { top: 50, right: 10, bottom: 10, left: 10 }
    },
    type: 'nextPage'
  }

  const bord: IBorderOptions = { style: 'none', size: 0, color: 'FFFFFF' }
  const borders: ITableBordersOptions = {
    top: bord,
    bottom: bord,
    left: bord,
    right: bord,
    insideHorizontal: bord,
    insideVertical: bord
  }

  const sections = []

  for (const barcode of barcodes) {
    try {
      const barcodeDataUrl = generateBarcodeDataUrl(barcode)
      const imageBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

      // Создаем массив ячеек
      const tableCells: TableCell[] = [
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageBuffer,
                  transformation: {
                    width: 270 / 2.65,
                    height: 50 / 2.65
                  }
                })
              ],
              alignment: isTerminalOrSupport ? undefined : 'center'
            })
          ],
          width: { size: 100, type: 'pct' }
        })
      ]

      // Добавляем дополнительную ячейку для определенных типов
      if (isTerminalOrSupport) {
        tableCells.push(
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: imageEac,
                    transformation: {
                      width: 50 / 2.65,
                      height: 50 / 2.65
                    }
                  })
                ],
                alignment: 'right'
              })
            ]
          })
        )
      }

      const mainTableRows = [
        new TableRow({
          children: tableCells,
          height: { value: '5mm', rule: 'exact' },
          cantSplit: true
        }),
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `SN: ${barcode}`,
                      size: 10,
                      font: 'Arial Narrow'
                    })
                  ]
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `PN: ${partNumber}`,
                      size: 10,
                      font: 'Arial Narrow'
                    })
                  ]
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: productName,
                      size: 10,
                      font: 'Arial Narrow'
                    })
                  ]
                })
              ],
              columnSpan: 2,
              verticalAlign: 'center'
            })
          ],
          height: { value: isTerminalOrSupport ? '14mm' : '13mm', rule: 'exact' },
          cantSplit: true
        })
      ]

      // Добавляем блок с информацией о компании и стране только для определенных типов
      if (isTerminalOrSupport) {
        mainTableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `OOO "Метран Проект"`,
                        size: 10,
                        font: 'Arial Narrow'
                      })
                    ],
                    alignment: 'right'
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Россия`,
                        size: 10,
                        font: 'Arial Narrow'
                      })
                    ],
                    alignment: 'right'
                  })
                ],
                columnSpan: 2
              })
            ],
            height: { value: '4mm', rule: 'exact' },
            cantSplit: true
          })
        )
      }

      const table = new Table({
        rows: mainTableRows,
        width: { size: 93, type: 'pct' },
        borders,
        alignment: 'center'
      })

      sections.push({
        properties: sectionProperties,
        children: [table]
      })
    } catch (error) {
      console.error('Error generating barcode:', error)
    }
  }

  const today = new Date()
  const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getMinutes()}`
  const fileName = `barcodes_${formattedDate}.docx`
  const doc = new Document({
    sections,
    styles: {
      default: {
        document: {
          run: {
            size: 1 // 12pt
          }
        }
      }
    }
  })

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
