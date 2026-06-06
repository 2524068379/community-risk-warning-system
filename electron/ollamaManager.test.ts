import { describe, expect, it, vi } from 'vitest'
import { buildLlamaServerArgs } from './ollamaManager'
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
