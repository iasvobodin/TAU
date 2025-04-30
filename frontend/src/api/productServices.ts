import type { Prisma, Product } from '../../../extensions/src'
import type { ProductAllPayload } from '@/assets/interfaces'
import { get, post, del, type ApiResponse } from './apiService'

type p = {
  snProduct: string
}[]

export const fetchProductLastSN = async (): Promise<ApiResponse<p>> => {
  return get<p>(`http://10.69.19.59:3000/productlastsn`)
}

export const createProduct = async (
  product: Prisma.ProductUncheckedCreateInput
): Promise<ApiResponse<Product>> => {
  return post<Product>('http://10.69.19.59:3000/products', product)
}

export const fetchProduct = async (productSN: string): Promise<ApiResponse<ProductAllPayload>> => {
  return get<ProductAllPayload>(`http://10.69.19.59:3000/products/${productSN}`)
}

export const fetchProductByOrderToProduction = async (
  orderToProduction: string
): Promise<ApiResponse<ProductAllPayload>> => {
  return get<ProductAllPayload>(
    `http://10.69.19.59:3000/products/orderToProduction/${orderToProduction}`
  )
}
