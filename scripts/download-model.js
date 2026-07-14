import { execSync } from 'node:child_process';
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LLAMA_CPP_CUDA_VERSION,
  LLAMA_CPP_CUDA_ZIP_SHA256,
  LLAMA_CPP_CUDART_ZIP_SHA256,
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
const RUNTIME_VERSION = `${LLAMA_CPP_VERSION}-cuda-${LLAMA_CPP_CUDA_VERSION}`;
const runtimeOnly = process.argv.includes('--runtime-only');
const REQUIRED_RUNTIME_FILES = [
  'llama-server.exe',
  'llama-server-impl.dll',
  'llama.dll',
  'llama-common.dll',
  'mtmd.dll',
  'ggml.dll',
  'ggml-base.dll',
  'ggml-rpc.dll',
  'ggml-cpu-x64.dll',
  'libomp140.x86_64.dll'
];
const REQUIRED_CUDA_FILES = ['cudart64_12.dll', 'cublas64_12.dll', 'cublasLt64_12.dll', 'ggml-cuda.dll'];

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

function quotePowerShellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function expandArchive(archivePath, destinationPath) {
  run(
    'powershell -NoProfile -Command "Expand-Archive -LiteralPath ' +
    `${quotePowerShellLiteral(archivePath)} -DestinationPath ${quotePowerShellLiteral(destinationPath)} -Force"`
  );
}

function removeIfExists(filePath) {
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

async function ensureVerifiedDownload(filePath, url, expectedSha256) {
  if (existsSync(filePath)) {
    try {
      await verifySha256(filePath, expectedSha256);
      return;
    } catch {
      console.warn(`Removing corrupt download: ${filePath}`);
      removeIfExists(filePath);
    }
  }

  const temporaryPath = `${filePath}.download`;
  removeIfExists(temporaryPath);
  try {
    run(`curl --fail --location --retry 3 -o "${temporaryPath}" "${url}"`);
    await verifySha256(temporaryPath, expectedSha256);
    renameSync(temporaryPath, filePath);
  } catch (error) {
    removeIfExists(temporaryPath);
    throw error;
  }
}

function assertFilesExist(fileNames, label) {
  const missing = fileNames.filter((fileName) => !existsSync(join(vlmDir, fileName)));
  if (missing.length > 0) {
    throw new Error(`${label} is incomplete; missing: ${missing.join(', ')}`);
  }
}

async function main() {
  mkdirSync(vlmDir, { recursive: true });

  const runtimeVersionFile = join(vlmDir, '.llama-cpp-runtime-version');
  const modelFile = join(vlmDir, VLM_MODEL_FILE);
  const mmprojFile = join(vlmDir, VLM_MMPROJ_FILE);
  const hasCurrentRuntime = REQUIRED_RUNTIME_FILES.every((fileName) => existsSync(join(vlmDir, fileName)))
    && existsSync(runtimeVersionFile)
    && readFileSync(runtimeVersionFile, 'utf8').trim() === RUNTIME_VERSION;
  const needsCudaBackend = !runtimeOnly && !existsSync(join(vlmDir, 'ggml-cuda.dll'));

  if (!hasCurrentRuntime || needsCudaBackend) {
    console.log(`\n=== Downloading llama-server ${RUNTIME_VERSION} ===`);
    const llamaZip = join(vlmDir, LLAMA_CPP_CUDA_ZIP);
    await ensureVerifiedDownload(llamaZip, LLAMA_CPP_CUDA_URL, LLAMA_CPP_CUDA_ZIP_SHA256);

    console.log('\n=== Extracting llama-server ===');
    expandArchive(llamaZip, vlmDir);
    assertFilesExist(REQUIRED_RUNTIME_FILES, 'llama.cpp runtime');
    writeFileSync(runtimeVersionFile, `${RUNTIME_VERSION}\n`);
    removeIfExists(llamaZip);
    console.log(needsCudaBackend && hasCurrentRuntime
      ? 'llama.cpp CUDA backend restored'
      : 'llama-server.exe extracted');
  } else {
    console.log(`llama-server ${RUNTIME_VERSION} already exists, skipping download`);
  }

  if (!runtimeOnly && !REQUIRED_CUDA_FILES.every((fileName) => existsSync(join(vlmDir, fileName)))) {
    console.log(`\n=== Downloading CUDA ${LLAMA_CPP_CUDA_VERSION} runtime ===`);
    const cudartZip = join(vlmDir, CUDART_ZIP);
    await ensureVerifiedDownload(cudartZip, CUDART_URL, LLAMA_CPP_CUDART_ZIP_SHA256);
    expandArchive(cudartZip, vlmDir);
    assertFilesExist(REQUIRED_CUDA_FILES, 'CUDA runtime');
    removeIfExists(cudartZip);
  }

  if (runtimeOnly) {
    console.log('\n=== Runtime-only download complete ===');
    return;
  }

  console.log(`\n=== Ensuring ${VLM_MODEL_FILE} (~2.83 GB) ===`);
  console.log('This may take a while...');
  await ensureVerifiedDownload(modelFile, VLM_MODEL_URL, VLM_MODEL_SHA256);

  if (VLM_HAS_MMPROJ) {
    console.log(`\n=== Ensuring ${VLM_MMPROJ_FILE} (~676 MB) ===`);
    await ensureVerifiedDownload(mmprojFile, VLM_MMPROJ_URL, VLM_MMPROJ_SHA256);
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
