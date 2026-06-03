import { describe, expect, it } from 'vitest';
import {
  DEFAULT_VLM_MODEL_ALIAS,
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
  it('keeps the current Qwen3.5 SOMPOA MTP model and HauhauCS mmproj configuration', () => {
    expect(DEFAULT_VLM_MODEL_ALIAS).toBe('qwen3.5-4b-sompoa-heresy-v2-mtp:q4_k_m');
    expect(VLM_MODEL_REPO).toBe('aLKHoEbI/Qwen3.5-4B-SOMPOA-heresy-v2-MTP-Q4_K_M-GGUF');
    expect(VLM_MODEL_FILE).toBe('qwen3.5-4b-sompoa-heresy-v2-mtp-q4_k_m.gguf');
    expect(VLM_MMPROJ_REPO).toBe('HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive');
    expect(VLM_MMPROJ_FILE).toBe('mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf');
    expect(VLM_MODEL_SHA256).toBe('11072ba67c42d3309ca0634654492666b2ccb12de238677aeb34ca566e612696');
    expect(VLM_MMPROJ_SHA256).toBe('05f662501f8bd45607b079723a3e238a4e888fd085a10a53f4057a0e250f6934');
    expect(VLM_HAS_MMPROJ).toBe(true);
    expect(LLAMA_CPP_VERSION).toBe('b9484');
    expect(LLAMA_CPP_CUDA_VERSION).toBe('12.4');
  });

  it('derives Hugging Face download URLs from the shared repos and filenames', () => {
    expect(VLM_MODEL_URL).toBe(`https://huggingface.co/${VLM_MODEL_REPO}/resolve/main/${VLM_MODEL_FILE}`);
    expect(VLM_MMPROJ_URL).toBe(`https://huggingface.co/${VLM_MMPROJ_REPO}/resolve/main/${VLM_MMPROJ_FILE}`);
  });
});
