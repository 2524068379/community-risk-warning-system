import { app, BrowserWindow, ipcMain } from 'electron'
import { is } from '@electron-toolkit/utils'
import path from 'node:path'
import url from 'node:url'
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.server', override: false })
dotenv.config({ path: '.env', override: false })

const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173'
const qwenBaseUrl = (process.env.QWEN_BASE_URL || '').replace(/\/$/, '')
const qwenApiKey = process.env.QWEN_API_KEY || ''
const qwenModel = process.env.QWEN_MODEL || 'qwen3.5-vl'
const qwenTimeout = Number(process.env.QWEN_TIMEOUT || 60000)

const server = express()
server.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(item => item.trim()),
  credentials: true
}))
server.use(express.json({ limit: '20mb' }))

server.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'community-risk-warning-proxy',
    qwenConfigured: Boolean(qwenBaseUrl && qwenApiKey),
    model: qwenModel,
    timestamp: new Date().toISOString()
  })
})

server.post('/api/qwen/chat/completions', async (req, res) => {
  if (!qwenBaseUrl || !qwenApiKey) {
    return res.status(500).json({
      error: {
        message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置，请检查 .env.server',
        type: 'configuration_error'
      }
    })
  }
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), qwenTimeout)
    const response = await fetch(`${qwenBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${qwenApiKey}`
      },
      body: JSON.stringify({ model: req.body?.model || qwenModel, ...req.body }),
      signal: controller.signal
    })
    clearTimeout(timer)
    const text = await response.text()
    let payload
    try { payload = JSON.parse(text) } catch { payload = { raw: text } }
    return res.status(response.status).json(payload)
  } catch (error) {
    const isAbortError = error instanceof Error && error.name === 'AbortError'
    return res.status(isAbortError ? 504 : 500).json({
      error: {
        message: isAbortError ? 'Qwen 接口请求超时' : error instanceof Error ? error.message : '代理请求失败',
        type: isAbortError ? 'timeout_error' : 'proxy_error'
      }
    })
  }
})

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
      sandbox: false,
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
  app.quit()
})
