import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('build workflow', () => {
  it('runs tests and typecheck before the production build', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    const testIndex = workflow.indexOf('npm run test');
    const typecheckIndex = workflow.indexOf('npm run typecheck');
    const buildIndex = workflow.indexOf('npm run build');

    expect(testIndex).toBeGreaterThan(-1);
    expect(typecheckIndex).toBeGreaterThan(-1);
    expect(buildIndex).toBeGreaterThan(-1);
    expect(testIndex).toBeLessThan(buildIndex);
    expect(typecheckIndex).toBeLessThan(buildIndex);
  });

  it('skips heavyweight packaging steps for Dependabot pull requests', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('IS_DEPENDABOT_PR');
    expect(workflow).toContain("if: env.IS_DEPENDABOT_PR != 'true'");
    expect(workflow).toContain("if: env.IS_DEPENDABOT_PR == 'true'");
    expect(workflow).toContain('Skipping VLM download and Windows packaging for Dependabot pull requests.');
  });

  it('repairs stale VLM caches by preparing runtime and model files before hashing', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    const cacheIndex = workflow.indexOf('- name: Cache VLM model files');
    const prepareIndex = workflow.indexOf('- name: Prepare VLM model files');
    const hashIndex = workflow.indexOf('- name: Verify VLM model file hashes');
    const prepareBlock = workflow.slice(prepareIndex, hashIndex);

    expect(cacheIndex).toBeGreaterThan(-1);
    expect(prepareIndex).toBeGreaterThan(cacheIndex);
    expect(hashIndex).toBeGreaterThan(prepareIndex);
    expect(prepareBlock).toContain("if: env.IS_DEPENDABOT_PR != 'true'");
    expect(prepareBlock).not.toContain("steps.cache-vlm.outputs.cache-hit != 'true'");
    expect(prepareBlock).toContain('Missing VLM runtime files from cache/source');
    expect(prepareBlock).toContain('Save-WithRetry $llamaUrl $llamaZip 300');
    expect(prepareBlock).toContain('Save-WithRetry $modelUrl $modelPath 600');
    expect(prepareBlock).toContain('llama-b9484-bin-win-cuda-12.4-x64.zip');
  });

  it('streams large VLM downloads to disk instead of buffering response bytes in memory', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');
    const prepareIndex = workflow.indexOf('- name: Prepare VLM model files');
    const hashIndex = workflow.indexOf('- name: Verify VLM model file hashes');
    const prepareBlock = workflow.slice(prepareIndex, hashIndex);

    expect(prepareBlock).toContain('-OutFile $tmpPath');
    expect(prepareBlock).toContain('Move-Item $tmpPath $Path -Force');
    expect(prepareBlock).toContain('$downloadedSize = (Get-Item $Path).Length');
    expect(prepareBlock).not.toContain('WriteAllBytes');
    expect(prepareBlock).not.toContain('$response.Content');
  });

  it('verifies the portable app keeps runtime files but excludes VLM model files before uploading artifacts', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    const packageIndex = workflow.indexOf('- name: Package');
    const verifyIndex = workflow.indexOf('- name: Verify portable package VLM resources');
    const uploadIndex = workflow.indexOf('- name: Upload portable zip');

    expect(packageIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(packageIndex);
    expect(verifyIndex).toBeLessThan(uploadIndex);
    expect(workflow).toContain('Portable app package must not include VLM model file');
    expect(workflow).toContain('Portable app package must include VLM runtime file');
    expect(workflow).toContain('-not ($listing -match [regex]::Escape($f))');
    expect(workflow).toContain('qwen3.5-4b-sompoa-heresy-v2-mtp-q4_k_m.gguf');
    expect(workflow).toContain('mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf');
  });

  it('verifies the portable app includes the CPU llama.cpp runtime files needed at launch', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('Portable app package must include VLM runtime file');
    for (const f of ['llama-server.exe', 'llama.dll', 'mtmd.dll', 'ggml-cpu-x64.dll', 'ggml-base.dll', 'libomp140.x86_64.dll']) {
      expect(workflow).toContain(f);
    }
  });

  it('asserts the portable package does NOT carry CUDA-only runtime DLLs because they ship via vlm-models.zip', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('Portable app package must not include CUDA-only runtime file');
    for (const f of ['cudart64_12.dll', 'cublas64_12.dll', 'cublasLt64_12.dll', 'ggml-cuda.dll']) {
      expect(workflow).toContain(f);
    }
  });

  it('ships model assets and CUDA runtime DLLs together in vlm-models.zip', () => {
    const workflow = fs.readFileSync(new URL('./build.yml', import.meta.url), 'utf8');

    expect(workflow).toContain('llama-server.exe 与 CPU 通用 runtime DLL 已随 Windows portable 应用包发布。');
    expect(workflow).toContain('$modelFiles = @("qwen3.5-4b-sompoa-heresy-v2-mtp-q4_k_m.gguf", "mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf")');
    expect(workflow).toContain('$cudaFiles = @("cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll", "ggml-cuda.dll")');
  });
});
