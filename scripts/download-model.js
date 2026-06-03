import { execSync } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LLAMA_CPP_CUDA_VERSION,
  LLAMA_CPP_VERSION,
  VLM_HAS_MMPROJ,
  VLM_MODEL_FILE,
  VLM_MODEL_SHA256,
  VLM_MODEL_URL,
  VLM_MMPROJ_FILE,
  VLM_MMPROJ_SHA256,
  VLM_MMPROJ_URL
} from '../shared/vlmModelConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const vlmDir = join(__dirname, '..', 'resources', 'vlm');

const LLAMA_CPP_CUDA_ZIP = `llama-${LLAMA_CPP_VERSION}-bin-win-cuda-${LLAMA_CPP_CUDA_VERSION}-x64.zip`;
const LLAMA_CPP_CUDA_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/${LLAMA_CPP_CUDA_ZIP}`;
const CUDART_ZIP = `cudart-llama-bin-win-cuda-${LLAMA_CPP_CUDA_VERSION}-x64.zip`;
const CUDART_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_CPP_VERSION}/${CUDART_ZIP}`;

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function verifySha256(filePath, expected) {
  const actual = await sha256File(filePath);
  if (actual !== expected) {
    throw new Error(`SHA256 mismatch for ${filePath}: expected ${expected}, got ${actual}`);
  }

  console.log(`Verified SHA256 for ${filePath}`);
}

async function main() {
  mkdirSync(vlmDir, { recursive: true });

  const serverExe = join(vlmDir, 'llama-server.exe');
  const modelFile = join(vlmDir, VLM_MODEL_FILE);
  const mmprojFile = join(vlmDir, VLM_MMPROJ_FILE);

  if (!existsSync(serverExe)) {
    console.log('\n=== Downloading llama-server (CUDA build) ===');
    const llamaZip = join(vlmDir, LLAMA_CPP_CUDA_ZIP);
    const cudartZip = join(vlmDir, CUDART_ZIP);

    if (!existsSync(llamaZip)) {
      run(`curl -L -o "${llamaZip}" "${LLAMA_CPP_CUDA_URL}"`);
    }
    if (!existsSync(cudartZip)) {
      run(`curl -L -o "${cudartZip}" "${CUDART_URL}"`);
    }

    console.log('\n=== Extracting llama-server ===');
    run(`powershell -Command "Expand-Archive -Path '${llamaZip}' -DestinationPath '${vlmDir}' -Force"`);
    run(`powershell -Command "Expand-Archive -Path '${cudartZip}' -DestinationPath '${vlmDir}' -Force"`);

    console.log('llama-server.exe extracted');
  } else {
    console.log('llama-server.exe already exists, skipping download');
  }

  if (!existsSync(modelFile)) {
    console.log(`\n=== Downloading ${VLM_MODEL_FILE} (~2.71 GB) ===`);
    console.log('This may take a while...');
    run(`curl -L -o "${modelFile}" "${VLM_MODEL_URL}"`);
  } else {
    console.log(`${VLM_MODEL_FILE} already exists, skipping download`);
  }
  await verifySha256(modelFile, VLM_MODEL_SHA256);

  if (VLM_HAS_MMPROJ) {
    if (!existsSync(mmprojFile)) {
      console.log(`\n=== Downloading ${VLM_MMPROJ_FILE} (~922 MB) ===`);
      run(`curl -L -o "${mmprojFile}" "${VLM_MMPROJ_URL}"`);
    } else {
      console.log(`${VLM_MMPROJ_FILE} already exists, skipping download`);
    }
    await verifySha256(mmprojFile, VLM_MMPROJ_SHA256);
  } else {
    console.log('No mmproj configured, skipping vision encoder download');
  }

  console.log('\n=== Download complete ===');
  console.log(`Files in ${vlmDir}:`);
  try {
    run(`dir "${vlmDir}"`);
  } catch {
    run(`ls -lh "${vlmDir}"`);
  }
}

main().catch((err) => {
  console.error('Download failed:', err.message);
  process.exit(1);
});
