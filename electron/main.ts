import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import dotenv from 'dotenv'
import { createQwenProxyApp, loadQwenProxyConfig } from '../server/qwenProxy.js'

dotenv.config({ path: '.env.server', override: false })
dotenv.config({ path: '.env', override: false })

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

app.on('ready', () => {
  createWindow()
})

app.on('window-all-closed', () => {
  httpServer.close()
  app.quit()
})
