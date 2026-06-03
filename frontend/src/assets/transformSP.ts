// import type { ProductAllPayload, Information, Tsp } from './interfaces'
// import { fetchPNComponent } from '@/api/partNumberComponentsServices'

// export const transformSpecification = async (sp: ProductAllPayload) => {
//   const order = ['marking', 'assembly', 'functionalTest', 'package']

//   // Инициализация спецификации с типизацией
//   const specification: { [key: string]: { PN: string; SN: string } } = {
//     electronicBoard1: { PN: sp.specification.electronicBoard1, SN: '' },
//     electronicBoard2: { PN: sp.specification.electronicBoard2, SN: '' },
//     electronicBoard3: { PN: sp.specification.electronicBoard3, SN: '' },
//     electronicBoard4: { PN: sp.specification.electronicBoard4, SN: '' },
//     electronicBoard5: { PN: sp.specification.electronicBoard5, SN: '' },
//     electronicBoard6: { PN: sp.specification.electronicBoard6, SN: '' },
//     otherCirciutry: { PN: sp.specification.otherCirciutry, SN: '' },
//     enclosureType: { PN: sp.specification.enclosureType, SN: '' },
//     mountingScrew: { PN: sp.specification.mountingScrew, SN: '' }
//   }
//   // Предполагаем, что specification в ProductAllPayload полностью описывает specification
//   type Specification = ProductAllPayload['specification']

//   // Тип для преобразованного operation
//   type Operation = Partial<ProductAllPayload['specification']['operation']>

//   // Инициализация результата
//   const tsp: Tsp = {
//     id: sp.id,
//     snProduct: sp.snProduct,
//     information: {
//       SN: sp.snProduct,
//       'Артикул изделия': sp.specification.productMP,
//       'Наименование изделия': sp.specification.productName,
//       'Тип изделия': sp.specification.type as Information['Тип изделия']
//     },
//     specification,
//     test: sp.specification.test,
//     template: sp.specification.template,
//     checkList: sp.specification.checkList,
//     operation: Object.entries(sp.specification.operation)
//       .filter(([key]) => order.includes(key))
//       .sort(([keyA], [keyB]) => order.indexOf(keyA) - order.indexOf(keyB))
//       .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}),
//     productionOperations: sp.productionOperations,
//     components: sp.components,
//     productPartNumbers: [],
//     productSerialNumbers: []
//   }

//   // Трансформация спецификации
//   const transformObject = async () => {
//     const result: typeof specification = {}

//     for (const [key, value] of Object.entries(specification)) {
//       if (value.PN) {
//         const { data } = await fetchPNComponent(value.PN)
//         if (data?.descriptionRU) {
//           result[data.descriptionRU] = value
//           tsp.productPartNumbers.push(value.PN)

//           const component = tsp.components.find((e) => e.pnComponentId === value.PN)
//           value.SN = component?.snComponent ?? ''
//           if (component?.snComponent) {
//             tsp.productSerialNumbers.push(component.snComponent)
//           }
//         }
//       }
//     }

//     return result
//   }

//   tsp.specification = await transformObject()

//   return tsp
// }

// export type TransformSpecification = Awaited<ReturnType<typeof transformSpecification>>

import type { ProductAllPayload, Information, Tsp } from './interfaces'
import { fetchPNComponent } from '@/api/partNumberComponentsServices'

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

  // 1. Ищем операцию функционального теста, в которой есть заполненный чеклист
  const functionalTestOp = sp.productionOperations?.find(
    (op) => op.stageType === 'functionalTest' && op.checkList
  )

  // 2. Готовим данные чеклиста: если нашли в операциях — берем его, иначе оставляем шаблонный
  // Так как в productionOperations чеклист лежит в виде JSON-строки, а в sp.specification.checkList — это объект,
  // нам нужно привести их к единому виду (объекту), сохранив структуру метаданных (id, doc_AssebbleOK и т.д.)
  let finalCheckList = sp.specification.checkList

  if (functionalTestOp && functionalTestOp.checkList && sp.specification.checkList) {
    finalCheckList = {
      ...sp.specification.checkList,
      id: sp.specification.checkList.id!, // ! убирает undefined из типа
      productMP: sp.specification.checkList.productMP!,
      checkListTemplate: functionalTestOp.checkList
    }
  }

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
    // Используем пропатченный чеклист
    checkList: finalCheckList,
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
