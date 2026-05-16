import axios from 'axios'

interface ElectronApi {
  getApiBase: () => Promise<string | undefined>
  getOllamaStatus: () => Promise<{ ready: boolean; status: string; baseUrl: string; gpu: 'unknown' }>
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

function normalizeApiBase(base?: string): string | undefined {
  if (!base) return undefined

  try {
    const url = new URL(base)
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.port !== '0') {
      return base
    }
  } catch {
    return undefined
  }

  return undefined
}

export function createApiBaseResolver(options: ApiBaseResolverOptions) {
  let cachedBase = normalizeApiBase(options.envBase)
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
        cachedBase = normalizeApiBase(base)
        return cachedBase
      }).finally(() => {
        pendingBase = undefined
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
  timeout: 120000
})

http.interceptors.request.use(async (config) => {
  const apiBase = await apiBaseResolver.getApiBase()

  if (apiBase) {
    config.baseURL = apiBase
  }

  return config
})
