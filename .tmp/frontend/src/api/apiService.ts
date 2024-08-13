import { useErrorStore } from '@/stores/errorStore'

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const erJSon = await response.json()
    // const errorText = await response.text();
    console.log(erJSon)

    throw new Error(`Error! status: ${response.status}, message: ${JSON.stringify(erJSon)}`)
  }
  return response.json()
}

export const fetchData = async <T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const errorStore = useErrorStore()
  try {
    const response = await fetch(url, options)
    const result = await handleResponse<T>(response)
    return { data: result, error: null }
  } catch (err) {
    const errorMessage = (err as Error).message
    errorStore.addError(errorMessage)
    setTimeout(errorStore.removeError, 5000)
    return { data: null, error: errorMessage }
  }
}

export const get = async <T>(url: string): Promise<ApiResponse<T>> => {
  return fetchData<T>(url)
}

export const post = async <T>(url: string, body: any): Promise<ApiResponse<T>> => {
  return fetchData<T>(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export const put = async <T>(url: string, body: any): Promise<ApiResponse<T>> => {
  return fetchData<T>(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export const patch = async <T>(url: string, body: any): Promise<ApiResponse<T>> => {
  return fetchData<T>(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
}

export const del = async <T>(url: string): Promise<ApiResponse<T>> => {
  return fetchData<T>(url, { method: 'DELETE' })
}
