import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VLM_MODEL_ALIAS,
  DEFAULT_QWEN_VLM_API_MODEL,
  LLAMA_CPP_CUDA_VERSION,
  LLAMA_CPP_VERSION,
  VLM_HAS_MMPROJ,
  VLM_MODEL_FILE,
  VLM_MODEL_REPO,
  VLM_MODEL_SHA256,
  VLM_MODEL_URL,
  VLM_MMPROJ_FILE,
  VLM_MMPROJ_REPO,
  VLM_MMPROJ_SHA256,
  VLM_MMPROJ_URL
} from './vlmModelConfig.js';

describe('vlmModelConfig', () => {
  it('keeps the current Unsloth Qwen3.5 MTP model and bundled mmproj configuration', () => {
    expect(DEFAULT_VLM_MODEL_ALIAS).toBe('qwen3.5-4b-mtp:q4_k_m');
    expect(DEFAULT_QWEN_VLM_API_MODEL).toBe('qwen3-vl-plus');
    expect(VLM_MODEL_REPO).toBe('unsloth/Qwen3.5-4B-MTP-GGUF');
    expect(VLM_MODEL_FILE).toBe('Qwen3.5-4B-Q4_K_M.gguf');
    expect(VLM_MMPROJ_REPO).toBe('unsloth/Qwen3.5-4B-MTP-GGUF');
    expect(VLM_MMPROJ_FILE).toBe('mmproj-BF16.gguf');
    expect(VLM_MODEL_SHA256).toBe('3874209241c9a397e2f62cd3f70f80fd2dfbf0dfccb6838416bdb48a714e8630');
    expect(VLM_MMPROJ_SHA256).toBe('169ee40fb1e234ff38b2d814eb8633611a54b6f941f11b700d96dec02cb44ddf');
    expect(VLM_HAS_MMPROJ).toBe(true);
    expect(LLAMA_CPP_VERSION).toBe('b9484');
    expect(LLAMA_CPP_CUDA_VERSION).toBe('12.4');
  });

  it('derives Hugging Face download URLs from the shared repos and filenames', () => {
    expect(VLM_MODEL_URL).toBe(`https://huggingface.co/${VLM_MODEL_REPO}/resolve/main/${VLM_MODEL_FILE}`);
    expect(VLM_MMPROJ_URL).toBe(`https://huggingface.co/${VLM_MMPROJ_REPO}/resolve/main/${VLM_MMPROJ_FILE}`);
  });
});
