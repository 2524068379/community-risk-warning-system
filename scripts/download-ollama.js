import { createWriteStream, existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { get } from 'node:https'
import { execSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const resourcesDir = join(__dirname, '..', 'resources', 'ollama')
const ollamaExe = join(resourcesDir, 'ollama.exe')
const downloadUrl = 'https://ollama.com/download/ollama-windows-amd64.zip'

async function downloadOllama() {
  if (existsSync(ollamaExe)) {
    console.log('ollama.exe already exists at', ollamaExe)
    return
  }

  await mkdir(resourcesDir, { recursive: true })

  console.log('Downloading Ollama...')
  console.log('URL:', downloadUrl)

  try {
    execSync(`curl -L -o "${join(resourcesDir, 'ollama.zip')}" "${downloadUrl}"`, {
      stdio: 'inherit'
    })
    console.log('Download complete. Extracting...')
    execSync(`powershell -Command "Expand-Archive -Path '${join(resourcesDir, 'ollama.zip')}' -DestinationPath '${resourcesDir}' -Force"`, {
      stdio: 'inherit'
    })
    console.log('Ollama extracted to', resourcesDir)
  } catch (err) {
    console.error('Failed to download Ollama:', err.message)
    console.error('Please download manually from https://ollama.com/download and place ollama.exe in', resourcesDir)
  }
}

downloadOllama()
