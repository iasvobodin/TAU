import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, PartNumberComponent } from '../../../extensions/src'
const API_URL = import.meta.env.VITE_API_URL

export const fetchPNComponent = async (
  partNumber: string
): Promise<ApiResponse<PartNumberComponent>> => {
  return get<PartNumberComponent>(`${API_URL}/part-number-components/${partNumber}`)
}

export const getPNComponents = async (): Promise<ApiResponse<PartNumberComponent[]>> => {
  return get<PartNumberComponent[]>(`${API_URL}/part-number-components`)
}
