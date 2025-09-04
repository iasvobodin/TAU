// import type { ProductAllPayload } from './interfaces'
// import { fetchPNComponent } from '@/api/partNumberComponentsServices'

// interface ProductInformation {
//   'SN изделия': string
//   'Артикул изделия': string
//   'Наименование изделия': string
//   'Тип изделия': string | null
// }

// export const transformSpecification = async (sp: ProductAllPayload) => {
//   const order = ['marking', 'assembly', 'functionalTest', 'package']
//   const productPartNumbers = <Array<string>>[]
//   const productSerialNumbers = <Array<string>>[]
//   const a: {
//     [index: string]: { PN: string; SN: string }
//   } = {}
//   const specification: typeof a = {
//     electronicBoard1: { PN: sp.specification.electronicBoard1, SN: '' },
//     electronicBoard2: { PN: sp.specification.electronicBoard2, SN: '' },
//     electronicBoard3: { PN: sp.specification.electronicBoard3, SN: '' },
//     electronicBoard4: { PN: sp.specification.electronicBoard4, SN: '' },
//     electronicBoard5: { PN: sp.specification.electronicBoard5, SN: '' },
//     electronicBoard6: { PN: sp.specification.electronicBoard6, SN: '' },
//     otherCirciutry: { PN: sp.specification.otherCirciutry, SN: '' },
//     enclosureType: { PN: sp.specification.enclosureType, SN: '' },
//     mountingScrew: { PN: sp.specification.mountingScrew, SN: '' }
//     // packingBox: {PN : sp.specification.packingBox
//   }

//   const tsp = {
//     id: sp.id,
//     snProduct: sp.snProduct,
//     information: {
//       'SN изделия': sp.snProduct,
//       'Артикул изделия': sp.specification.productMP,
//       'Наименование изделия': sp.specification.productName,
//       'Тип изделия': sp.specification.type
//     },

//     specification,
//     test: sp.specification.test,
//     template: sp.specification.template,
//     operation: Object.entries(sp.specification.operation)
//       .filter(([key]) => order.includes(key)) // Фильтруем только нужные ключи
//       .sort(([keyA], [keyB]) => order.indexOf(keyA) - order.indexOf(keyB)) // Сортируем по порядку
//       .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
//     productionOperations: sp.productionOperations,
//     components: sp.components,
//     productPartNumbers: <Array<string>>[],
//     productSerialNumbers: <Array<string>>[]
//   }

//   async function transformObject(sp: typeof specification) {
//     // console.log(specification, 'specification')

//     for (const key in sp) {
//       if (sp.hasOwnProperty(key)) {
//         const value = sp[key as keyof typeof specification]

//         if (value.PN) {
//           // console.log(value.PN, 'value.PN')
//           const newKey = await fetchPNComponent(value.PN)
//           a[newKey.data!.descriptionRU] = value
//           productPartNumbers.push(value.PN)

//           const component = tsp.components.find((e) => e.pnComponentId === value.PN)
//           if (component) {
//             value.SN = component.snComponent
//             productSerialNumbers.push(component.snComponent) //value.SN = component.snComponent
//           } else {
//             value.SN = ''
//           }
//         }
//       }
//     }
//     return a
//   }
//   const result = await transformObject(specification)
//   tsp.specification = result
//   tsp.productSerialNumbers = productSerialNumbers
//   tsp.productPartNumbers = productPartNumbers

//   return tsp
// }

// export type TransformSpecification = Awaited<ReturnType<typeof transformSpecification>>

import type { ProductAllPayload, Information, Tsp } from './interfaces'
import { fetchPNComponent } from '@/api/partNumberComponentsServices'

// type Information = {
//   'SN': string
//   'Артикул изделия': string
//   'Наименование изделия': string
//   'Тип изделия': string | null
// }

export const transformSpecification = async (sp: ProductAllPayload) => {
  const order = ['marking', 'assembly', 'functionalTest', 'package']

  // Инициализация спецификации с типизацией
  const specification: { [key: string]: { PN: string; SN: string } } = {
    electronicBoard1: { PN: sp.specification.electronicBoard1, SN: '' },
    electronicBoard2: { PN: sp.specification.electronicBoard2, SN: '' },
    electronicBoard3: { PN: sp.specification.electronicBoard3, SN: '' },
    electronicBoard4: { PN: sp.specification.electronicBoard4, SN: '' },
    electronicBoard5: { PN: sp.specification.electronicBoard5, SN: '' },
    electronicBoard6: { PN: sp.specification.electronicBoard6, SN: '' },
    otherCirciutry: { PN: sp.specification.otherCirciutry, SN: '' },
    enclosureType: { PN: sp.specification.enclosureType, SN: '' },
    mountingScrew: { PN: sp.specification.mountingScrew, SN: '' }
  }
  // Предполагаем, что specification в ProductAllPayload полностью описывает specification
  type Specification = ProductAllPayload['specification']

  // Тип для преобразованного operation
  type Operation = Partial<ProductAllPayload['specification']['operation']>

  // // Итоговый тип для tsp
  // type Tsp = {
  //   id: number // Предполагаем, что id — это число (на основе sp.id)
  //   snProduct: string // Предполагаем, что snProduct — строка
  //   information: Information
  //   specification: { [key: string]: { PN: string; SN: string } }
  //   test: Specification['test']
  //   template: Specification['template']
  //   operation: Operation
  //   productionOperations: ProductAllPayload['productionOperations']
  //   components: ProductAllPayload['components']
  //   productPartNumbers: string[]
  //   productSerialNumbers: string[]
  // }
  // Инициализация результата
  const tsp: Tsp = {
    id: sp.id,
    snProduct: sp.snProduct,
    information: {
      SN: sp.snProduct,
      'Артикул изделия': sp.specification.productMP,
      'Наименование изделия': sp.specification.productName,
      'Тип изделия': sp.specification.type as Information['Тип изделия']
    },
    specification,
    test: sp.specification.test,
    template: sp.specification.template,
    checkList: sp.specification.checkList,
    operation: Object.entries(sp.specification.operation)
      .filter(([key]) => order.includes(key))
      .sort(([keyA], [keyB]) => order.indexOf(keyA) - order.indexOf(keyB))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
    productionOperations: sp.productionOperations,
    components: sp.components,
    productPartNumbers: [],
    productSerialNumbers: []
  }

  // Трансформация спецификации
  const transformObject = async () => {
    const result: typeof specification = {}

    for (const [key, value] of Object.entries(specification)) {
      if (value.PN) {
        const { data } = await fetchPNComponent(value.PN)
        if (data?.descriptionRU) {
          result[data.descriptionRU] = value
          tsp.productPartNumbers.push(value.PN)

          const component = tsp.components.find((e) => e.pnComponentId === value.PN)
          value.SN = component?.snComponent ?? ''
          if (component?.snComponent) {
            tsp.productSerialNumbers.push(component.snComponent)
          }
        }
      }
    }

    return result
  }

  tsp.specification = await transformObject()

  return tsp
}

export type TransformSpecification = Awaited<ReturnType<typeof transformSpecification>>
