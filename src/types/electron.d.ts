interface Window {
  electronAPI?: {
    getApiBase: () => Promise<string | undefined>
    getOllamaStatus: () => Promise<{ ready: boolean; status: string; baseUrl: string; gpu: 'unknown' }>
  }
}
