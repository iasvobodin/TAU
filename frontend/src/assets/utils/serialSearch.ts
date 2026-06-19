// serialSearch.ts
import { fetchProduct } from '@/api/productServices'
import type { ProductAllPayload } from '@/assets/interfaces'
import { type ApiResponse } from '../../api/apiService'
const ModuleType = {
  Controller: 1,
  PowerSupply: 2,
  Modules: 3,
  PAZ: 4,
  TerminalBlocks: 5,
  SupportPanels: 6,
  Defective: 7
} as const

export async function findProductBySmartSearch(
  searchQuery: string,
  prefix: string = 'TAU'
): Promise<ApiResponse<ProductAllPayload> | null> {
  // 1. Разбиваем поисковый запрос на логические части
  const year = searchQuery.substring(0, 2) // "26"
  const week = searchQuery.substring(2, 4) // "21"
  const orderNumber = searchQuery.substring(4) // "00382"

  const types = Object.values(ModuleType)

  // 2. Последовательно перебираем все типы модулей
  for (const type of types) {
    // Собираем модифицированный серийник (дополняя номер до 6 знаков нулями)
    const numericPart = `${week}${year}${type}${orderNumber.padStart(6, '0')}`
    const generatedSerial = `${prefix}${numericPart}`

    try {
      // Делаем запрос к твоему API
      const response = await fetchProduct(generatedSerial)

      // Проверяем, успешен ли ответ.
      if (response && response.data) {
        return response // Продукт найден! Возвращаем весь ApiResponse и выходим из цикла
      }
    } catch (error) {
      console.warn(`Серийный номер ${generatedSerial} не найден, проверяем следующий тип...`)
    }
  }

  // 3. Если за 7 итераций бэкенд ничего не вернул
  return null
}
