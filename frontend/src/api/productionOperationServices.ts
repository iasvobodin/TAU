import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, ProductionOperation } from '../../../extensions/src'

export const createProductionOperationFailed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    'http://10.69.19.59:3000/production-operations-failed',
    data
  )
}

export const createProductionOperationPassed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    'http://10.69.19.59:3000/production-operations-passed',
    data
  )
}

export const deleteProductionOperation = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`http://10.69.19.59:3000/production-operations/${id}`)
}

export const fetchProductionOperationByProductSN = async (
  productSN: string
): Promise<ApiResponse<ProductionOperation>> => {
  return get<ProductionOperation>(
    `http://10.69.19.59:3000/production-operations/productSN/${productSN}`
  )
}

export const updateProductionOperation = async (
  id: number,
  data: Prisma.ProductionOperationUncheckedUpdateInput
): Promise<ApiResponse<ProductionOperation>> => {
  return put<ProductionOperation>(`http://10.69.19.59:3000/production-operations/${id}`, data)
}
