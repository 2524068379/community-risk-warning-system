interface Window {
  electronAPI?: {
    getApiBase: () => Promise<string>
  }
}
