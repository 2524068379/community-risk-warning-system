import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LLAMA_CPP_VERSION,
  VLM_HAS_MMPROJ,
  VLM_MODEL_FILE,
  VLM_MODEL_REPO,
  VLM_MODEL_SHA256,
  VLM_MMPROJ_FILE,
  VLM_MMPROJ_REPO,
  VLM_MMPROJ_SHA256
} from '../shared/vlmModelConfig.js';

const oldSompoaRepo = 'aLKHoEbI/Qwen3.5-4B-SOMPOA-heresy-v2-MTP-Q4_K_M-GGUF';
const oldSompoaModelFile = 'qwen3.5-4b-sompoa-heresy-v2-mtp-q4_k_m.gguf';
const oldHauhaucsRepo = 'HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive';
const oldHauhaucsMmproj = 'mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf';
const oldJackrongRepo = 'Jackrong/Qwen3.5-4B-Claude-4.6-Opus-Reasoning-Distilled-v2-GGUF';

function read(path) {
  return readFileSync(path, 'utf8');
}

describe('VLM model packaging configuration', () => {
  it('downloads the configured Qwen GGUF and bundled mmproj in the GitHub build workflow', () => {
    const workflow = read('.github/workflows/build.yml');

    expect(workflow).toContain(VLM_MODEL_REPO);
    expect(workflow).toContain(VLM_MODEL_FILE);
    expect(workflow).toContain(VLM_MMPROJ_REPO);
    expect(workflow).toContain(VLM_MMPROJ_FILE);
    expect(workflow).toContain(VLM_MODEL_SHA256);
    expect(workflow).toContain(VLM_MMPROJ_SHA256);
    expect(workflow).toContain(LLAMA_CPP_VERSION);
    expect(VLM_HAS_MMPROJ).toBe(true);
    expect(workflow.indexOf('Verify VLM model file hashes')).toBeGreaterThan(
      workflow.indexOf('Prepare VLM model files')
    );
    expect(workflow.indexOf('Verify VLM model file hashes')).toBeLessThan(workflow.indexOf('- name: Build'));
    expect(workflow).not.toContain(oldSompoaRepo);
    expect(workflow).not.toContain(oldSompoaModelFile);
    expect(workflow).not.toContain(oldHauhaucsRepo);
    expect(workflow).not.toContain(oldHauhaucsMmproj);
    expect(workflow).not.toContain(oldJackrongRepo);
  });

  it('keeps local download and Electron startup model filenames on shared config', () => {
    const downloadScript = read('scripts/download-model.js');
    const ollamaManager = read('electron/ollamaManager.ts');

    expect(downloadScript).toContain('../shared/vlmModelConfig.js');
    expect(downloadScript).toContain('VLM_MODEL_FILE');
    expect(downloadScript).toContain('VLM_MODEL_URL');
    expect(downloadScript).toContain('VLM_MODEL_SHA256');
    expect(downloadScript).toContain('VLM_MMPROJ_FILE');
    expect(downloadScript).toContain('VLM_MMPROJ_URL');
    expect(downloadScript).toContain('VLM_MMPROJ_SHA256');
    expect(downloadScript).toContain('LLAMA_CPP_VERSION');
    expect(downloadScript).toContain('.llama-cpp-runtime-version');
    expect(ollamaManager).toContain('../shared/vlmModelConfig.js');
    expect(ollamaManager).toContain('VLM_MODEL_FILE');
    expect(ollamaManager).toContain('VLM_MMPROJ_FILE');
    expect(downloadScript).not.toContain(oldSompoaRepo);
    expect(downloadScript).not.toContain(oldSompoaModelFile);
    expect(downloadScript).not.toContain(oldHauhaucsRepo);
    expect(downloadScript).not.toContain(oldHauhaucsMmproj);
    expect(ollamaManager).not.toContain(oldSompoaModelFile);
  });
});
