import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import fs from 'node:fs'
import crypto from 'node:crypto'
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
import {
  assertTrustedIpcSender,
  isAllowedVideoPermissionCheck,
  isAllowedVideoPermissionRequest,
  isTrustedMainFrameNavigation,
  isTrustedRendererUrl
} from './security.js'

const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath()

const envPath = path.resolve(baseDir, '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false })
}

const managedVlmPort = crypto.randomInt(20_000, 60_000)
const managedVlmApiKey = crypto.randomBytes(32).toString('hex')
process.env.VLM_PORT = String(managedVlmPort)
process.env.VLM_API_KEY = managedVlmApiKey

const localProxyToken = crypto.randomBytes(32).toString('hex')
const proxyConfig = {
  ...loadQwenProxyConfig(),
  host: '127.0.0.1',
  allowLocalFileOrigins: true,
  localProxyToken,
  isLocalVlmTrusted: () => isOllamaReady()
}
const server = createQwenProxyApp(proxyConfig)

let apiPort = 0
let resolveApiBase!: (apiBase: string) => void
let rejectApiBase!: (error: Error) => void
const apiBaseReady = new Promise<string>((resolve, reject) => {
  resolveApiBase = resolve
  rejectApiBase = reject
})
apiBaseReady.catch((error) => {
  console.error('[proxy] Failed to start local proxy:', error)
})
const httpServer = server.listen(0, proxyConfig.host, () => {
  const addr = httpServer.address()
  if (addr && typeof addr === 'object') {
    apiPort = addr.port
    const apiBase = `http://${proxyConfig.host}:${apiPort}`
    console.log(`Qwen proxy server is running at ${apiBase}`)
    resolveApiBase(apiBase)
    return
  }
  rejectApiBase(new Error('Qwen proxy server did not expose a TCP address'))
})

httpServer.on('error', (error) => {
  rejectApiBase(error)
})

// 设置 5 分钟超时，防止慢客户端无限占用连接
httpServer.timeout = 300_000

let mainWindow: BrowserWindow | null = null
let trustedRendererUrl: string | null = null

function assertTrustedRendererIpc(event: Electron.IpcMainInvokeEvent): void {
  assertTrustedIpcSender(event, mainWindow?.webContents ?? null, trustedRendererUrl)
}

ipcMain.handle('get-api-base', async (event) => {
  assertTrustedRendererIpc(event)
  return apiBaseReady
})

ipcMain.handle('get-api-auth-headers', (event) => {
  assertTrustedRendererIpc(event)
  return {
    'X-Local-Proxy-Token': localProxyToken
  }
})

ipcMain.handle('get-ollama-status', async (event) => {
  assertTrustedRendererIpc(event)
  await refreshOllamaStatus()

  return {
    ready: isOllamaReady(),
    status: getOllamaRuntimeStatus(),
    baseUrl: getOllamaBaseUrl(),
    gpu: isGpuAvailable()
  }
})

function configureWindowSecurity(window: BrowserWindow, rendererUrl: string): void {
  const { webContents } = window

  webContents.on('will-navigate', (event) => {
    if (!isTrustedRendererUrl(event.url, rendererUrl)) {
      event.preventDefault()
    }
  })

  webContents.on('will-frame-navigate', (event) => {
    if (!isTrustedMainFrameNavigation(event.url, event.isMainFrame, rendererUrl)) {
      event.preventDefault()
    }
  })

  webContents.on('will-redirect', (event, url) => {
    if (!isTrustedRendererUrl(url, rendererUrl)) {
      event.preventDefault()
    }
  })

  webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  const rendererSession = webContents.session
  rendererSession.setPermissionCheckHandler((requestingContents, permission, _origin, details) => {
    if (
      requestingContents !== webContents
      || webContents.isDestroyed()
      || !isTrustedRendererUrl(webContents.getURL(), rendererUrl)
    ) {
      return false
    }

    return isAllowedVideoPermissionCheck(permission, details, rendererUrl)
  })

  rendererSession.setPermissionRequestHandler((requestingContents, permission, callback, details) => {
    const allowed = requestingContents === webContents
      && !webContents.isDestroyed()
      && isTrustedRendererUrl(webContents.getURL(), rendererUrl)
      && isAllowedVideoPermissionRequest(permission, details, rendererUrl)

    callback(allowed)
  })
}

function createWindow(): void {
  const rendererEntryPath = path.join(__dirname, '../renderer/index.html')
  const developmentRendererUrl = is.dev ? process.env['ELECTRON_RENDERER_URL'] : undefined
  const rendererUrl = developmentRendererUrl || pathToFileURL(rendererEntryPath).href

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

  trustedRendererUrl = rendererUrl
  configureWindowSecurity(mainWindow, rendererUrl)

  if (developmentRendererUrl) {
    mainWindow.loadURL(developmentRendererUrl)
  } else {
    mainWindow.loadFile(rendererEntryPath)
  }
}

app.on('ready', async () => {
  await apiBaseReady
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
