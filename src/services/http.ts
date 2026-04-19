import axios from 'axios'

declare global {
  interface Window {
    electronAPI?: {
      getApiBase: () => Promise<string>
    }
  }
}

let apiBase: string | undefined = import.meta.env.VITE_API_BASE_URL || undefined

if (window.electronAPI) {
  window.electronAPI.getApiBase().then((base: string) => {
    apiBase = base
  })
}

export const http = axios.create({
  timeout: 15000
})

http.interceptors.request.use((config) => {
  if (apiBase) {
    config.baseURL = apiBase
  }
  return config
})
