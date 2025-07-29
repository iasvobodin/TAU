import { createProductionOperationPassed } from '@/api/productionOperationServices'
import type { ProductAllPayload } from './interfaces'
import { deleteProduct } from '@/api/productServices'

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
 * Найти продукты, у которых отсутствуют операции
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
 * Создание недостающих операций
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
    const usedComponents = lastOp?.usedComponents ?? ''

    for (const stageType of product.missingStages) {
      const payload = {
        stageType,
        status: 'passed',
        user,
        date,
        productId: product.snProduct,
        usedComponents
      }

      // Проверка обязательных полей
      if (
        !payload.stageType ||
        !payload.productId ||
        !payload.status ||
        !payload.user ||
        !payload.usedComponents ||
        !payload.date
      ) {
        console.error(
          `❌ Пропущено создание: недостаточно данных для ${product.snProduct} (${stageType})`,
          payload
        )
        continue
      }

      const promise = createProductionOperationPassed(payload)
        .then(() => {
          console.log(`✅ Создана операция "${stageType}" для ${product.snProduct} (дата: ${date})`)
        })
        .catch((error) => {
          console.error(`❌ Ошибка при создании "${stageType}" для ${product.snProduct}:`, error)
        })

      allPromises.push(promise)
    }
  }

  await Promise.all(allPromises)
}

/**
 * Основная функция
 */
export async function processMissingOperations(products: ProductAllPayload[], dryRun = false) {
  const emptyProducts: ProductAllPayload[] = products.filter(
    (p) => !p.productionOperations?.length && !p.components?.length
  )

  const validProducts = products.filter((p) => !emptyProducts.includes(p))

  if (emptyProducts.length > 0) {
    console.log('\n⚠️ Найдены пустые продукты (будут пропущены):')
    for (const p of emptyProducts) {
      console.log(`- ID: ${p.id}, SN: ${p.snProduct}`)
      try {
        deleteProduct(p.id)
      } catch (error) {
        console.log(error)
      }
    }
  }

  const filtered = findProductsWithMissingOperations(validProducts)

  if (filtered.length === 0) {
    console.log('✅ Все оставшиеся продукты содержат необходимые операции.')
    return
  }

  // Отчёт по неполным
  console.log(`\n📝 Найдено ${filtered.length} продукт(ов) с отсутствующими этапами:`)
  for (const p of filtered) {
    console.log(`- ${p.snProduct} (${p.type}): нет [${p.missingStages.join(', ')}]`)
  }

  const enriched: EnrichedProduct[] = filtered.map((p) => {
    const full = validProducts.find((prod) => prod.id === p.id)!
    return {
      ...p,
      components: full.components ?? [],
      productionOperations: full.productionOperations ?? []
    }
  })

  if (dryRun) {
    console.log('\n🚫 Режим dry-run включён. Никакие операции не будут созданы.')
    for (const product of enriched) {
      const lastOp = [...product.productionOperations].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      )[0]

      const user = lastOp?.user ?? 'Системный пользователь'
      const date = lastOp?.date ?? new Date().toISOString()
      const usedComponents = lastOp?.usedComponents ?? ''

      for (const stageType of product.missingStages) {
        console.log(`📦 Будет создана операция:
  Продукт: ${product.snProduct}
  Этап: ${stageType}
  Пользователь: ${user}
  Дата: ${date}
  Комплектующие: ${usedComponents}
        `)
      }
    }

    return
  }

  await createMissingOperations(enriched)
}
