import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function readWorkflow(name) {
  return fs.readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');
}

describe('build workflow', () => {
  it('runs tests and typecheck before the production build', () => {
    const workflow = readWorkflow('build.yml');

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
    const workflow = readWorkflow('build.yml');

    expect(workflow).toContain('IS_DEPENDABOT_PR');
    expect(workflow).toContain("if: env.IS_DEPENDABOT_PR != 'true'");
    expect(workflow).toContain("if: env.IS_DEPENDABOT_PR == 'true'");
    expect(workflow).toContain('Skipping Windows packaging for Dependabot pull requests.');
  });

  it('keeps Build & Release focused on app packaging without downloading model assets', () => {
    const workflow = readWorkflow('build.yml');

    expect(workflow).toContain('- name: Prepare CPU VLM runtime files');
    expect(workflow).toContain('- name: Cache CPU VLM runtime files');
    expect(workflow).toContain('npm run package:ci');
    expect(workflow).not.toContain('- name: Prepare VLM model files');
    expect(workflow).not.toContain('- name: Verify VLM model file hashes');
    expect(workflow).not.toContain('- name: Create VLM model package');
    expect(workflow).not.toContain('- name: Upload VLM model package');
    expect(workflow).not.toContain('Save-WithRetry $modelUrl $modelPath 600');
    expect(workflow).not.toContain('Save-WithRetry $mmprojUrl $mmprojPath 300');
    expect(workflow).not.toContain('Download model artifact');
  });

  it('only prepares CPU llama.cpp runtime files needed by the portable app', () => {
    const workflow = readWorkflow('build.yml');
    const prepareIndex = workflow.indexOf('- name: Prepare CPU VLM runtime files');
    const packageIndex = workflow.indexOf('- name: Package');
    const prepareBlock = workflow.slice(prepareIndex, packageIndex);

    expect(prepareIndex).toBeGreaterThan(-1);
    expect(prepareBlock).toContain('Missing VLM runtime files from cache/source');
    expect(prepareBlock).toContain('$runtimeVersion = "b9484-cuda-12.4"');
    expect(prepareBlock).toContain('Set-Content -Path $runtimeVersionPath -Value $runtimeVersion -NoNewline');
    expect(prepareBlock).toContain('Save-WithRetry $llamaUrl $llamaZip 300');
    expect(prepareBlock).toContain('llama-b9484-bin-win-cuda-12.4-x64.zip');
    expect(prepareBlock).toContain('ggml-cpu-x64.dll');
    expect(prepareBlock).not.toContain('cudart64_12.dll');
    expect(prepareBlock).not.toContain('cublas64_12.dll');
    expect(prepareBlock).not.toContain('ggml-cuda.dll');
    expect(prepareBlock).not.toContain('Qwen3.5-4B-Q4_K_M.gguf');
  });

  it('streams runtime downloads to disk instead of buffering response bytes in memory', () => {
    const workflow = readWorkflow('build.yml');
    const prepareIndex = workflow.indexOf('- name: Prepare CPU VLM runtime files');
    const packageIndex = workflow.indexOf('- name: Package');
    const prepareBlock = workflow.slice(prepareIndex, packageIndex);

    expect(prepareBlock).toContain('-OutFile $tmpPath');
    expect(prepareBlock).toContain('Move-Item $tmpPath $Path -Force');
    expect(prepareBlock).toContain('$downloadedSize = (Get-Item $Path).Length');
    expect(prepareBlock).not.toContain('WriteAllBytes');
    expect(prepareBlock).not.toContain('$response.Content');
  });

  it('verifies the portable app keeps runtime files but excludes VLM model files before uploading artifacts', () => {
    const workflow = readWorkflow('build.yml');

    const packageIndex = workflow.indexOf('- name: Package');
    const verifyIndex = workflow.indexOf('- name: Verify portable package VLM resources');
    const uploadIndex = workflow.indexOf('- name: Upload portable zip');

    expect(packageIndex).toBeGreaterThan(-1);
    expect(verifyIndex).toBeGreaterThan(packageIndex);
    expect(verifyIndex).toBeLessThan(uploadIndex);
    expect(workflow).toContain('Portable app package must not include VLM model file');
    expect(workflow).toContain('Portable app package must include VLM runtime file');
    expect(workflow).toContain('-not ($listing -match [regex]::Escape($f))');
    expect(workflow).toContain('Qwen3.5-4B-Q4_K_M.gguf');
    expect(workflow).toContain('mmproj-BF16.gguf');
  });

  it('verifies the portable app includes the CPU llama.cpp runtime files needed at launch', () => {
    const workflow = readWorkflow('build.yml');

    expect(workflow).toContain('Portable app package must include VLM runtime file');
    for (const f of ['llama-server.exe', 'llama-server-impl.dll', 'llama.dll', 'mtmd.dll', 'ggml-cpu-x64.dll', 'ggml-base.dll', 'libomp140.x86_64.dll']) {
      expect(workflow).toContain(f);
    }
  });

  it('asserts the portable package does NOT carry CUDA-only runtime DLLs because they ship via vlm-models.zip', () => {
    const workflow = readWorkflow('build.yml');

    expect(workflow).toContain('Portable app package must not include CUDA-only runtime file');
    for (const f of ['cudart64_12.dll', 'cublas64_12.dll', 'cublasLt64_12.dll', 'ggml-cuda.dll']) {
      expect(workflow).toContain(f);
    }
  });
});

