import { execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const vlmDir = join(__dirname, '..', 'resources', 'vlm')

const LLAMA_CPP_CUDA_ZIP = 'llama-b8864-bin-win-cuda-12.4-x64.zip'
const LLAMA_CPP_CUDA_URL = `https://github.com/ggml-org/llama.cpp/releases/download/b8864/${LLAMA_CPP_CUDA_ZIP}`
const CUDART_ZIP = 'cudart-llama-bin-win-cuda-12.4-x64.zip'
const CUDART_URL = `https://github.com/ggml-org/llama.cpp/releases/download/b8864/${CUDART_ZIP}`

const MODEL_URL = 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf'
const MMPROJ_URL = 'https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/mmproj-BF16.gguf'

const MODEL_FILE = 'Qwen3.5-4B-Q4_K_M.gguf'
const MMPROJ_FILE = 'mmproj-BF16.gguf'

function run(cmd) {
  console.log(`> ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

async function main() {
  mkdirSync(vlmDir, { recursive: true })

  const serverExe = join(vlmDir, 'llama-server.exe')
  const modelFile = join(vlmDir, MODEL_FILE)
  const mmprojFile = join(vlmDir, MMPROJ_FILE)

  if (!existsSync(serverExe)) {
    console.log('\n=== Downloading llama-server (CUDA build) ===')
    const llamaZip = join(vlmDir, LLAMA_CPP_CUDA_ZIP)
    const cudartZip = join(vlmDir, CUDART_ZIP)

    if (!existsSync(llamaZip)) {
      run(`curl -L -o "${llamaZip}" "${LLAMA_CPP_CUDA_URL}"`)
    }
    if (!existsSync(cudartZip)) {
      run(`curl -L -o "${cudartZip}" "${CUDART_URL}"`)
    }

    console.log('\n=== Extracting llama-server ===')
    run(`powershell -Command "Expand-Archive -Path '${llamaZip}' -DestinationPath '${vlmDir}' -Force"`)
    run(`powershell -Command "Expand-Archive -Path '${cudartZip}' -DestinationPath '${vlmDir}' -Force"`)

    console.log('llama-server.exe extracted')
  } else {
    console.log('llama-server.exe already exists, skipping download')
  }

  if (!existsSync(modelFile)) {
    console.log(`\n=== Downloading ${MODEL_FILE} (~2.55 GB) ===`)
    console.log('This may take a while...')
    run(`curl -L -o "${modelFile}" "${MODEL_URL}"`)
  } else {
    console.log(`${MODEL_FILE} already exists, skipping download`)
  }

  if (!existsSync(mmprojFile)) {
    console.log(`\n=== Downloading ${MMPROJ_FILE} (~644 MB) ===`)
    run(`curl -L -o "${mmprojFile}" "${MMPROJ_URL}"`)
  } else {
    console.log(`${MMPROJ_FILE} already exists, skipping download`)
  }

  console.log('\n=== Download complete ===')
  console.log(`Files in ${vlmDir}:`)
  try {
    run(`dir "${vlmDir}"`)
  } catch {
    run(`ls -lh "${vlmDir}"`)
  }
}

main().catch((err) => {
  console.error('Download failed:', err.message)
  process.exit(1)
})
