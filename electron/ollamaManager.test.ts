import { describe, expect, it } from 'vitest'
import { resolveOllamaHealthStatus } from '../server/ollamaHealthStatus.js'

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
