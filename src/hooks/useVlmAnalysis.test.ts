import { describe, expect, it, vi } from 'vitest'
import {
  checkVlmConnectionStatus,
  consumeUnchangedVlmFrame,
  finalizeVlmFrame,
  planVlmDispatch
} from './useVlmAnalysis'

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

  it('lets unchanged frames through when the idle VLM probe is due', () => {
    const markConsumed = vi.fn()

    expect(consumeUnchangedVlmFrame({
      frameDataUrl: 'data:image/jpeg;base64,abc',
      hasChanged: false,
      markConsumed,
      now: 20_000,
      lastVlmTime: 5_000,
      idleProbeIntervalMs: 12_000
    })).toBe(false)

    expect(markConsumed).not.toHaveBeenCalled()
  })

  it('still consumes unchanged frames before the idle probe window elapses', () => {
    const markConsumed = vi.fn()

    expect(consumeUnchangedVlmFrame({
      frameDataUrl: 'data:image/jpeg;base64,abc',
      hasChanged: false,
      markConsumed,
      now: 10_000,
      lastVlmTime: 5_000,
      idleProbeIntervalMs: 12_000
    })).toBe(true)

    expect(markConsumed).toHaveBeenCalledTimes(1)
  })
})

describe('planVlmDispatch', () => {
  it('dispatches immediately when lightweight detection has failed', () => {
    expect(planVlmDispatch({
      detectorFailed: true,
      detections: [],
      now: 1_000,
      lastVlmTime: 900,
      fallbackIntervalMs: 6_000
    })).toEqual({
      shouldSendVlm: true,
      isHighPriority: true,
      reason: 'detector-failed'
    })
  })

  it('prioritizes person and two-wheel detections', () => {
    expect(planVlmDispatch({
      detectorFailed: false,
      detections: [{ label: 'bicycle', score: 0.42, bbox: [0, 0, 1, 1] }],
      now: 1_000,
      lastVlmTime: 900,
      fallbackIntervalMs: 6_000
    })).toEqual({
      shouldSendVlm: true,
      isHighPriority: true,
      reason: 'high-priority-object'
    })
  })

  it('dispatches non-priority candidate objects without escalation', () => {
    expect(planVlmDispatch({
      detectorFailed: false,
      detections: [{ label: 'backpack', score: 0.36, bbox: [0, 0, 1, 1] }],
      now: 1_000,
      lastVlmTime: 900,
      fallbackIntervalMs: 6_000
    })).toEqual({
      shouldSendVlm: true,
      isHighPriority: false,
      reason: 'object'
    })
  })

  it('uses the fallback interval when no objects are detected', () => {
    expect(planVlmDispatch({
      detectorFailed: false,
      detections: [],
      now: 10_000,
      lastVlmTime: 3_000,
      fallbackIntervalMs: 6_000
    })).toEqual({
      shouldSendVlm: true,
      isHighPriority: false,
      reason: 'fallback'
    })
  })

  it('skips empty detections inside the fallback window', () => {
    expect(planVlmDispatch({
      detectorFailed: false,
      detections: [],
      now: 8_000,
      lastVlmTime: 3_000,
      fallbackIntervalMs: 6_000
    })).toEqual({
      shouldSendVlm: false,
      isHighPriority: false,
      reason: 'skip'
    })
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
