import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getApiBase: () => ipcRenderer.invoke('get-api-base')
})
