import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveVlmResourceDir } from './vlmResourcePath'

describe('resolveVlmResourceDir', () => {
  it('uses resources\\vlm next to the exe in packaged builds', () => {
    const exePath = path.join('C:', 'apps', 'risk-warning', 'risk-warning.exe')

    expect(resolveVlmResourceDir({
      isPackaged: true,
      exePath,
      appPath: path.join('C:', 'repo', 'community-risk-warning-system')
    })).toBe(path.join('C:', 'apps', 'risk-warning', 'resources', 'vlm'))
  })

  it('uses resources\\vlm under the app path in development', () => {
    const appPath = path.join('C:', 'repo', 'community-risk-warning-system')

    expect(resolveVlmResourceDir({
      isPackaged: false,
      exePath: path.join('C:', 'Electron', 'electron.exe'),
      appPath
    })).toBe(path.join(appPath, 'resources', 'vlm'))
  })
})
