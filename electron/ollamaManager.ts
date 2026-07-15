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
import { VLM_HAS_MMPROJ, VLM_MODEL_FILE, VLM_MMPROJ_FILE } from '../shared/vlmModelConfig.js'
import { loadVlmRuntimeConfig, type VlmRuntimeConfig } from '../shared/vlmRuntimeConfig.js'

let serverProcess: ChildProcess | null = null
let ready = false
let status: OllamaRuntimeStatus = 'starting'
let runtimeConfig: VlmRuntimeConfig | null = null
let restartAttempts = 0
let resourcePollTimer: NodeJS.Timeout | null = null
let restartTimer: NodeJS.Timeout | null = null
let stopped = false
let lifecycleGeneration = 0
const MAX_RESTART_ATTEMPTS = 3
const RESTART_DELAY_MS = 3000
const RESOURCE_POLL_INTERVAL_MS = 5000

export interface ProcessTerminationDetails {
  kind: 'error' | 'close'
  error?: Error
  code?: number | null
  signal?: NodeJS.Signals | null
}

export function createProcessTerminationHandlers(
  onTermination: (details: ProcessTerminationDetails) => void
): {
  onError: (error: Error) => void
  onClose: (code: number | null, signal: NodeJS.Signals | null) => void
} {
  let handled = false

  const finish = (details: ProcessTerminationDetails): void => {
    if (handled) return
    handled = true
    onTermination(details)
  }

  return {
    onError: (error) => finish({ kind: 'error', error }),
    onClose: (code, signal) => finish({ kind: 'close', code, signal })
  }
}

export function calculateRestartDelayMs(attempt: number): number {
  const normalizedAttempt = Math.max(1, Math.trunc(attempt))
  return RESTART_DELAY_MS * (2 ** (normalizedAttempt - 1))
}

export function buildLlamaServerEnv(
  sourceEnv: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
  apiKey?: string
): NodeJS.ProcessEnv {
  const commonNames = new Set([
    'PATH',
    'TEMP',
    'TMP',
    'CUDA_PATH',
    'CUDA_VISIBLE_DEVICES',
    'OMP_NUM_THREADS'
  ])
  const platformNames = platform === 'win32'
    ? new Set(['SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT'])
    : new Set(['HOME', 'TMPDIR', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'LANG', 'LC_ALL'])
  const childEnv = new Map<string, string>()

  for (const [name, value] of Object.entries(sourceEnv)) {
    if (value === undefined) continue

    const normalizedName = name.toUpperCase()
    const isRuntimeSetting = normalizedName.startsWith('GGML_')
      || normalizedName.startsWith('CUDA_PATH_V')

    if (commonNames.has(normalizedName) || platformNames.has(normalizedName) || isRuntimeSetting) {
      childEnv.set(name, value)
    }
  }

  if (apiKey) {
    childEnv.set('LLAMA_API_KEY', apiKey)
  }

  return Object.fromEntries(childEnv)
}

export function isVlmLifecycleCurrent(
  generation: number,
  currentGeneration: number,
  isStopped: boolean
): boolean {
  return !isStopped && generation === currentGeneration
}

export function getMissingRequiredVlmFiles(
  modelPath: string,
  mmprojPath: string | null,
  existsSync: (filePath: string) => boolean = fs.existsSync
): string[] {
  return [modelPath, ...(mmprojPath ? [mmprojPath] : [])].filter(
    (filePath) => !existsSync(filePath)
  )
}

interface BuildLlamaServerArgsOptions {
  modelPath: string
  mmprojPath: string | null
  vlmConfig: VlmRuntimeConfig
  effectiveGpuLayers: number
}

export function buildLlamaServerArgs(options: BuildLlamaServerArgsOptions): string[] {
  const { modelPath, mmprojPath, vlmConfig, effectiveGpuLayers } = options
  const args = [
    '-m', modelPath,
    '-a', vlmConfig.modelAlias,
    '--port', String(vlmConfig.port),
    '--host', vlmConfig.host,
    '-ngl', String(effectiveGpuLayers),
    '-c', String(vlmConfig.contextSize),
    '-b', String(vlmConfig.batchSize),
    '-ub', String(vlmConfig.ubatchSize),
    '--flash-attn', 'on',
    '--cache-type-k', vlmConfig.cacheTypeK,
    '--cache-type-v', vlmConfig.cacheTypeV,
    '--no-warmup',
    '--cont-batching',
    '--jinja',
    '--reasoning', 'off'
  ]

  // MTP（draft-mtp 推测解码）与 mmproj 视觉编码器在 llama.cpp 的 MTP 分支中互斥：
  // 启用 MTP 时只能加载主模型，mmproj 不被支持。本项目以视觉研判为核心，因此当两者
  // 同时出现时优先保留视觉（加载 mmproj、忽略 MTP）并告警。MTP 仅加速文本生成、对视觉
  // 编码无效，其 --spec-* 参数也只存在于 llama.cpp 的 MTP 专用构建（官方预编译包不含）。
  if (vlmConfig.mtpEnabled && mmprojPath) {
    console.warn(
      '[vlm] VLM_MTP_ENABLED=true 与 mmproj 视觉编码器互斥；已保留视觉能力并忽略 MTP。' +
        ' 如需 MTP 文本加速，请改用无 mmproj 的纯文本模型，并使用支持 MTP 的 llama.cpp 构建。'
    )
  }

  if (mmprojPath) {
    args.push('--mmproj', mmprojPath)
  } else if (vlmConfig.mtpEnabled) {
    // 真实可用的 MTP 启用方式仅需 --spec-type draft-mtp 与 --spec-draft-n-max，且要求模型
    // 自带 MTP head；不再加载第二份模型当 draft（原 --spec-draft-model 会翻倍显存）。
    args.push('--spec-type', 'draft-mtp', '--spec-draft-n-max', String(vlmConfig.mtpDraftTokens))
  }

  return args
}

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
  return Boolean(serverProcess && ready && !stopped)
}

