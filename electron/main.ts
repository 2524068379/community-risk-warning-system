import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { createQwenProxyApp, loadQwenProxyConfig } from '../server/qwenProxy.js'
import { startOllama, stopOllama, isOllamaReady, getOllamaBaseUrl, isGpuAvailable } from './ollamaManager.js'

const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()

const envServerPath = path.resolve(baseDir, '.env.server')
if (fs.existsSync(envServerPath)) {
  dotenv.config({ path: envServerPath, override: false })
}

if (!app.isPackaged) {
  const envPath = path.resolve(baseDir, '.env')
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const server = createQwenProxyApp(loadQwenProxyConfig())

let apiPort = 0
const httpServer = server.listen(0, () => {
  const addr = httpServer.address()
  if (addr && typeof addr === 'object') {
    apiPort = addr.port
  }
  console.log(`Qwen proxy server is running at http://localhost:${apiPort}`)
})

ipcMain.handle('get-api-base', () => {
  return `http://localhost:${apiPort}`
})

ipcMain.handle('get-ollama-status', () => ({
  ready: isOllamaReady(),
  baseUrl: getOllamaBaseUrl(),
  gpu: isGpuAvailable()
}))

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: '险封·社区风险预警平台',
    icon: path.join(__dirname, '../renderer/public/shield.svg'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.on('ready', async () => {
  createWindow()
  await startOllama()
})

app.on('window-all-closed', async () => {
  await stopOllama()
  httpServer.close()
  app.quit()
})
