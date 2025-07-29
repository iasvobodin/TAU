import type { Prisma, Product } from '../../../shared/src'
import type { ProductAllPayload } from '@/assets/interfaces'
import { get, post, put, del, type ApiResponse } from './apiService'
const API_URL = import.meta.env.VITE_API_URL

type p = {
  snProduct: string
}[]

export const fetchProductLastSN = async (): Promise<ApiResponse<p>> => {
  return get<p>(`${API_URL}/productlastsn`)
}

export const createProduct = async (
  product: Prisma.ProductUncheckedCreateInput
): Promise<ApiResponse<Product>> => {
  return post<Product>(`${API_URL}/products`, product)
}

export const fetchProduct = async (productSN: string): Promise<ApiResponse<ProductAllPayload>> => {
  return get<ProductAllPayload>(`${API_URL}/products/${productSN}`)
}

export const fetchProductByOrderToProduction = async (
  orderToProduction: string
): Promise<ApiResponse<ProductAllPayload[]>> => {
  return get<ProductAllPayload[]>(`${API_URL}/products/orderToProduction/${orderToProduction}`)
}

export const fetchAllProduct = async (): Promise<ApiResponse<ProductAllPayload[]>> => {
  return get<ProductAllPayload[]>(`${API_URL}/products`)
}

export const updateProduct = async (
  snProduct: string,
  data: Prisma.ProductUncheckedUpdateInput
): Promise<ApiResponse<Product>> => {
  return put<Product>(`${API_URL}/products/${snProduct}`, data)
}
export const deleteProduct = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`${API_URL}/products/${id}`)
}
