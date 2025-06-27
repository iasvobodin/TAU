import { createProductionOperationPassed } from '@/api/productionOperationServices'
// Импортируй свои типы:
import type { ProductAllPayload } from './interfaces'

const REQUIRED_STAGES = ['marking', 'assembly', 'functionalTest', 'package'] as const
const ALLOWED_TYPES = ['Controller', 'PowerSupply', 'Modules', 'PAZ', 'TerminalBlocks'] as const

type StageType = (typeof REQUIRED_STAGES)[number]
type AllowedType = (typeof ALLOWED_TYPES)[number]

interface ProductWithMissingStages {
  id: number
  snProduct: string
  type: AllowedType
  existingStages: StageType[]
  missingStages: StageType[]
}

type EnrichedProduct = ProductWithMissingStages & {
  components: ProductAllPayload['components']
  productionOperations: ProductAllPayload['productionOperations']
}

/**
 * Фильтруем продукты с отсутствующими производственными операциями
 */
function findProductsWithMissingOperations(
  products: ProductAllPayload[]
): ProductWithMissingStages[] {
  return products
    .filter((product) => ALLOWED_TYPES.includes(product.specification?.type as AllowedType))
    .map((product) => {
      const existingStages = product.productionOperations.map((op) => op.stageType as StageType)
      const missingStages = REQUIRED_STAGES.filter((stage) => !existingStages.includes(stage))

      if (missingStages.length > 0) {
        return {
          id: product.id,
          snProduct: product.snProduct,
          type: product.specification.type as AllowedType,
          existingStages,
          missingStages
        }
      }

      return null
    })
    .filter((item): item is ProductWithMissingStages => item !== null)
}

/**
 * Создание недостающих операций (в параллель через Promise.all)
 */
async function createMissingOperations(products: EnrichedProduct[]) {
  const allPromises: Promise<void>[] = []

  for (const product of products) {
    const sortedOps = [...product.productionOperations].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    const lastOp = sortedOps[0]
    const user = lastOp?.user ?? 'Системный пользователь'
    const date = lastOp?.date ?? new Date().toISOString()
    const usedComponents = product.components?.map((c) => c.snComponent).join(', ') ?? ''

    for (const stageType of product.missingStages) {
      const productionOperationData = {
        stageType,
        status: 'passed',
        user,
        date,
        productId: product.snProduct,
        usedComponents
      }

      const promise = createProductionOperationPassed(productionOperationData)
        .then(() => {
          console.log(`✅ Операция "${stageType}" создана для продукта ${product.snProduct}`)
        })
        .catch((error) => {
          console.error(`❌ Ошибка при создании "${stageType}" для ${product.snProduct}:`, error)
          // Не выбрасываем, чтобы остальные продолжились
        })

      allPromises.push(promise)
    }
  }

  await Promise.all(allPromises)
}

/**
 * Основная функция: фильтруем → обогащаем → создаём операции
 */
export async function processMissingOperations(products: ProductAllPayload[]) {
  const filtered = findProductsWithMissingOperations(products)

  const enriched: EnrichedProduct[] = filtered.map((p) => {
    const full = products.find((prod) => prod.id === p.id)
    return {
      ...p,
      components: full?.components ?? [],
      productionOperations: full?.productionOperations ?? []
    }
  })

  await createMissingOperations(enriched)
}
