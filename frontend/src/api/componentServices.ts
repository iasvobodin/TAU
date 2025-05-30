import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, Component, Product } from '../../../extensions/src'
const API_URL = import.meta.env.VITE_API_URL

export const createComponent = async (
  component: Prisma.ComponentUncheckedCreateInput
): Promise<ApiResponse<Component>> => {
  return post<Component>(`${API_URL}/components`, component)
}

export const createComponents = async (
  components: Prisma.ComponentUncheckedCreateInput[]
): Promise<ApiResponse<Prisma.ComponentUncheckedCreateInput>[]> => {
  const promises = components.map((component) => createComponent(component))
  return Promise.all(promises)
}

export const fetchComponent = async (snComponent: string): Promise<ApiResponse<Component>> => {
  return get<Component>(`${API_URL}/components/${snComponent}`)
}

export const updateComponent = async (
  snComponent: string,
  data: Prisma.ComponentUncheckedUpdateInput
): Promise<ApiResponse<Component>> => {
  return put<Component>(`${API_URL}/components/${snComponent}`, data)
}