export function isGpuAvailable(): GpuAvailability {
  return GPU_AVAILABILITY_UNKNOWN
}

export function getOllamaRuntimeStatus(): OllamaRuntimeStatus {
  return status
}

export async function refreshOllamaStatus(): Promise<void> {
  if (!serverProcess || stopped) {
    ready = false
    status = stopped ? 'starting' : 'error'
    return
  }

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

async function waitForReady(timeoutMs: number, expectedProcess: ChildProcess): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (serverProcess !== expectedProcess) {
      throw new Error('VLM server process ended before becoming ready')
    }
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
  if (stopped || resourcePollTimer || restartTimer || serverProcess) return
  console.warn(`[vlm] ${reason} — will retry every ${RESOURCE_POLL_INTERVAL_MS}ms`)
  ready = false
  status = 'error'
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

function scheduleProcessRestart(reason: string): void {
  if (stopped || restartTimer || resourcePollTimer || serverProcess) return

  ready = false
  status = 'error'

  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    restartAttempts = 0
    schedulePollForResources(`${reason}; restart limit reached`)
    return
  }

  restartAttempts++
  const delayMs = calculateRestartDelayMs(restartAttempts)
  console.warn(
    `[vlm] ${reason}; retrying in ${delayMs}ms ` +
      `(attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS})`
  )
  restartTimer = setTimeout(() => {
    restartTimer = null
    if (stopped || serverProcess) return

    status = 'starting'
    startOllama().catch((err) => {
      console.error('[vlm] Restart failed:', err)
      scheduleProcessRestart('startOllama threw during restart')
    })
  }, delayMs)
  restartTimer.unref?.()
}

export async function startOllama(): Promise<void> {
  stopped = false
  const startGeneration = lifecycleGeneration
  const vlmConfig = getVlmRuntimeConfig()

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
  const configuredMmprojPath = VLM_HAS_MMPROJ ? path.join(modelDir, VLM_MMPROJ_FILE) : null

  const missingFiles = getMissingRequiredVlmFiles(modelPath, configuredMmprojPath)
  if (missingFiles.includes(modelPath)) {
    schedulePollForResources(
      `Model file not found: ${modelPath}. Extract vlm-models.zip into the same folder.`
    )
    return
  }

  if (configuredMmprojPath && missingFiles.includes(configuredMmprojPath)) {
    schedulePollForResources(
      `Required vision projector not found: ${configuredMmprojPath}. ` +
        'The visual VLM service will remain stopped until mmproj is installed.'
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

  const mmprojPath = configuredMmprojPath
  const args = buildLlamaServerArgs({ modelPath, mmprojPath, vlmConfig, effectiveGpuLayers })

  if (!isVlmLifecycleCurrent(startGeneration, lifecycleGeneration, stopped)) {
    return
  }

  console.log('[vlm] Starting:', serverExe, args.join(' '))
  status = 'starting'

  let child: ChildProcess | null = null

  try {
    child = spawn(serverExe, args, {
      cwd: modelDir,
      env: buildLlamaServerEnv(process.env, process.platform, process.env.VLM_API_KEY),
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    })
    serverProcess = child

    const terminationHandlers = createProcessTerminationHandlers((details) => {
      if (details.kind === 'error') {
        console.error('[vlm] Process error:', details.error?.message)
      } else {
        console.warn(
          '[vlm] Process closed with code',
          details.code,
          details.signal ? `signal ${details.signal}` : ''
        )
      }

      if (serverProcess !== child) return

      serverProcess = null
      ready = false
      status = 'error'

      if (!stopped) {
        scheduleProcessRestart(
          details.kind === 'error' ? 'VLM process failed to spawn' : 'VLM process closed unexpectedly'
        )
      }
    })

    child.once('error', terminationHandlers.onError)
    child.once('close', terminationHandlers.onClose)

    child.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.log('[vlm]', msg)
    })

    child.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.error('[vlm]', msg)
    })

    await waitForReady(vlmConfig.startupTimeoutMs, child)
    if (
      serverProcess !== child
      || !isVlmLifecycleCurrent(startGeneration, lifecycleGeneration, stopped)
    ) {
      child.kill()
      throw new Error('VLM server process ended during startup')
    }
    ready = true
    restartAttempts = 0
    status = 'ready'
    console.log('[vlm] Ready')
  } catch (err) {
    if (!isVlmLifecycleCurrent(startGeneration, lifecycleGeneration, stopped)) {
      child?.kill()
      return
    }

    console.error('[vlm] Failed to start:', err)
    ready = false

    if (child && serverProcess === child) {
      status = 'error'
      console.warn('[vlm] Process stayed unhealthy past startup timeout; terminating for a clean retry.')
      child.kill()
      return
    }

    status = 'error'
    if (!child) {
      scheduleProcessRestart('VLM process could not be created')
    }
  }
}

export async function stopOllama(): Promise<void> {
  stopped = true
  lifecycleGeneration++
  if (resourcePollTimer) {
    clearTimeout(resourcePollTimer)
    resourcePollTimer = null
  }
  if (restartTimer) {
    clearTimeout(restartTimer)
    restartTimer = null
  }
  if (serverProcess) {
    serverProcess.kill()
    serverProcess = null
  }
  ready = false
  status = 'starting'
}
