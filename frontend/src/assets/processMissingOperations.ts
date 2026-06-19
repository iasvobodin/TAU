import {
  createProductionOperationPassed,
  updateProductionOperation
} from '@/api/productionOperationServices'
import type { ProductAllPayload } from './interfaces'
import { deleteProduct } from '@/api/productServices'
import type { Prisma } from '../../../shared/src'

const REQUIRED_STAGES = ['marking', 'assembly', 'functionalTest', 'package'] as const
const ALLOWED_TYPES = ['Controller', 'PowerSupply', 'Modules', 'PAZ', 'TerminalBlocks'] as const
const PRODUCTION_STAGES = ['marking', 'assembly'] as const
const CONTROL_STAGES = ['functionalTest'] as const
const ALLOWED_CONTROL_USERS = ['Орешин А.А.', 'Барнич Н.А.', 'Свободин И.А.'] as const
const FIX_YEARS = [2024, 2026] as const

type StageType = (typeof REQUIRED_STAGES)[number]
type AllowedType = (typeof ALLOWED_TYPES)[number]

interface StageReplacement {
  stageType: string
  ifUser: string
  replaceWith: string
}

// Правила замены по году: какой пользователь на каком этапе должен быть заменён и на кого
const YEAR_STAGE_RULES: Record<number, StageReplacement[]> = {
  2024: [],
  2026: [
    { stageType: 'assembly', ifUser: 'Орешин А.А.', replaceWith: 'Свободин И.А.' },
    { stageType: 'functionalTest', ifUser: 'Орешин А.А.', replaceWith: 'Барнич Н.А.' }
  ]
}

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

interface ConflictingUser {
  user: string
  productionStages: string[]
  controlStages: string[]
}

interface ProductWithUserConflict {
  id: number
  snProduct: string
  type: string
  conflicts: ConflictingUser[]
}

// Операция с уже вычисленной заменой
interface OpToFix {
  opId: number
  stageType: string
  fromUser: string
  toUser: string
}

// ─── Missing operations ────────────────────────────────────────────────────────

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

// ─── User conflicts ────────────────────────────────────────────────────────────

/**
 * Получить год продукта по последней производственной операции
 */
function getProductYear(product: ProductAllPayload): number | null {
  const productionOps = product.productionOperations.filter((op) =>
    (PRODUCTION_STAGES as readonly string[]).includes(op.stageType)
  )
  const lastOp = [...productionOps].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0]
  return lastOp ? new Date(lastOp.date).getFullYear() : null
}

/**
 * Вычислить все операции требующие замены для конкретного продукта.
 * Возвращает список { opId, stageType, fromUser, toUser }.
 */
function resolveOpsToFix(product: ProductAllPayload): OpToFix[] {
  const year = getProductYear(product)

  if (year === null || !(FIX_YEARS as readonly number[]).includes(year)) {
    return []
  }

  const result: OpToFix[] = []
  const productionUsers = new Set(
    product.productionOperations
      .filter((op) => (PRODUCTION_STAGES as readonly string[]).includes(op.stageType))
      .map((op) => op.user)
  )

  const yearRules = YEAR_STAGE_RULES[year] ?? []

  for (const op of product.productionOperations) {
    if (op.status !== 'passed') continue

    // ── Правило 1: YEAR_STAGE_RULES — приоритет выше ──
    const rule = yearRules.find((r) => r.stageType === op.stageType && r.ifUser === op.user)
    if (rule) {
      result.push({
        opId: op.id,
        stageType: op.stageType,
        fromUser: op.user,
        toUser: rule.replaceWith
      })
      continue
    }

    // ── Правило 2: конфликт "один человек и производство и контроль" ──
    if ((CONTROL_STAGES as readonly string[]).includes(op.stageType)) {
      const isConflict = productionUsers.has(op.user)

      if (isConflict) {
        const toUser = resolveReplacementForConflict(product, productionUsers, year)
        if (toUser) {
          result.push({ opId: op.id, stageType: op.stageType, fromUser: op.user, toUser })
        } else {
          console.warn(
            `⚠️  ${product.snProduct} (${year}): конфликт на "${op.stageType}" для "${op.user}" — замена невозможна`
          )
        }
      }
    }
  }

  return result
}

/**
 * Подобрать замену для конфликта "производство + контроль один человек"
 * с учётом года и пары Мастриков/Свободин
 */
function resolveReplacementForConflict(
  product: ProductAllPayload,
  productionUsers: Set<string>,
  year: number
): string | null {
  // 2024 и 2026: только пара Мастриков ↔ Свободин
  if (year === 2024 || year === 2026) {
    if (productionUsers.has('Свободин И.А.') && !productionUsers.has('Мастриков А.С.')) {
      return 'Мастриков А.С.'
    }
    if (productionUsers.has('Мастриков А.С.') && !productionUsers.has('Свободин И.А.')) {
      return 'Свободин И.А.'
    }
    if (productionUsers.has('Свободин И.А.') && productionUsers.has('Мастриков А.С.')) {
      return null
    }
    return 'Свободин И.А.'
  }

  // Общий случай: приоритет Барнич → Орешин → Свободин
  const prioritized = ['Барнич Н.А.', 'Орешин А.А.', 'Свободин И.А.'] as const
  return prioritized.find((u) => !productionUsers.has(u)) ?? null
}

