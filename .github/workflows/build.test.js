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
    expect(workflow).toContain('Qwen3.5-4B.Q4_K_M.gguf');
    expect(workflow).toContain('mmproj-BF16.gguf');
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
    expect(workflow).toContain('$modelFiles = @("Qwen3.5-4B.Q4_K_M.gguf", "mmproj-BF16.gguf")');
    expect(workflow).toContain('$cudaFiles = @("cudart64_12.dll", "cublas64_12.dll", "cublasLt64_12.dll", "ggml-cuda.dll")');
  });
});
