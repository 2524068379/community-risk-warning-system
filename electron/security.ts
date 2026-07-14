import type { IpcMainInvokeEvent, WebContents } from 'electron'

interface PermissionRequestDetails {
  isMainFrame: boolean
  requestingUrl?: string
  mediaTypes?: Array<'video' | 'audio'>
}

interface PermissionCheckDetails {
  isMainFrame: boolean
  requestingUrl?: string
  mediaType?: 'video' | 'audio' | 'unknown'
}

function normalizeDocumentUrl(value: string): string | null {
  try {
    const url = new URL(value)

    // The renderer uses hash routing. A fragment change does not load a different
    // document and must not invalidate an otherwise trusted renderer frame.
    url.hash = ''
    return url.href
  } catch {
    return null
  }
}

export function isTrustedRendererUrl(candidateUrl: string, trustedRendererUrl: string): boolean {
  const candidate = normalizeDocumentUrl(candidateUrl)
  const trusted = normalizeDocumentUrl(trustedRendererUrl)
  return candidate !== null && trusted !== null && candidate === trusted
}

export function isTrustedMainFrameNavigation(
  candidateUrl: string,
  isMainFrame: boolean,
  trustedRendererUrl: string
): boolean {
  return isMainFrame && isTrustedRendererUrl(candidateUrl, trustedRendererUrl)
}

export function assertTrustedIpcSender(
  event: IpcMainInvokeEvent,
  trustedWebContents: WebContents | null,
  trustedRendererUrl: string | null
): void {
  if (
    !trustedWebContents
    || trustedWebContents.isDestroyed()
    || !trustedRendererUrl
    || event.sender !== trustedWebContents
  ) {
    throw new Error('Rejected IPC invocation from an untrusted webContents')
  }

  const senderFrame = event.senderFrame
  if (!senderFrame || senderFrame !== trustedWebContents.mainFrame) {
    throw new Error('Rejected IPC invocation from a non-main renderer frame')
  }

  if (
    !isTrustedRendererUrl(senderFrame.url, trustedRendererUrl)
    || !isTrustedRendererUrl(trustedWebContents.getURL(), trustedRendererUrl)
  ) {
    throw new Error('Rejected IPC invocation from an untrusted renderer URL')
  }
}

export function isAllowedVideoPermissionRequest(
  permission: string,
  details: PermissionRequestDetails,
  trustedRendererUrl: string
): boolean {
  return permission === 'media'
    && details.isMainFrame
    && typeof details.requestingUrl === 'string'
    && isTrustedRendererUrl(details.requestingUrl, trustedRendererUrl)
    && Array.isArray(details.mediaTypes)
    && details.mediaTypes.length > 0
    && details.mediaTypes.every((mediaType) => mediaType === 'video')
}

export function isAllowedVideoPermissionCheck(
  permission: string,
  details: PermissionCheckDetails,
  trustedRendererUrl: string
): boolean {
  return permission === 'media'
    && details.isMainFrame
    && details.mediaType === 'video'
    && typeof details.requestingUrl === 'string'
    && isTrustedRendererUrl(details.requestingUrl, trustedRendererUrl)
}