function findProductsWithUserConflicts(products: ProductAllPayload[]): ProductWithUserConflict[] {
  const result: ProductWithUserConflict[] = []

  for (const product of products) {
    if (!product.productionOperations?.length) continue

    const year = getProductYear(product)
    if (year === null || !(FIX_YEARS as readonly number[]).includes(year)) continue

    const byUser = new Map<string, string[]>()

    for (const op of product.productionOperations) {
      if (op.status !== 'passed') continue
      if (!op.user) continue
      if (!byUser.has(op.user)) byUser.set(op.user, [])
      byUser.get(op.user)!.push(op.stageType)
    }

    const conflicts: ConflictingUser[] = []

    // Конфликт 1: один человек и на производстве и на контроле
    for (const [user, stages] of byUser.entries()) {
      const productionStages = stages.filter((s) =>
        (PRODUCTION_STAGES as readonly string[]).includes(s)
      )
      const controlStages = stages.filter((s) => (CONTROL_STAGES as readonly string[]).includes(s))
      if (productionStages.length > 0 && controlStages.length > 0) {
        conflicts.push({ user, productionStages, controlStages })
      }
    }

    // Конфликт 2: нарушение правил YEAR_STAGE_RULES
    const yearRules = YEAR_STAGE_RULES[year!] ?? []
    for (const rule of yearRules) {
      const violatingOps = product.productionOperations.filter(
        (op) => op.stageType === rule.stageType && op.user === rule.ifUser && op.status === 'passed'
      )
      if (violatingOps.length > 0) {
        const existing = conflicts.find((c) => c.user === rule.ifUser)
        if (existing) {
          if (
            !existing.productionStages.includes(rule.stageType) &&
            !existing.controlStages.includes(rule.stageType)
          ) {
            existing.productionStages.push(rule.stageType)
          }
        } else {
          conflicts.push({
            user: rule.ifUser,
            productionStages: [rule.stageType],
            controlStages: []
          })
        }
      }
    }

    if (conflicts.length > 0) {
      result.push({
        id: product.id,
        snProduct: product.snProduct,
        type: product.specification?.type ?? 'Unknown',
        conflicts
      })
    }
  }

  return result
}

async function fixUserConflicts(
  conflicts: ProductWithUserConflict[],
  products: ProductAllPayload[],
  dryRun: boolean
) {
  const allPromises: Promise<void>[] = []

  for (const conflictProduct of conflicts) {
    const full = products.find((p) => p.id === conflictProduct.id)!
    const opsToFix = resolveOpsToFix(full)

    if (opsToFix.length === 0) {
      console.warn(`⚠️  ${conflictProduct.snProduct}: нечего исправлять — замены не найдены`)
      continue
    }

    for (const fix of opsToFix) {
      if (dryRun) {
        console.log(
          `📋 [dry-run] ${conflictProduct.snProduct} | ${fix.stageType}: "${fix.fromUser}" → "${fix.toUser}"`
        )
        continue
      }

      const data: Prisma.ProductionOperationUncheckedUpdateInput = { user: fix.toUser }

      const promise = updateProductionOperation(fix.opId, data)
        .then(() => {
          console.log(
            `✅ ${conflictProduct.snProduct} | ${fix.stageType}: "${fix.fromUser}" → "${fix.toUser}"`
          )
        })
        .catch((error) => {
          console.error(
            `❌ ${conflictProduct.snProduct} | ${fix.stageType}: ошибка при обновлении`,
            error
          )
        })

      allPromises.push(promise)
    }
  }

  await Promise.all(allPromises)
}

export async function auditAndFixUserConflicts(
  products: ProductAllPayload[],
  dryRun = false
): Promise<ProductWithUserConflict[]> {
  const conflicts = findProductsWithUserConflicts(products)

  if (conflicts.length === 0) {
    console.log('✅ Нарушений не найдено. Все продукты прошли контроль другим сотрудником.')
    return []
  }

  console.log(
    `\n⚠️  Найдено ${conflicts.length} продукт(ов) с нарушением разделения ответственности:\n`
  )

  for (const product of conflicts) {
    console.log(`📦 ${product.snProduct} (${product.type}):`)
    for (const conflict of product.conflicts) {
      console.log(
        `   👤 ${conflict.user}` +
          `  этапы: [${[...conflict.productionStages, ...conflict.controlStages].join(', ')}]`
      )
    }
  }

  if (dryRun) {
    console.log('\n🚫 Режим dry-run. Изменения не будут применены:\n')
  } else {
    console.log('\n🔧 Применяем исправления:\n')
  }

  await fixUserConflicts(conflicts, products, dryRun)

  return conflicts
}
