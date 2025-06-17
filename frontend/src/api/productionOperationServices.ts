import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, ProductionOperation } from '../../../shared/src'
const API_URL = import.meta.env.VITE_API_URL

export const createProductionOperationFailed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    `${API_URL}/production-operations-failed`,
    data
  )
}

export const createProductionOperationPassed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    `${API_URL}/production-operations-passed`,
    data
  )
}

export const deleteProductionOperation = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`${API_URL}/production-operations/${id}`)
}

export const fetchProductionOperationByProductSN = async (
  productSN: string
): Promise<ApiResponse<ProductionOperation[]>> => {
  return get<ProductionOperation[]>(`${API_URL}/production-operations/productSN/${productSN}`)
}

export const fetchFailedProductionOperations = async (): Promise<
  ApiResponse<ProductionOperation[]>
> => {
  return get<ProductionOperation[]>(`${API_URL}/failed-production-operations`)
}

export const updateProductionOperation = async (
  id: number,
  data: Prisma.ProductionOperationUncheckedUpdateInput
): Promise<ApiResponse<ProductionOperation>> => {
  return put<ProductionOperation>(`${API_URL}/production-operations/${id}`, data)
}
