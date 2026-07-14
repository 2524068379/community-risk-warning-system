import { describe, expect, it, vi } from 'vitest'
import {
  buildLlamaServerArgs,
  buildLlamaServerEnv,
  calculateRestartDelayMs,
  createProcessTerminationHandlers,
  getMissingRequiredVlmFiles,
  isVlmLifecycleCurrent
} from './ollamaManager'
import { resolveOllamaHealthStatus } from '../server/ollamaHealthStatus.js'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '',
    getAppPath: () => ''
  }
}))

describe('resolveOllamaHealthStatus', () => {
  it('marks 2xx health responses as ready', () => {
    expect(resolveOllamaHealthStatus(200)).toEqual({ ready: true, status: 'ready', gpu: 'unknown' })
  })

  it('marks 503 health responses as loading instead of ready', () => {
    expect(resolveOllamaHealthStatus(503)).toEqual({ ready: false, status: 'loading', gpu: 'unknown' })
  })

  it('marks other non-2xx health responses as error', () => {
    expect(resolveOllamaHealthStatus(500)).toEqual({ ready: false, status: 'error', gpu: 'unknown' })
  })
})

describe('buildLlamaServerArgs', () => {
  const baseConfig = {
    host: '127.0.0.1',
    port: 11434,
    modelAlias: 'local-model',
    gpuLayers: 99,
    contextSize: 4096,
    batchSize: 512,
    ubatchSize: 256,
    cacheTypeK: 'f16',
    cacheTypeV: 'f16',
    startupTimeoutMs: 60000,
    mtpEnabled: false,
    mtpDraftTokens: 4
  }

  it('loads mmproj and KV cache args without MTP by default', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: 'C:\\vlm\\mmproj.gguf',
      effectiveGpuLayers: 99,
      vlmConfig: baseConfig
    })

    expect(args).toContain('--mmproj')
    expect(args).toContain('C:\\vlm\\mmproj.gguf')
    expect(args).toContain('--jinja')
    expect(args).toContain('--cache-type-k')
    expect(args).toContain('--cache-type-v')
    expect(args).not.toContain('--spec-type')
    expect(args).not.toContain('--spec-draft-model')
  })

  it('keeps vision (mmproj) and ignores MTP when both are requested, since they are mutually exclusive', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: 'C:\\vlm\\mmproj.gguf',
      effectiveGpuLayers: 99,
      vlmConfig: { ...baseConfig, mtpEnabled: true }
    })

    expect(args).toContain('--mmproj')
    expect(args).not.toContain('--spec-type')
  })

  it('enables MTP only when no mmproj is present, without loading a second draft model', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: null,
      effectiveGpuLayers: 99,
      vlmConfig: { ...baseConfig, mtpEnabled: true, mtpDraftTokens: 3 }
    })

    expect(args).not.toContain('--mmproj')
    expect(args).toContain('--spec-type')
    expect(args).toContain('draft-mtp')
    expect(args).toContain('--spec-draft-n-max')
    expect(args).toContain('3')
    expect(args).not.toContain('--spec-draft-model')
    expect(args).not.toContain('--spec-draft-ngl')
  })

  it('disables MTP and keeps the base llama-server args valid in CPU mode', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: null,
      effectiveGpuLayers: 0,
      vlmConfig: { ...baseConfig, gpuLayers: 0, contextSize: 2048, batchSize: 256, ubatchSize: 128 }
    })

    expect(args).not.toContain('--mmproj')
    expect(args).not.toContain('--spec-type')
    expect(args).toContain('-ngl')
    expect(args).toContain('0')
  })
})

describe('VLM process lifecycle helpers', () => {
  it('handles spawn error and subsequent close exactly once', () => {
    const onTermination = vi.fn()
    const handlers = createProcessTerminationHandlers(onTermination)
    const spawnError = new Error('ENOENT')

    handlers.onError(spawnError)
    handlers.onClose(null, null)

    expect(onTermination).toHaveBeenCalledTimes(1)
    expect(onTermination).toHaveBeenCalledWith({ kind: 'error', error: spawnError })
  })

  it('handles a normal close when no process error was emitted', () => {
    const onTermination = vi.fn()
    const handlers = createProcessTerminationHandlers(onTermination)

    handlers.onClose(1, 'SIGTERM')

    expect(onTermination).toHaveBeenCalledWith({
      kind: 'close',
      code: 1,
      signal: 'SIGTERM'
    })
  })

  it('uses exponential restart backoff', () => {
    expect(calculateRestartDelayMs(1)).toBe(3000)
    expect(calculateRestartDelayMs(2)).toBe(6000)
    expect(calculateRestartDelayMs(3)).toBe(12000)
  })

  it('invalidates an in-flight start when stop advances the lifecycle generation', () => {
    expect(isVlmLifecycleCurrent(3, 3, false)).toBe(true)
    expect(isVlmLifecycleCurrent(3, 4, false)).toBe(false)
    expect(isVlmLifecycleCurrent(3, 3, true)).toBe(false)
  })

  it('passes only runtime-required environment variables to llama-server', () => {
    const childEnv = buildLlamaServerEnv({
      Path: 'C:\\Windows\\System32',
      SystemRoot: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      CUDA_VISIBLE_DEVICES: '0',
      GGML_CUDA_ENABLE_UNIFIED_MEMORY: '1',
      QWEN_API_KEY: 'must-not-leak',
      ELECTRON_RENDERER_URL: 'http://localhost:5173'
    }, 'win32')

    expect(childEnv).toEqual({
      Path: 'C:\\Windows\\System32',
      SystemRoot: 'C:\\Windows',
      TEMP: 'C:\\Temp',
      CUDA_VISIBLE_DEVICES: '0',
      GGML_CUDA_ENABLE_UNIFIED_MEMORY: '1'
    })
    expect(childEnv).not.toHaveProperty('QWEN_API_KEY')
    expect(childEnv).not.toHaveProperty('ELECTRON_RENDERER_URL')
  })

  it('injects only the generated llama-server API key into the child environment', () => {
    const childEnv = buildLlamaServerEnv({
      QWEN_API_KEY: 'must-not-leak'
    }, 'win32', 'session-vlm-key')

    expect(childEnv).toEqual({ LLAMA_API_KEY: 'session-vlm-key' })
  })

  it('treats a configured mmproj as a required VLM resource', () => {
    const presentFiles = new Set(['C:\\vlm\\model.gguf'])
    const missing = getMissingRequiredVlmFiles(
      'C:\\vlm\\model.gguf',
      'C:\\vlm\\mmproj.gguf',
      (filePath) => presentFiles.has(filePath)
    )

    expect(missing).toEqual(['C:\\vlm\\mmproj.gguf'])
  })
})