describe('VLM models workflow', () => {
  it('is manually triggered, also runs after successful Build & Release, and produces only the separate vlm-models artifact', () => {
    const workflow = readWorkflow('vlm-models.yml');

    expect(workflow).toContain('name: VLM Models');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('workflow_run:');
    expect(workflow).toContain('workflows: ["Build & Release"]');
    expect(workflow).toContain('types: [completed]');
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event != 'pull_request'");
    expect(workflow).toContain("ref: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.ref }}");
    expect(workflow).not.toContain('push:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('- name: Upload VLM model package');
    expect(workflow).toContain('name: vlm-models');
    expect(workflow).not.toContain('npm run build');
    expect(workflow).not.toContain('npm run package');
  });

  it('repairs stale VLM caches by preparing runtime and model files before hashing', () => {
    const workflow = readWorkflow('vlm-models.yml');

    const cacheIndex = workflow.indexOf('- name: Cache VLM model files');
    const prepareIndex = workflow.indexOf('- name: Prepare VLM model files');
    const hashIndex = workflow.indexOf('- name: Verify VLM model file hashes');
    const prepareBlock = workflow.slice(prepareIndex, hashIndex);

    expect(cacheIndex).toBeGreaterThan(-1);
    expect(prepareIndex).toBeGreaterThan(cacheIndex);
    expect(hashIndex).toBeGreaterThan(prepareIndex);
    expect(prepareBlock).not.toContain("steps.cache-vlm.outputs.cache-hit != 'true'");
    expect(prepareBlock).toContain('Missing VLM runtime files from cache/source');
    expect(prepareBlock).toContain('$runtimeVersion = "b9484-cuda-12.4"');
    expect(prepareBlock).toContain('$hasCurrentRuntime');
    expect(prepareBlock).toContain('Set-Content -Path $runtimeVersionPath -Value $runtimeVersion -NoNewline');
    expect(prepareBlock).toContain('Save-WithRetry $llamaUrl $llamaZip 300');
    expect(prepareBlock).toContain('Save-WithRetry $modelUrl $modelPath 600');
    expect(prepareBlock).toContain('llama-b9484-bin-win-cuda-12.4-x64.zip');
  });

  it('streams large VLM downloads to disk instead of buffering response bytes in memory', () => {
    const workflow = readWorkflow('vlm-models.yml');
    const prepareIndex = workflow.indexOf('- name: Prepare VLM model files');
    const hashIndex = workflow.indexOf('- name: Verify VLM model file hashes');
    const prepareBlock = workflow.slice(prepareIndex, hashIndex);

    expect(prepareBlock).toContain('-OutFile $tmpPath');
    expect(prepareBlock).toContain('Move-Item $tmpPath $Path -Force');
    expect(prepareBlock).toContain('$downloadedSize = (Get-Item $Path).Length');
    expect(prepareBlock).not.toContain('WriteAllBytes');
    expect(prepareBlock).not.toContain('$response.Content');
  });

  it('ships model assets and CUDA runtime DLLs together in vlm-models.zip', () => {
    const workflow = readWorkflow('vlm-models.yml');

    expect(workflow).toContain('llama-server.exe、llama-server-impl.dll 与 CPU 通用 runtime DLL 已随 Windows portable 应用包发布。');
    expect(workflow).toContain('$modelFiles = @("Qwen3.5-4B-Q4_K_M.gguf", "mmproj-BF16.gguf")');
    expect(workflow).toContain('$cudaFiles = @("cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll", "ggml-cuda.dll")');
  });
});
