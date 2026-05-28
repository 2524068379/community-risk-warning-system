import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'
import { resolveVlmResourceDir } from './vlmResourcePath'
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
let restartAttempts = 0
let resourcePollTimer: NodeJS.Timeout | null = null
let stopped = false
const MAX_RESTART_ATTEMPTS = 3
const RESTART_DELAY_MS = 3000
const RESOURCE_POLL_INTERVAL_MS = 5000

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

export async function refreshOllamaStatus(): Promise<void> {
  ready = await checkReady()
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

function findVlmResources(): { serverExe: string; modelDir: string; cudaAvailable: boolean } | null {
  const modelDir = resolveVlmResourceDir({
    isPackaged: app.isPackaged,
    exePath: app.getPath('exe'),
    appPath: app.getAppPath()
  })
  const cudaExe = path.join(modelDir, 'llama-server.exe')

  if (fs.existsSync(cudaExe)) {
    const cudaAvailable = fs.existsSync(path.join(modelDir, 'ggml-cuda.dll'))
      && fs.existsSync(path.join(modelDir, 'cudart64_12.dll'))
    return { serverExe: cudaExe, modelDir, cudaAvailable }
  }

  return null
}

function schedulePollForResources(reason: string): void {
  if (stopped || resourcePollTimer || serverProcess) return
  console.warn(`[vlm] ${reason} — will retry every ${RESOURCE_POLL_INTERVAL_MS}ms`)
  status = 'starting'
  resourcePollTimer = setTimeout(() => {
    resourcePollTimer = null
    if (stopped) return
    startOllama().catch((err) => {
      console.error('[vlm] Poll-driven restart failed:', err)
      schedulePollForResources('startOllama threw during poll')
    })
  }, RESOURCE_POLL_INTERVAL_MS)
  resourcePollTimer.unref?.()
}

export async function startOllama(): Promise<void> {
  stopped = false
  const vlmConfig = getVlmRuntimeConfig()

  if (await checkReady()) {
    ready = true
    console.log('[vlm] Already running')
    return
  }

  if (serverProcess) {
    console.log('[vlm] Already starting')
    return
  }

  const resources = findVlmResources()
  if (!resources) {
    schedulePollForResources(
      'llama-server.exe not found in resources\\vlm. Reinstall the portable app or extract vlm-models.zip into <app>\\resources\\vlm\\ to enable VLM features.'
    )
    return
  }

  const { serverExe, modelDir, cudaAvailable } = resources
  const modelPath = path.join(modelDir, VLM_MODEL_FILE)
  const mmprojPath = path.join(modelDir, VLM_MMPROJ_FILE)

  if (!fs.existsSync(modelPath)) {
    schedulePollForResources(
      `Model file not found: ${modelPath}. Extract vlm-models.zip into the same folder.`
    )
    return
  }

  const effectiveGpuLayers = cudaAvailable ? vlmConfig.gpuLayers : 0
  if (!cudaAvailable) {
    console.warn(
      '[vlm] CUDA runtime DLLs not found in resources/vlm — falling back to CPU inference. ' +
        'Extract vlm-models.zip to enable GPU acceleration.'
    )
  }

  const args = [
    '-m', modelPath,
    '-a', vlmConfig.modelAlias,
    '--mmproj', mmprojPath,
    '--port', String(vlmConfig.port),
    '--host', vlmConfig.host,
    '-ngl', String(effectiveGpuLayers),
    '-c', String(vlmConfig.contextSize),
    '-b', '256',
    '--flash-attn', 'on',
    '--no-warmup',
    '--cont-batching'
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
      serverProcess = null
      ready = false

      if (stopped) {
        status = 'starting'
        return
      }

      if (code !== 0 && restartAttempts < MAX_RESTART_ATTEMPTS) {
        restartAttempts++
        console.log(`[vlm] Restarting in ${RESTART_DELAY_MS}ms (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})...`)
        status = 'starting'
        setTimeout(() => {
          if (!serverProcess && !stopped) {
            startOllama().catch((err) => {
              console.error('[vlm] Restart failed:', err)
              schedulePollForResources('startOllama threw during restart')
            })
          }
        }, RESTART_DELAY_MS).unref()
      } else {
        restartAttempts = 0
        schedulePollForResources(
          'VLM server exited; will keep polling so reinstalled model files are picked up automatically.'
        )
      }
    })

    await waitForReady(vlmConfig.startupTimeoutMs)
    ready = true
    restartAttempts = 0
    status = 'ready'
    console.log('[vlm] Ready')
  } catch (err) {
    console.error('[vlm] Failed to start:', err)
    ready = false

    if (serverProcess) {
      status = 'loading'
      console.warn('[vlm] Process is still running; readiness will continue via health polling.')
      return
    }

    status = 'error'
    schedulePollForResources('Spawn failed; will retry once files are present.')
  }
}

export async function stopOllama(): Promise<void> {
  stopped = true
  if (resourcePollTimer) {
    clearTimeout(resourcePollTimer)
    resourcePollTimer = null
  }
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  ready = false
  status = 'starting'
}
