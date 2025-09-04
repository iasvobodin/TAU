import type { Prisma, Specification as SSSP } from '../../../shared/src'

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
  imageUrl?: string // <- добавлено
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

export type ComponentAllPayload = Prisma.ComponentGetPayload<{
  include: {
    pnComponent: true
    ProductionOperation: true
  }
}>

export type Information = {
  'Инв. № изделия'?: string
  SN?: string
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
  failed?: boolean
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

export const defectWorkflowMap = {
  'Обнаружение брака': {
    actionType: 'DetectDefect',
    color: '#FF0000', // Красный (начало градиента)
    desc: 'на любом из этапов производства'
  },
  Фиксация: {
    actionType: 'RecordDefect',
    color: '#FF4500', // Оранжево-красный,
    desc: 'Оформление, фото, SN, номер партии'
  },
  Изоляция: {
    actionType: 'IsolateDefect',
    color: '#FF7F00', // Яркий оранжевый
    desc: 'Прекращение сборки, маркировка, перемещение на доработку'
  },
  'Анализ причин': {
    actionType: 'AnalyzeCause',
    color: '#FFA500', // Оранжево-жёлтый
    desc: 'Брак от поставщика, или брак на производстве'
  },
  'Создание рекламации': {
    actionType: 'CreateClaim',
    color: '#FFD700', // Золотистый
    desc: 'Заполнение формы и отправка поставщику (подтверждение получения)'
  },
  'Ответ поставщика': {
    actionType: 'SupplierResponse',
    color: '#FFFF00', // Чистый жёлтый
    desc: 'Подтверждение/отказ/уточнение'
  },
  Решение: {
    actionType: 'ResolveIssue',
    color: '#ADFF2F', // Желто-зелёный лайм
    desc: 'Доработка / разбор / переделка / списание'
  },
  'Корректирующие действия': {
    actionType: 'CorrectiveActions',
    color: '#7CFC00', // Яркий салатовый
    desc: 'Обучение, корректировка техпроцесса, смена инструмента и т.д.'
  },
  'Отчёт и закрытие': {
    actionType: 'CloseAndReport',
    color: '#00CC00', // Насыщенный зелёный
    desc: 'Запись результатов, обновление статистики, закрытие инцидента'
  }
} as const

export type DefectStage = keyof typeof defectWorkflowMap
export type ActionType = (typeof defectWorkflowMap)[DefectStage]['actionType']
export type StageColor = (typeof defectWorkflowMap)[DefectStage]['color']

export type DefectHistoryAll = Prisma.DefectHistoryGetPayload<{
  include: {
    component: {
      include: {
        pnComponent: true
      }
    }
  }
}>

// создаём новый тип, где заменим тип actionType
export type DefectHistoryWithTypedAction = Omit<DefectHistoryAll, 'actionType'> & {
  actionType: ActionType
}

export type InputData = {
  serverPath?: string
  pdfName?: string
  convertDone?: boolean
}

// Интерфейс для клиента
type Client = {
  clientId: string
  lastActive: string // ISO-строка даты
  pid: string
}

// Интерфейс для структуры ответа API
export type ClientsResponse = {
  count: number
  clients: Client[]
}

export type CheckList = {
  title: string
  values: Record<string, { status: string; comment: string }>
}

export type Sp = {
  sp: SSSP | null
  spPartNumber: string | null
  qty: string | null
  serialNumbers: string[] | null
  orderToProduction: string | null
}
