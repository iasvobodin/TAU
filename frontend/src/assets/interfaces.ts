import type { Prisma } from '../../../extensions/src'

///for app
export type SerialNumberData = {
  name: string
  partNumber: string
  invoice?: string
  comment?: string
  supplier?: string
  _rejected?: boolean
  status?: boolean
  _added?: boolean
}

export type ModulesType =
  | 'Controller'
  | 'PowerSupply'
  | 'Modules'
  | 'PAZ'
  | 'TerminalBlocks'
  | 'SupportPanels'
  | 'Defective'

export type Barcodes = {
  barcode: string
  productName: string
  partNumber: string
  type: ModulesType
  fileName?: string
}

export type StageType =
  | 'issue'
  | 'preProdaction'
  | 'assembly'
  | 'marking'
  | 'functionalTest'
  | 'verification'
  | 'package'

export type ProductAllPayload = Prisma.ProductGetPayload<{
  include: {
    specification: {
      include: {
        operation: true
        template: true
        test: true
        checkList: true
      }
    }
    productionOperations: true
    components: true
  }
}>

export type Information = {
  'SN изделия': string
  'Артикул изделия': string
  'Наименование изделия': string
  'Тип изделия': ModulesType
}
export interface ProductType {
  specification: ProductAllPayload | null
  information: Information | null
  spPartNumber: string | null
  error: string | null
  qty: string | null
  serialNumbers: string[] | null
  failedStage?: string
}

export type Specification = ProductAllPayload['specification']

// Тип для преобразованного operation
type Operation = Partial<ProductAllPayload['specification']['operation']>

// Итоговый тип для трансформированной спецификации
export type Tsp = {
  id: number // Предполагаем, что id — это число (на основе sp.id)
  snProduct: string // Предполагаем, что snProduct — строка
  information: Information
  specification: { [key: string]: { PN: string; SN: string } }
  test: Specification['test']
  checkList: Specification['checkList']
  template: Specification['template']
  operation: Operation
  productionOperations: ProductAllPayload['productionOperations']
  components: ProductAllPayload['components']
  productPartNumbers: string[]
  productSerialNumbers: string[]
}
