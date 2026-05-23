import { describe, expect, it, vi } from 'vitest'
import { checkVlmConnectionStatus, consumeUnchangedVlmFrame, finalizeVlmFrame } from './useVlmAnalysis'

describe('finalizeVlmFrame', () => {
  it('releases the analysis lock and consumes the frame even after cancellation', () => {
    const markConsumed = vi.fn()
    const releaseAnalysisLock = vi.fn()

    finalizeVlmFrame({
      markConsumed,
      releaseAnalysisLock
    })

    expect(markConsumed).toHaveBeenCalledTimes(1)
    expect(releaseAnalysisLock).toHaveBeenCalledTimes(1)
  })
})

describe('consumeUnchangedVlmFrame', () => {
  it('consumes unchanged frames so capture loops do not stay locked', () => {
    const markConsumed = vi.fn()

    expect(consumeUnchangedVlmFrame({
      frameDataUrl: 'data:image/jpeg;base64,abc',
      hasChanged: false,
      markConsumed
    })).toBe(true)

    expect(markConsumed).toHaveBeenCalledTimes(1)
  })

  it('keeps changed or missing frames for normal processing', () => {
    const markConsumed = vi.fn()

    expect(consumeUnchangedVlmFrame({
      frameDataUrl: 'data:image/jpeg;base64,abc',
      hasChanged: true,
      markConsumed
    })).toBe(false)
    expect(consumeUnchangedVlmFrame({
      frameDataUrl: null,
      hasChanged: false,
      markConsumed
    })).toBe(false)

    expect(markConsumed).not.toHaveBeenCalled()
  })
})

describe('checkVlmConnectionStatus', () => {
  it('prefers Electron main-process VLM status while llama-server is still starting', async () => {
    const httpGet = vi.fn()

    await expect(checkVlmConnectionStatus({
      electronApi: {
        getApiBase: async () => 'http://127.0.0.1:1234',
        getOllamaStatus: async () => ({
          ready: false,
          status: 'starting',
          baseUrl: 'http://127.0.0.1:11434',
          gpu: 'unknown'
        })
      },
      httpGet
    })).resolves.toEqual({
      ready: false,
      status: 'starting',
      source: 'electron'
    })

    expect(httpGet).not.toHaveBeenCalled()
  })
})
