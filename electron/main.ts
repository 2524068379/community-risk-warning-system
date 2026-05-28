import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import fs from 'node:fs'
import dotenv from 'dotenv'
import { createQwenProxyApp, loadQwenProxyConfig } from '../server/qwenProxy.js'
import {
  startOllama,
  stopOllama,
  isOllamaReady,
  getOllamaBaseUrl,
  getOllamaRuntimeStatus,
  isGpuAvailable,
  refreshOllamaStatus
} from './ollamaManager.js'

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

const proxyConfig = {
  ...loadQwenProxyConfig(),
  host: '127.0.0.1',
  allowLocalFileOrigins: true
}
const server = createQwenProxyApp(proxyConfig)

let apiPort = 0
const httpServer = server.listen(0, proxyConfig.host, () => {
  const addr = httpServer.address()
  if (addr && typeof addr === 'object') {
    apiPort = addr.port
  }
  console.log(`Qwen proxy server is running at http://${proxyConfig.host}:${apiPort}`)
})

// 设置 5 分钟超时，防止慢客户端无限占用连接
httpServer.timeout = 300_000

ipcMain.handle('get-api-base', () => {
  return `http://${proxyConfig.host}:${apiPort}`
})

ipcMain.handle('get-ollama-status', async () => {
  await refreshOllamaStatus()

  return {
    ready: isOllamaReady(),
    status: getOllamaRuntimeStatus(),
    baseUrl: getOllamaBaseUrl(),
    gpu: isGpuAvailable()
  }
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    title: '险封·社区风险预警平台',
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

  // 等待 in-flight 请求完成，最多 5 秒
  await new Promise<void>((resolve) => {
    const forceExit = setTimeout(() => resolve(), 5000)
    forceExit.unref()
    httpServer.close(() => {
      clearTimeout(forceExit)
      resolve()
    })
  })

  app.quit()
})
