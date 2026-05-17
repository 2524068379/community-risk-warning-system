import path from 'node:path'

interface ResolveVlmResourceDirOptions {
  isPackaged: boolean
  exePath: string
  appPath: string
}

export function resolveVlmResourceDir(options: ResolveVlmResourceDirOptions): string {
  const baseDir = options.isPackaged
    ? path.join(path.dirname(options.exePath), 'resources')
    : path.join(options.appPath, 'resources')

  return path.join(baseDir, 'vlm')
}
