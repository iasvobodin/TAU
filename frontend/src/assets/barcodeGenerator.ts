// import bwipjs from 'bwip-js'
// import imgUrl from './EAC.png'
// import {
//   Document,
//   Packer,
//   Paragraph,
//   ImageRun,
//   Table,
//   TableRow,
//   TableCell,
//   TextRun,
//   type PositiveUniversalMeasure,
//   type ITableBordersOptions,
//   type ISectionPropertiesOptions,
//   type IBorderOptions
// } from 'docx'
// import { filesystem, os } from '@neutralinojs/lib'
// import type { ModulesType } from '@/assets/interfaces'

// const generateBarcodeDataUrl = (data: string): string => {
//   const canvas = document.createElement('canvas')
//   try {
//     bwipjs.toCanvas(canvas, {
//       bcid: 'code128',
//       text: data,
//       height: 5,
//       textxalign: 'center'
//     })
//     return canvas.toDataURL('image/png')
//   } catch (error) {
//     console.error('Error generating barcode:', error)
//     throw error
//   }
// }

// type Barcodes = {
//   barcode: string
//   productName: string
//   partNumber: string
//   type: ModulesType
// }[]

// // Перегрузка функции для поддержки обоих форматов входных данных
// async function createDocWithBarcodes(arr: Barcodes): Promise<void>
// async function createDocWithBarcodes(
//   barcodes: string[],
//   productName: string,
//   partNumber: string,
//   type: ModulesType
// ): Promise<void>
// async function createDocWithBarcodes(
//   arg1: Barcodes | string[],
//   productName?: string,
//   partNumber?: string,
//   type?: ModulesType
// ): Promise<void> {
//   // Определяем входные параметры
//   let barcodes: string[]
//   let finalProductName: string
//   let finalPartNumber: string
//   let finalType: ModulesType

//   if (Array.isArray(arg1) && typeof arg1[0] === 'object') {
//     // Первый вариант: массив объектов Barcodes
//     const arr = arg1 as Barcodes
//     barcodes = arr.map((e) => e.barcode)
//     finalProductName = arr[0].productName
//     finalPartNumber = arr[0].partNumber
//     finalType = arr[0].type
//   } else {
//     // Второй вариант: отдельные параметры
//     barcodes = arg1 as string[]
//     finalProductName = productName!
//     finalPartNumber = partNumber!
//     finalType = type!
//   }

//   const imageTest = await (await fetch(imgUrl)).arrayBuffer()

//   // Определение размеров страницы
//   const isTerminalOrSupport = finalType === 'TerminalBlocks' || finalType === 'SupportPanels'
//   const customWidth: PositiveUniversalMeasure = isTerminalOrSupport ? '43mm' : '30mm'
//   const customHeight: PositiveUniversalMeasure = isTerminalOrSupport ? '25mm' : '20mm'

//   const sectionProperties: ISectionPropertiesOptions = {
//     page: {
//       size: { width: customWidth, height: customHeight },
//       margin: { top: 50, right: 10, bottom: 10, left: 10 }
//     },
//     type: 'nextPage'
//   }

//   const bord: IBorderOptions = { style: 'none', size: 0, color: 'FFFFFF' }
//   const borders: ITableBordersOptions = {
//     top: bord,
//     bottom: bord,
//     left: bord,
//     right: bord,
//     insideHorizontal: bord,
//     insideVertical: bord
//   }

//   const sections = []

//   for (const barcode of barcodes) {
//     console.log(barcode)

//     try {
//       const barcodeDataUrl = generateBarcodeDataUrl(barcode)
//       const imageBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

//       // Создаем массив ячеек
//       const tableCells: TableCell[] = [
//         new TableCell({
//           children: [
//             new Paragraph({
//               children: [
//                 new ImageRun({
//                   data: imageBuffer,
//                   type: 'png',
//                   transformation: {
//                     width: 270 / 2.65,
//                     height: 50 / 2.65
//                   }
//                 })
//               ],
//               alignment: isTerminalOrSupport ? undefined : 'center'
//             })
//           ],
//           width: { size: 100, type: 'pct' }
//         })
//       ]

//       // Добавляем дополнительную ячейку для определенных типов
//       if (isTerminalOrSupport) {
//         tableCells.push(
//           new TableCell({
//             children: [
//               new Paragraph({
//                 children: [
//                   new ImageRun({
//                     data: imageTest,
//                     type: 'png',
//                     transformation: {
//                       width: 50 / 2.65,
//                       height: 50 / 2.65
//                     }
//                   })
//                 ],
//                 alignment: 'right'
//               })
//             ]
//           })
//         )
//       }

