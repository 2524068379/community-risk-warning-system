import { describe, expect, it } from 'vitest'
import type { IpcMainInvokeEvent, WebContents, WebFrameMain } from 'electron'
import {
  assertTrustedIpcSender,
  isAllowedVideoPermissionCheck,
  isAllowedVideoPermissionRequest,
  isTrustedMainFrameNavigation,
  isTrustedRendererUrl
} from './security'

const DEV_RENDERER_URL = 'http://localhost:5173/'
const FILE_RENDERER_URL = 'file:///C:/Program%20Files/Risk/resources/app.asar/dist/renderer/index.html'

function createIpcFixture(frameUrl = DEV_RENDERER_URL) {
  const mainFrame = { url: frameUrl } as WebFrameMain
  const webContents = {
    mainFrame,
    getURL: () => frameUrl,
    isDestroyed: () => false
  } as unknown as WebContents
  const event = {
    sender: webContents,
    senderFrame: mainFrame
  } as IpcMainInvokeEvent

  return { event, mainFrame, webContents }
}

describe('trusted renderer URL policy', () => {
  it('matches the exact renderer document while allowing hash routes', () => {
    expect(isTrustedRendererUrl('http://localhost:5173/#/monitor', DEV_RENDERER_URL)).toBe(true)
    expect(isTrustedRendererUrl(`${FILE_RENDERER_URL}#/overview`, FILE_RENDERER_URL)).toBe(true)
  })

  it('rejects changed ports, paths, queries, and malformed URLs', () => {
    expect(isTrustedRendererUrl('http://localhost:5174/', DEV_RENDERER_URL)).toBe(false)
    expect(isTrustedRendererUrl('http://localhost:5173/other', DEV_RENDERER_URL)).toBe(false)
    expect(isTrustedRendererUrl('http://localhost:5173/?next=evil', DEV_RENDERER_URL)).toBe(false)
    expect(isTrustedRendererUrl('not a URL', DEV_RENDERER_URL)).toBe(false)
  })

  it('allows only trusted main-frame navigation', () => {
    expect(isTrustedMainFrameNavigation(`${DEV_RENDERER_URL}#/events`, true, DEV_RENDERER_URL)).toBe(true)
    expect(isTrustedMainFrameNavigation(DEV_RENDERER_URL, false, DEV_RENDERER_URL)).toBe(false)
    expect(isTrustedMainFrameNavigation('https://example.com/', true, DEV_RENDERER_URL)).toBe(false)
  })
})

describe('IPC sender policy', () => {
  it('accepts only the trusted BrowserWindow main frame', () => {
    const { event, webContents } = createIpcFixture(`${DEV_RENDERER_URL}#/monitor`)
    expect(() => assertTrustedIpcSender(event, webContents, DEV_RENDERER_URL)).not.toThrow()
  })

  it('rejects a different webContents', () => {
    const { event } = createIpcFixture()
    const { webContents: trustedWebContents } = createIpcFixture()
    expect(() => assertTrustedIpcSender(event, trustedWebContents, DEV_RENDERER_URL)).toThrow(
      /untrusted webContents/
    )
  })

  it('rejects subframes and navigated renderer URLs', () => {
    const { event, webContents } = createIpcFixture()
    const subframeEvent = {
      ...event,
      senderFrame: { url: DEV_RENDERER_URL }
    } as IpcMainInvokeEvent
    expect(() => assertTrustedIpcSender(subframeEvent, webContents, DEV_RENDERER_URL)).toThrow(
      /non-main renderer frame/
    )

    const navigated = createIpcFixture('https://example.com/')
    expect(() => assertTrustedIpcSender(navigated.event, navigated.webContents, DEV_RENDERER_URL)).toThrow(
      /untrusted renderer URL/
    )
  })
})

describe('media permission policy', () => {
  it('allows trusted main-frame video capture', () => {
    expect(isAllowedVideoPermissionCheck('media', {
      isMainFrame: true,
      mediaType: 'video',
      requestingUrl: `${DEV_RENDERER_URL}#/monitor`
    }, DEV_RENDERER_URL)).toBe(true)

    expect(isAllowedVideoPermissionRequest('media', {
      isMainFrame: true,
      mediaTypes: ['video'],
      requestingUrl: DEV_RENDERER_URL
    }, DEV_RENDERER_URL)).toBe(true)
  })

  it('rejects audio, subframes, other permissions, and other URLs', () => {
    expect(isAllowedVideoPermissionCheck('media', {
      isMainFrame: true,
      mediaType: 'audio',
      requestingUrl: DEV_RENDERER_URL
    }, DEV_RENDERER_URL)).toBe(false)
    expect(isAllowedVideoPermissionRequest('media', {
      isMainFrame: true,
      mediaTypes: ['video', 'audio'],
      requestingUrl: DEV_RENDERER_URL
    }, DEV_RENDERER_URL)).toBe(false)
    expect(isAllowedVideoPermissionRequest('media', {
      isMainFrame: false,
      mediaTypes: ['video'],
      requestingUrl: DEV_RENDERER_URL
    }, DEV_RENDERER_URL)).toBe(false)
    expect(isAllowedVideoPermissionRequest('geolocation', {
      isMainFrame: true,
      mediaTypes: ['video'],
      requestingUrl: DEV_RENDERER_URL
    }, DEV_RENDERER_URL)).toBe(false)
    expect(isAllowedVideoPermissionRequest('media', {
      isMainFrame: true,
      mediaTypes: ['video'],
      requestingUrl: 'https://example.com/'
    }, DEV_RENDERER_URL)).toBe(false)
  })
})
