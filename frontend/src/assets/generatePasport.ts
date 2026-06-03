import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  convertInchesToTwip,
  AlignmentType
} from 'docx'
import { filesystem, os } from '@neutralinojs/lib'
import type { TransformSpecification } from './transformSP'
import imgUrl from './1.png'
import type { CheckList } from './interfaces'
import { getCurrentFormattedDate } from '@/assets/utils/getCurrentFormattedDate'
type OperationMap = Record<string, string>

const OPERATION_MAP: OperationMap = {
  marking: 'Маркировка',
  assembly: 'Сборка',
  functionalTest: 'Функциональное тестирование',
  package: 'Упаковка'
}

// // Функция для форматирования даты в нужном формате
// function getCurrentFormattedDate(date: Date): string {
//   // const date = new Date()
//   const day = String(date.getDate()).padStart(2, '0')
//   const month = String(date.getMonth() + 1).padStart(2, '0') // Месяцы начинаются с 0
//   const year = date.getFullYear()
//   return `${day}.${month}.${year}`
// }

const CURRENT_DATE = getCurrentFormattedDate(new Date())

function createTableCell(
  content: string | TextRun,
  options: { bold?: boolean; widthPct?: number; alignment?: 'left' | 'center' } = {}
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          typeof content === 'string' ? new TextRun({ text: content, bold: options.bold }) : content
        ],
        spacing: { after: 10, before: 10 },
        alignment: options.alignment
      })
    ],
    margins: {
      top: 100,
      bottom: 100,
      left: 200,
      right: 50
    },
    verticalAlign: 'center',
    width: options.widthPct ? { size: options.widthPct, type: 'pct' } : undefined
  })
}

// Функция для создания строки заголовков таблицы
function createHeaderRow(headers: string[]): TableRow {
  return new TableRow({
    children: headers.map((header) => createTableCell(header, { bold: true, alignment: 'center' }))
  })
}

// Функция для создания строки данных таблицы
function createDataRow(data: string[], columnWidths: number[]): TableRow {
  return new TableRow({
    children: data.map((cell, index) =>
      createTableCell(cell, { widthPct: columnWidths[index], alignment: 'center' })
    )
  })
}

// Функция для создания таблицы компонентов
function createComponentTable(headers: string[], data: Record<string, any>): Table {
  const columnWidths = [20, 60, 20] // Соотношение ширины колонок в процентах
  const tableRows = [
    createHeaderRow(headers),
    ...Object.keys(data).map((key) =>
      createDataRow([data[key].PN, key, data[key].SN], columnWidths)
    )
  ]

  return new Table({ rows: tableRows, width: { size: 100, type: 'pct' } })
}

// Функция для создания таблицы операций
function createOperationsTable(headers: string[], rows: string[][]): Table {
  const columnWidths = [33, 33, 33]
  const tableRows = [
    createHeaderRow(headers),
    ...rows.map((row) => createDataRow(row, columnWidths))
  ]

  return new Table({ rows: tableRows, width: { size: 100, type: 'pct' } })
}
function parseCheckList(checkList: CheckList['fields'] | null): string[][] {
  console.log(checkList, 'checkListcheckListcheckListcheckListcheckList')

  if (checkList === null) {
    return []
  } else {
    return checkList.map((e) => [e.name, e.status === 'pass' ? '✔️' : e.status, e.comment || '-'])
  }
}

// Функция для создания таблицы чеклиста
function createCheckListTable(headers: string[], rows: string[][]): Table {
  const columnWidths = [55, 15, 30] // ширина колонок в процентах
  const tableRows = [
    createHeaderRow(headers),
    ...rows.map((row) => createDataRow(row, columnWidths))
  ]

  return new Table({ rows: tableRows, width: { size: 100, type: 'pct' } })
}

// type CheckList = {
//   title: string
//   values: Record<string, { status: string; comment: string }>
// }