//       const mainTableRows = [
//         new TableRow({
//           children: tableCells,
//           height: { value: '5mm', rule: 'exact' },
//           cantSplit: true
//         }),
//         new TableRow({
//           children: [
//             new TableCell({
//               children: [
//                 new Paragraph({
//                   children: [
//                     new TextRun({
//                       text: `SN: ${barcode}`,
//                       size: 10,
//                       font: 'Arial Narrow'
//                     })
//                   ]
//                 }),
//                 new Paragraph({
//                   children: [
//                     new TextRun({
//                       text: `PN: ${finalPartNumber}`,
//                       size: 10,
//                       font: 'Arial Narrow'
//                     })
//                   ]
//                 }),
//                 new Paragraph({
//                   children: [
//                     new TextRun({
//                       text: finalProductName,
//                       size: 10,
//                       font: 'Arial Narrow'
//                     })
//                   ]
//                 })
//               ],
//               columnSpan: 2,
//               verticalAlign: 'center'
//             })
//           ],
//           height: { value: isTerminalOrSupport ? '14mm' : '13mm', rule: 'exact' },
//           cantSplit: true
//         })
//       ]

//       // Добавляем блок с информацией о компании и стране только для определенных типов
//       if (isTerminalOrSupport) {
//         mainTableRows.push(
//           new TableRow({
//             children: [
//               new TableCell({
//                 children: [
//                   new Paragraph({
//                     children: [
//                       new TextRun({
//                         text: `OOO "Метран Проект"`,
//                         size: 10,
//                         font: 'Arial Narrow'
//                       })
//                     ],
//                     alignment: 'right'
//                   }),
//                   new Paragraph({
//                     children: [
//                       new TextRun({
//                         text: `Россия`,
//                         size: 10,
//                         font: 'Arial Narrow'
//                       })
//                     ],
//                     alignment: 'right'
//                   })
//                 ],
//                 columnSpan: 2
//               })
//             ],
//             height: { value: '4mm', rule: 'exact' },
//             cantSplit: true
//           })
//         )
//       }

//       const table = new Table({
//         rows: mainTableRows,
//         width: { size: 93, type: 'pct' },
//         borders,
//         alignment: 'center'
//       })

//       sections.push({
//         properties: sectionProperties,
//         children: [table]
//       })
//     } catch (error) {
//       console.error('Error generating barcode:', error)
//     }
//   }

//   const today = new Date()
//   const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getSeconds()}`
//   const fileName = `barcodes_${formattedDate}.docx`
//   const doc = new Document({
//     sections,
//     styles: {
//       default: {
//         document: {
//           run: {
//             size: 1 // 12pt
//           }
//         }
//       }
//     }
//   })

//   try {
//     const blob = await Packer.toBlob(doc)
//     const arrayBuffer = await blob.arrayBuffer()
//     const entry = await os.showSaveDialog('Сохранить файл', {
//       defaultPath: fileName,
//       filters: [{ name: 'Documents', extensions: ['docx'] }]
//     })
//     await filesystem.writeBinaryFile(entry, arrayBuffer)
//     console.log('Document created successfully', entry)
//   } catch (error: any) {
//     console.error('Error creating document:', error)
//     throw new Error(error.message)
//   }
// }

// export { createDocWithBarcodes }

import bwipjs from 'bwip-js'
import imgUrl from './EAC.png'
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

// Тип для ключей PAGE_CONFIG
type PageConfigKey = 'TerminalBlocks' | 'SupportPanels' | 'default'

// Конфигурация страницы и стилей
const PAGE_CONFIG: Record<
  PageConfigKey,
  { width: PositiveUniversalMeasure; height: PositiveUniversalMeasure }
> = {
  TerminalBlocks: { width: '43mm', height: '25mm' },
  SupportPanels: { width: '43mm', height: '25mm' },
  default: { width: '30mm', height: '20mm' }
}

const BORDERS: ITableBordersOptions = {
  top: { style: 'none', size: 0, color: 'FFFFFF' },
  bottom: { style: 'none', size: 0, color: 'FFFFFF' },
  left: { style: 'none', size: 0, color: 'FFFFFF' },
  right: { style: 'none', size: 0, color: 'FFFFFF' },
  insideHorizontal: { style: 'none', size: 0, color: 'FFFFFF' },
  insideVertical: { style: 'none', size: 0, color: 'FFFFFF' }
}

const TEXT_STYLE = { size: 10, font: 'Arial Narrow' }

// Типы для входных данных
type BarcodeData = {
  barcode: string
  productName: string
  partNumber: string
  type: ModulesType
}

type Barcodes = BarcodeData[]

// Генерация штрихкода
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
    throw new Error(`Failed to generate barcode for ${data}: ${error}`)
  }
}

// Создание ячеек таблицы
const createTableCells = async (
  barcode: string,
  isTerminalOrSupport: boolean,
  eacImageBuffer: ArrayBuffer
): Promise<TableCell[]> => {
  const barcodeDataUrl = generateBarcodeDataUrl(barcode)
  const barcodeBuffer = await fetch(barcodeDataUrl).then((res) => res.arrayBuffer())

  const cells: TableCell[] = [
    new TableCell({
      children: [
        new Paragraph({
          children: [
            new ImageRun({
              data: barcodeBuffer,
              type: 'png',
              transformation: { width: 270 / 2.65, height: 50 / 2.65 }
            })
          ],
          alignment: isTerminalOrSupport ? undefined : 'center'
        })
      ],
      width: { size: 100, type: 'pct' }
    })
  ]

  if (isTerminalOrSupport) {
    cells.push(
      new TableCell({
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                data: eacImageBuffer,
                type: 'png',
                transformation: { width: 50 / 2.65, height: 50 / 2.65 }
              })
            ],
            alignment: 'right'
          })
        ]
      })
    )
  }

  return cells
}

