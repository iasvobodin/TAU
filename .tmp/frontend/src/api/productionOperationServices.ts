import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, ProductionOperation } from '../../../extensions/src'

export const createProductionOperationFailed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    'http://localhost:3000/production-operations-failed',
    data
  )
}

export const createProductionOperationPassed = async (
  data: Prisma.ProductionOperationUncheckedCreateInput
): Promise<ApiResponse<Prisma.ProductionOperationUncheckedCreateInput>> => {
  return post<Prisma.ProductionOperationUncheckedCreateInput>(
    'http://localhost:3000/production-operations-passed',
    data
  )
}

export const deleteProductionOperation = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`http://localhost:3000/production-operations/${id}`)
}
