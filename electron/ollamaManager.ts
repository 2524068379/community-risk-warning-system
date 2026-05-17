import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import {
  GPU_AVAILABILITY_UNKNOWN,
  resolveOllamaHealthStatus,
  type GpuAvailability,
  type OllamaRuntimeStatus
} from '../server/ollamaHealthStatus.js'
import { VLM_MODEL_FILE, VLM_MMPROJ_FILE } from '../shared/vlmModelConfig.js'
import { loadVlmRuntimeConfig, type VlmRuntimeConfig } from '../shared/vlmRuntimeConfig.js'

let serverProcess: ChildProcess | null = null
let ready = false
let status: OllamaRuntimeStatus = 'starting'
let runtimeConfig: VlmRuntimeConfig | null = null

function getVlmRuntimeConfig(): VlmRuntimeConfig {
  runtimeConfig ??= loadVlmRuntimeConfig(process.env)
  return runtimeConfig
}

function getVlmBaseUrl(): string {
  const config = getVlmRuntimeConfig()
  return `http://${config.host}:${config.port}`
}

export function getOllamaBaseUrl(): string {
  return getVlmBaseUrl()
}

export function isOllamaReady(): boolean {
  return ready
}

export function isGpuAvailable(): GpuAvailability {
  return GPU_AVAILABILITY_UNKNOWN
}

export function getOllamaRuntimeStatus(): OllamaRuntimeStatus {
  return status
}

async function checkReady(): Promise<boolean> {
  try {
    const res = await fetch(`${getVlmBaseUrl()}/health`, {
      signal: AbortSignal.timeout(2000)
    })
    const healthStatus = resolveOllamaHealthStatus(res.status)
    status = healthStatus.status
    return healthStatus.ready
  } catch {
    status = serverProcess ? 'starting' : 'error'
    return false
  }
}

async function waitForReady(timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkReady()) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('VLM server did not become ready within timeout')
}

function findVlmResources(): { serverExe: string; modelDir: string } | null {
  let baseDir: string

  if (app.isPackaged) {
    // 打包后：相对于 exe 所在的目录去寻找
    baseDir = path.join(path.dirname(app.getPath('exe')), 'resources')
  } else {
    // 开发环境：项目根目录下的 resources
    baseDir = path.join(app.getAppPath(), 'resources')
  }

  const modelDir = path.join(baseDir, 'vlm')
  const cudaExe = path.join(modelDir, 'llama-server.exe')

  if (fs.existsSync(cudaExe)) {
    return { serverExe: cudaExe, modelDir }
  }

  return null
}

export async function startOllama(): Promise<void> {
  const vlmConfig = getVlmRuntimeConfig()

  if (await checkReady()) {
    ready = true
    console.log('[vlm] Already running')
    return
  }

  const resources = findVlmResources()
  if (!resources) {
    console.warn('[vlm] llama-server.exe not found in resources, VLM features disabled')
    console.warn('[vlm] Run: node scripts/download-model.js')
    status = 'error'
    return
  }

  const { serverExe, modelDir } = resources
  const modelPath = path.join(modelDir, VLM_MODEL_FILE)
  const mmprojPath = path.join(modelDir, VLM_MMPROJ_FILE)

  if (!fs.existsSync(modelPath)) {
    console.error(`[vlm] Model file not found: ${modelPath}`)
    console.error('[vlm] Run: node scripts/download-model.js')
    status = 'error'
    return
  }

  const args = [
    '-m', modelPath,
    '--mmproj', mmprojPath,
    '--port', String(vlmConfig.port),
    '--host', vlmConfig.host,
    '-ngl', String(vlmConfig.gpuLayers),
    '-c', String(vlmConfig.contextSize),
    '--no-warmup'
  ]

  if (!fs.existsSync(mmprojPath)) {
    console.warn('[vlm] mmproj file not found, running without vision encoder')
    const idx = args.indexOf('--mmproj')
    if (idx !== -1) args.splice(idx, 2)
  }

  console.log('[vlm] Starting:', serverExe, args.join(' '))
  status = 'starting'

  try {
    serverProcess = spawn(serverExe, args, {
      cwd: modelDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    })

    serverProcess.on('error', (err) => {
      console.error('[vlm] Process error:', err.message)
      status = 'error'
    })

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.log('[vlm]', msg)
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.error('[vlm]', msg)
    })

    serverProcess.on('exit', (code) => {
      console.log('[vlm] Process exited with code', code)
      ready = false
      status = 'error'
    })

    await waitForReady(vlmConfig.startupTimeoutMs)
    ready = true
    status = 'ready'
    console.log('[vlm] Ready')
  } catch (err) {
    console.error('[vlm] Failed to start:', err)
    ready = false
    status = 'error'
  }
}

export async function stopOllama(): Promise<void> {
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  ready = false
  status = 'starting'
}