// Создание строк таблицы
const createTableRows = (
  barcode: string,
  productName: string,
  partNumber: string,
  isTerminalOrSupport: boolean,
  tableCells: TableCell[]
): TableRow[] => {
  const rows: TableRow[] = [
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
              children: [new TextRun({ text: `SN: ${barcode}`, ...TEXT_STYLE })]
            }),
            new Paragraph({
              children: [new TextRun({ text: `PN: ${partNumber}`, ...TEXT_STYLE })]
            }),
            new Paragraph({
              children: [new TextRun({ text: productName, ...TEXT_STYLE })]
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

  if (isTerminalOrSupport) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: `OOO "Метран Проект"`, ...TEXT_STYLE })],
                alignment: 'right'
              }),
              new Paragraph({
                children: [new TextRun({ text: `Россия`, ...TEXT_STYLE })],
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

  return rows
}

// Основная функция
async function createDocWithBarcodes(arr: Barcodes): Promise<void>
async function createDocWithBarcodes(
  barcodes: string[],
  productName: string,
  partNumber: string,
  type: ModulesType
): Promise<void>
async function createDocWithBarcodes(
  arg1: Barcodes | string[],
  productName?: string,
  partNumber?: string,
  type?: ModulesType
): Promise<void> {
  // Нормализация входных данных
  let barcodes: string[]
  let finalProductName: string
  let finalPartNumber: string
  let finalType: ModulesType

  if (Array.isArray(arg1) && arg1.length > 0 && typeof arg1[0] === 'object') {
    const arr = arg1 as Barcodes
    barcodes = arr.map((e) => e.barcode)
    finalProductName = arr[0].productName
    finalPartNumber = arr[0].partNumber
    finalType = arr[0].type
  } else if (Array.isArray(arg1) && productName && partNumber && type) {
    barcodes = arg1 as string[]
    finalProductName = productName
    finalPartNumber = partNumber
    finalType = type
  } else {
    throw new Error('Invalid input: Provide either an array of BarcodeData or valid parameters')
  }

  if (barcodes.length === 0) {
    throw new Error('No barcodes provided')
  }

  // Загрузка изображения EAC один раз
  const eacImageBuffer = await (await fetch(imgUrl)).arrayBuffer()

  // Настройка страницы
  const isTerminalOrSupport = finalType === 'TerminalBlocks' || finalType === 'SupportPanels'
  // Безопасный доступ к PAGE_CONFIG
  const pageKey: PageConfigKey = isTerminalOrSupport ? (finalType as PageConfigKey) : 'default'
  const pageSize = PAGE_CONFIG[pageKey]
  const sectionProperties: ISectionPropertiesOptions = {
    page: {
      size: { width: pageSize.width, height: pageSize.height },
      margin: { top: 50, right: 10, bottom: 10, left: 10 }
    },
    type: 'nextPage'
  }

  // Создание секций
  const sections = await Promise.all(
    barcodes.map(async (barcode) => {
      try {
        const tableCells = await createTableCells(barcode, isTerminalOrSupport, eacImageBuffer)
        const tableRows = createTableRows(
          barcode,
          finalProductName,
          finalPartNumber,
          isTerminalOrSupport,
          tableCells
        )

        const table = new Table({
          rows: tableRows,
          width: { size: 93, type: 'pct' },
          borders: BORDERS,
          alignment: 'center'
        })

        return { properties: sectionProperties, children: [table] }
      } catch (error) {
        console.error(`Error processing barcode ${barcode}:`, error)
        return null
      }
    })
  )

  // Фильтрация неудачных секций
  const validSections = sections.filter((section) => section !== null)

  if (validSections.length === 0) {
    throw new Error('No valid sections generated')
  }

  // Создание документа
  const doc = new Document({
    sections: validSections,
    styles: {
      default: {
        document: {
          run: { size: 1 } // 12pt
        }
      }
    }
  })

  // Сохранение файла
  const today = new Date()
  const formattedDate = `${today.getDate()}_${today.getMonth() + 1}_${today.getFullYear()}_${today.getSeconds()}`
  const fileName = `barcodes_${formattedDate}.docx`

  try {
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    const entry = await os.showSaveDialog('Сохранить файл', {
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['docx'] }]
    })
    await filesystem.writeBinaryFile(entry, arrayBuffer)
    console.log('Document created successfully:', entry)
  } catch (error) {
    throw new Error(`Failed to save document: ${error}`)
  }
}

export { createDocWithBarcodes }
