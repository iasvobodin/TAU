import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, Component, Product } from '../../../extensions/src'

export const createComponent = async (
  component: Prisma.ComponentUncheckedCreateInput
): Promise<ApiResponse<Component>> => {
  return post<Component>('http://10.69.19.59:3000/components', component)
}

export const createComponents = async (
  components: Prisma.ComponentUncheckedCreateInput[]
): Promise<ApiResponse<Prisma.ComponentUncheckedCreateInput>[]> => {
  const promises = components.map((component) => createComponent(component))
  return Promise.all(promises)
}

export const fetchComponent = async (snComponent: string): Promise<ApiResponse<Component>> => {
  return get<Component>(`http://10.69.19.59:3000/components/${snComponent}`)
}

export const updateComponent = async (
  snComponent: string,
  data: Prisma.ComponentUncheckedUpdateInput
): Promise<ApiResponse<Component>> => {
  return put<Component>(`http://10.69.19.59:3000/components/${snComponent}`, data)
}
