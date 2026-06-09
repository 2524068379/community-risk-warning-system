import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getApiBase: () => ipcRenderer.invoke('get-api-base'),
  getApiAuthHeaders: () => ipcRenderer.invoke('get-api-auth-headers'),
  getOllamaStatus: () => ipcRenderer.invoke('get-ollama-status')
})
