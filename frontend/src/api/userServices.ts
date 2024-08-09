import { get, post, put, patch, del, type ApiResponse } from './apiService'
import type { Prisma, User, Product } from '../../../extensions/src'
// export interface User {
//   id: number
//   Login: string
//   Name: string
// }

export const getUser = async (Login: string): Promise<ApiResponse<User>> => {
  return get<User>(`http://localhost:3000/users/${Login}`)
}

export const getUsers = async (): Promise<ApiResponse<User[]>> => {
  return get<User[]>(`http://localhost:3000/users`)
}

export const createUser = async (
  user: Partial<Prisma.UserCreateInput>
): Promise<ApiResponse<Prisma.UserCreateInput>> => {
  return post<Prisma.UserCreateInput>('http://localhost:3000/users', user)
}

export const updateUser = async (id: number, user: Partial<User>): Promise<ApiResponse<User>> => {
  return put<User>(`https://api.example.com/users/${id}`, user)
}

export const partialUpdateUser = async (
  id: number,
  user: Partial<User>
): Promise<ApiResponse<User>> => {
  return patch<User>(`https://api.example.com/users/${id}`, user)
}

export const deleteUser = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`https://api.example.com/users/${id}`)
}
