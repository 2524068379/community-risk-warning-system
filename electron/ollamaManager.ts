import { app } from 'electron'
import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const OLLAMA_MODEL = 'qwen3.5:4b-q4_K_M'
const OLLAMA_PORT = 11434
const OLLAMA_BASE = `http://127.0.0.1:${OLLAMA_PORT}`

let ollamaProcess: ChildProcess | null = null
let ready = false
let gpuAvailable = false

export function getOllamaBaseUrl(): string {
  return OLLAMA_BASE
}

export function isOllamaReady(): boolean {
  return ready
}

export function isGpuAvailable(): boolean {
  return gpuAvailable
}

async function detectGpu(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/ps`, { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return
    const data = await res.json() as { models?: { name: string; size: number }[] }
    void data
  } catch {
    // ignore
  }

  try {
    const res = await fetch(`http://127.0.0.1:${OLLAMA_PORT}/`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const text = await res.text()
      gpuAvailable = text.toLowerCase().includes('cuda') || text.toLowerCase().includes('gpu')
    }
  } catch {
    // default to assuming GPU might be available — Ollama auto-detects
    gpuAvailable = true
  }
}

async function checkReady(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(2000)
    })
    return res.ok
  } catch {
    return false
  }
}

async function waitForReady(timeoutMs: number): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await checkReady()) return
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('Ollama did not become ready within timeout')
}

async function ensureModel(): Promise<void> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`)
    const data = (await res.json()) as { models?: { name: string }[] }
    const hasModel = data.models?.some((m) => m.name.includes('qwen3.5'))
    if (hasModel) {
      console.log('[ollama] Model already available')
      return
    }

    console.log('[ollama] Pulling model', OLLAMA_MODEL, '...')
    const pullRes = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: OLLAMA_MODEL, stream: false }),
      signal: AbortSignal.timeout(600_000)
    })
    if (!pullRes.ok) {
      const text = await pullRes.text()
      console.error('[ollama] Pull failed:', text)
    } else {
      console.log('[ollama] Model pulled successfully')
    }
  } catch (err) {
    console.error('[ollama] ensureModel error:', err)
  }
}

function findOllamaBinary(): string | null {
  if (app.isPackaged) {
    const packaged = path.join(process.resourcesPath, 'ollama', 'ollama.exe')
    if (fs.existsSync(packaged)) return packaged
  }
  return 'ollama'
}

export async function startOllama(): Promise<void> {
  if (await checkReady()) {
    ready = true
    console.log('[ollama] Already running')
    await ensureModel()
    return
  }

  const binary = findOllamaBinary()
  if (!binary) {
    console.warn('[ollama] Binary not found, VLM features disabled')
    return
  }

  try {
    ollamaProcess = spawn(binary, ['serve'], {
      env: {
        ...process.env,
        OLLAMA_HOST: `127.0.0.1:${OLLAMA_PORT}`,
        OLLAMA_NUM_GPU: '999',
        OLLAMA_GPU_DRIVER: 'cuda'
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      detached: false
    })

    ollamaProcess.on('error', (err) => {
      console.error('[ollama] Process error:', err.message)
    })

    ollamaProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.log('[ollama]', msg)
    })

    ollamaProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      if (msg) console.error('[ollama]', msg)
    })

    await waitForReady(30_000)
    ready = true
    console.log('[ollama] Ready')

    await detectGpu()
    console.log('[ollama] GPU acceleration:', gpuAvailable ? 'CUDA available' : 'CPU only')

    await ensureModel()
  } catch (err) {
    console.error('[ollama] Failed to start:', err)
    ready = false
  }
}

export async function stopOllama(): Promise<void> {
  if (ollamaProcess) {
    ollamaProcess.kill()
    ollamaProcess = null
  }
  ready = false
}
