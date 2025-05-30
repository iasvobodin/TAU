import type { Prisma, Specification, Product } from '../../../extensions/src'
import type { Specification as SP } from '@/assets/interfaces'
const API_URL = import.meta.env.VITE_API_URL

import { get, post, del, type ApiResponse } from './apiService'

export const fetchSpecification = async (
  productMP: string
): Promise<ApiResponse<Specification>> => {
  return get<Specification>(`${API_URL}/specifications/${productMP}`)
}

export const fetchSpecifications = async (): Promise<ApiResponse<SP[]>> => {
  return get<SP[]>(`${API_URL}/specifications`)
}
