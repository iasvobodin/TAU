import type { Prisma, DefectHistory } from '../../../shared/src'
// import type { ProductAllPayload } from '@/assets/interfaces'
import { get, post, del, type ApiResponse } from './apiService'
import type { DefectHistoryWithTypedAction } from '@/assets/interfaces'

const API_URL = import.meta.env.VITE_API_URL

export const createDefectHistory = async (
  data: Prisma.DefectHistoryUncheckedCreateInput
): Promise<ApiResponse<Prisma.DefectHistoryUncheckedCreateInput>> => {
  return post<Prisma.DefectHistoryUncheckedCreateInput>(`${API_URL}/defect-history`, data)
}

export const fetchDefectHistory = async (): Promise<ApiResponse<DefectHistory[]>> => {
  return get<DefectHistory[]>(`${API_URL}/defect-history`)
}
export const fetchDefectHistoryAll = async (): Promise<
  ApiResponse<DefectHistoryWithTypedAction[]>
> => {
  return get<DefectHistoryWithTypedAction[]>(`${API_URL}/defect-history-all`)
}

// export const fetchProduct = async (productSN: string): Promise<ApiResponse<ProductAllPayload>> => {
//   return get<ProductAllPayload>(`${API_URL}/products/${productSN}`)
// }

// export const fetchProductByOrderToProduction = async (
//   orderToProduction: string
// ): Promise<ApiResponse<ProductAllPayload>> => {
//   return get<ProductAllPayload>(`${API_URL}/products/orderToProduction/${orderToProduction}`)
// }

export const deleteDefectHistory = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`${API_URL}/defect-history-del/${id}`)
}
