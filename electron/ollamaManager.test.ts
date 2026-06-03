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
  it('enables mmproj and MTP speculative decoding for llama-server', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: 'C:\\vlm\\mmproj.gguf',
      effectiveGpuLayers: 99,
      vlmConfig: {
        host: '127.0.0.1',
        port: 11434,
        modelAlias: 'local-model',
        gpuLayers: 99,
        contextSize: 4096,
        batchSize: 512,
        ubatchSize: 256,
        startupTimeoutMs: 60000,
        mtpEnabled: true,
        mtpDraftTokens: 4,
        mtpMinDraftTokens: 1,
        mtpMinProbability: 0.75
      }
    })

    expect(args).toContain('--mmproj')
    expect(args).toContain('C:\\vlm\\mmproj.gguf')
    expect(args).toContain('--jinja')
    expect(args).toContain('--spec-type')
    expect(args).toContain('draft-mtp')
    expect(args).toContain('--spec-draft-model')
    expect(args).toContain('C:\\vlm\\model.gguf')
    expect(args).toContain('--spec-draft-n-max')
    expect(args).toContain('4')
    expect(args).toContain('-ub')
    expect(args).toContain('256')
  })

  it('can disable MTP while keeping the base llama-server args valid', () => {
    const args = buildLlamaServerArgs({
      modelPath: 'C:\\vlm\\model.gguf',
      mmprojPath: null,
      effectiveGpuLayers: 0,
      vlmConfig: {
        host: '127.0.0.1',
        port: 11434,
        modelAlias: 'local-model',
        gpuLayers: 0,
        contextSize: 2048,
        batchSize: 256,
        ubatchSize: 128,
        startupTimeoutMs: 60000,
        mtpEnabled: false,
        mtpDraftTokens: 4,
        mtpMinDraftTokens: 1,
        mtpMinProbability: 0.75
      }
    })

    expect(args).not.toContain('--mmproj')
    expect(args).not.toContain('--spec-type')
    expect(args).toContain('-ngl')
    expect(args).toContain('0')
  })
})
