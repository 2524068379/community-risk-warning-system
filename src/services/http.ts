import axios from 'axios'

interface ElectronApi {
  getApiBase: () => Promise<string>
  getOllamaStatus: () => Promise<{ ready: boolean; baseUrl: string; gpu: boolean }>
}

declare global {
  interface Window {
    electronAPI?: ElectronApi
  }
}

interface ApiBaseResolverOptions {
  envBase?: string
  electronApi?: ElectronApi
}

export function createApiBaseResolver(options: ApiBaseResolverOptions) {
  let cachedBase = options.envBase || undefined
  let pendingBase: Promise<string | undefined> | undefined

  return {
    async getApiBase() {
      if (cachedBase) {
        return cachedBase
      }

      if (!options.electronApi) {
        return undefined
      }

      pendingBase ??= options.electronApi.getApiBase().then((base) => {
        cachedBase = base || undefined
        return cachedBase
      })

      return pendingBase
    }
  }
}

const apiBaseResolver = createApiBaseResolver({
  envBase: import.meta.env.VITE_API_BASE_URL || undefined,
  electronApi: typeof window === 'undefined' ? undefined : window.electronAPI
})

export const http = axios.create({
  timeout: 15000
})

http.interceptors.request.use(async (config) => {
  const apiBase = await apiBaseResolver.getApiBase()

  if (apiBase) {
    config.baseURL = apiBase
  }

  return config
})
