import type { Prisma, Specification, Product } from '../../../extensions/src'

import { get, post, del, type ApiResponse } from './apiService'

export const fetchSpecification = async (
  productMP: string
): Promise<ApiResponse<Specification>> => {
  return get<Specification>(`http://localhost:3000/specifications/${productMP}`)
}

export const fetchSpecifications = async (): Promise<ApiResponse<Specification[]>> => {
  return get<Specification[]>(`http://localhost:3000/specifications`)
}
