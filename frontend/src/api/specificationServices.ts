import type { Prisma, Specification, Product } from '../../../extensions/src'

import { get, post, del, type ApiResponse } from './apiService'

export const fetchSpecification = async (
  productMP: string
): Promise<ApiResponse<Specification>> => {
  return get<Specification>(`http://10.69.19.59:3000/specifications/${productMP}`)
}

export const fetchSpecifications = async (): Promise<ApiResponse<Specification[]>> => {
  return get<Specification[]>(`http://10.69.19.59:3000/specifications`)
}
