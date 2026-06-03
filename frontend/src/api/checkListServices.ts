import type { Prisma, CheckList } from '../../../shared/src'
import { get, post, del, put, type ApiResponse } from './apiService'

const API_URL = import.meta.env.VITE_API_URL

// export const fetchCheckList = async (): Promise<ApiResponse<CheckList>> => {
//   return get<CheckList>(`${API_URL}/checkList`)
// }

export const createCheckList = async (
  checkList: Prisma.CheckListUncheckedCreateInput
): Promise<ApiResponse<CheckList>> => {
  return post<CheckList>(`${API_URL}/check-list`, checkList)
}

export const fetchCheckList = async (productMP: string): Promise<ApiResponse<CheckList>> => {
  return get<CheckList>(`${API_URL}/check-list/${productMP}`)
}

export const updateCheckList = async (
  productMP: string,
  data: Prisma.CheckListUncheckedUpdateInput
): Promise<ApiResponse<CheckList>> => {
  return put<CheckList>(`${API_URL}/check-list/${productMP}`, data)
}
