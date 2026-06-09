interface Window {
  electronAPI?: {
    getApiBase: () => Promise<string | undefined>
    getApiAuthHeaders?: () => Promise<Record<string, string> | undefined>
    getOllamaStatus: () => Promise<{ ready: boolean; status: string; baseUrl: string; gpu: 'unknown' }>
  }
}
