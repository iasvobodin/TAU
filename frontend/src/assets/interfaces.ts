import type { Prisma } from '../../../extensions/src'

export interface Component {
  snComponent: string
  pnComponentId: string
  supplier: string
  invoice: string
  status: 'accepted' | 'issued' | 'defective' | 'shipped'
  comment: string
  user: string
  snProductId?: string
}

export interface Operator {
  login: string
  status: string
}

export interface ProductionOperation {
  stageType: string
  status: string
  operatorId: number
  productId: number
}

export interface Product {
  snProduct: string
  operationId: number
  specificationId: number
  templateId: number
  testId: number
}

export interface Specification {
  version: number
  productName: string
  productMP: string
  productMC: string
  productMM: string
  ElectronicBoard1: string
  ElectronicBoard2: string
  ElectronicBoard3: string
  ElectronicBoard4: string
  ElectronicBoard5: string
  ElectronicBoard6: string
  OtherCirciutry: string
  EnclosureType: string
  MountingScrew: string
}

export interface Operation {
  version: number
  productMC: string
  issue: boolean
  preProdaction: boolean
  assembly: boolean
  marking: boolean
  functionalTest: boolean
  verification: boolean
  package: boolean
}

export interface Template {
  version: number
  productMC: string
  markingTemplate: string
  markingEquipment: string
  stendForHiPot: string
  stendForTest: string
  verificationProtocol: string
  RE: string
  PS: string
  boxLabel: string
}

export interface Test {
  version: number
  productMC: string
  HiPot: string
}

export interface PartNumberComponent {
  partNumber: string
  descriptionRU: string
  descriptionEN: string
}

///for app
export type SerialNumberData = {
  name: string
  partNumber: string
  invoice?: string
  supplier?: string
  _rejected?: boolean
  _added?: boolean
}

export type ModulesType =
  | 'Controller'
  | 'PowerSupply'
  | 'Modules'
  | 'PAZ'
  | 'TerminalBlocks'
  | 'SupportPanels'

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
      }
    }
    productionOperations: true
    components: true
  }
}>

type Information = {
  'SN изделия': string
  'Артикул изделия': string
  'Наименование изделия': string
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