const findCheckListInOperation = (operations: TransformSpecification['productionOperations']) => {
  console.log(operations)

  const findValue = operations
    .map((operation) => {
      if (operation.stageType === 'functionalTest' && operation.checkList) {
        try {
          const parsed: CheckList = JSON.parse(operation.checkList)
          console.log(parsed)
          if (parsed && parsed.fields) {
            console.log(parsed.fields, 'parsed.fields')
            return parsed.fields
          }
        } catch (err) {
          console.error('Ошибка при парсинге checkList:', err)
        }
      }
    })
    .filter((values): values is CheckList['fields'] => !!values)[0]
  if (findValue) {
    return findValue
  } else {
    return null
  }
}
// Основная функция для генерации паспорта
export const generatePasport = async (
  productName: string,
  productPartNumber: string,
  productSerialNumber: string,
  specification: TransformSpecification['specification'],
  productionOperationsData: TransformSpecification['productionOperations']
): Promise<void> => {
  try {
    const headers = ['Артикул', 'Наименование', 'SN']
    const operationHeaders = ['Операция', 'Сборщик', 'Дата завершения операции']
    const checkListHeaders = ['Пункт проверки', 'Статус', 'Комментарий']

    const firstCheckListValues = findCheckListInOperation(productionOperationsData)

    console.log(firstCheckListValues)

    const operationRows = productionOperationsData.map((operation) => {
      return [
        OPERATION_MAP[operation.stageType as keyof OperationMap],
        operation.user,
        getCurrentFormattedDate(new Date(operation.date))
      ]
    })

    const checkListRows = parseCheckList(firstCheckListValues)
    console.log(checkListRows, 'checkListRows')

    const imageTest = await (await fetch(imgUrl)).arrayBuffer()

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new ImageRun({
                  data: imageTest,
                  type: 'png',
                  transformation: {
                    width: 600 / 2.65,
                    height: 119 / 2.65
                  },
                  floating: {
                    zIndex: 5,
                    horizontalPosition: { offset: 5104800 },
                    verticalPosition: { offset: 486000 }
                  }
                })
              ],
              alignment: AlignmentType.RIGHT
            }),
            new Paragraph({
              text: `Дата формирования: ${CURRENT_DATE}`,
              spacing: { after: 300 }
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Паспорт технологический', bold: true, size: 32 })],
              alignment: AlignmentType.CENTER,
              spacing: { after: 300 }
            }),
            new Paragraph({ text: `Изделие: ${productName}` }),
            new Paragraph({ text: `Артикул: ${productPartNumber}` }),
            new Paragraph({
              text: `Серийный номер: ${productSerialNumber.endsWith('-02') ? productSerialNumber.slice(0, -3) : productSerialNumber}`
            }),
            new Paragraph({ text: 'Состав:', spacing: { before: 500 } }),
            createComponentTable(headers, specification),
            new Paragraph({ text: 'Перечень операций:', spacing: { before: 500 } }),
            createOperationsTable(operationHeaders, operationRows),
            new Paragraph({
              text: 'Чеклист функционального тестирования:',
              spacing: { before: 500 }
            }),
            createCheckListTable(checkListHeaders, checkListRows),
            new Paragraph({
              text: 'Инженер по качеству: ________________________',
              spacing: { after: 200, before: 1000 }
            }),
            new Paragraph({ text: 'Печать ОТК:', spacing: { before: 400, after: 200 } })
          ]
        }
      ],
      styles: {
        default: {
          document: { run: { size: 24 } } // 12pt
        }
      }
    })

    const fileName = `Паспорт технологический ${productSerialNumber.endsWith('-02') ? productSerialNumber.slice(0, -3) : productSerialNumber}.docx`
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    const savePath = await os.showSaveDialog('Сохранить файл', {
      defaultPath: fileName,
      filters: [{ name: 'Documents', extensions: ['docx'] }]
    })

    await filesystem.writeBinaryFile(savePath, arrayBuffer)
    console.log('Document created successfully')
  } catch (error) {
    console.error('Error creating document:', error)
    throw new Error('Error creating document')
  }
}
