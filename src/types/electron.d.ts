interface Window {
  electronAPI?: {
    getApiBase: () => Promise<string>
    getOllamaStatus: () => Promise<{ ready: boolean; baseUrl: string; gpu: boolean }>
  }
}
