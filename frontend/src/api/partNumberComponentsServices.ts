import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, PartNumberComponent } from '../../../extensions/src'

export const fetchPNComponent = async (
  partNumber: string
): Promise<ApiResponse<PartNumberComponent>> => {
  return get<PartNumberComponent>(`http://localhost:3000/part-number-components/${partNumber}`)
}

export const getPNComponents = async (): Promise<ApiResponse<PartNumberComponent[]>> => {
  return get<PartNumberComponent[]>(`http://localhost:3000/part-number-components`)
}
