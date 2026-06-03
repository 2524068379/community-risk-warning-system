export const DEFAULT_VLM_MODEL_ALIAS = 'qwen3.5-4b-sompoa-heresy-v2-mtp:q4_k_m';
export const VLM_MODEL_REPO = 'aLKHoEbI/Qwen3.5-4B-SOMPOA-heresy-v2-MTP-Q4_K_M-GGUF';
export const VLM_MODEL_FILE = 'qwen3.5-4b-sompoa-heresy-v2-mtp-q4_k_m.gguf';
export const VLM_MMPROJ_REPO = 'HauhauCS/Qwen3.5-9B-Uncensored-HauhauCS-Aggressive';
export const VLM_MMPROJ_FILE = 'mmproj-Qwen3.5-9B-Uncensored-HauhauCS-Aggressive-BF16.gguf';
export const VLM_MODEL_SHA256 = '11072ba67c42d3309ca0634654492666b2ccb12de238677aeb34ca566e612696';
export const VLM_MMPROJ_SHA256 = '05f662501f8bd45607b079723a3e238a4e888fd085a10a53f4057a0e250f6934';
export const VLM_HAS_MMPROJ = Boolean(VLM_MMPROJ_FILE);
export const LLAMA_CPP_VERSION = 'b9484';
export const LLAMA_CPP_CUDA_VERSION = '12.4';

export const VLM_MODEL_URL = `https://huggingface.co/${VLM_MODEL_REPO}/resolve/main/${VLM_MODEL_FILE}`;
export const VLM_MMPROJ_URL = VLM_HAS_MMPROJ
  ? `https://huggingface.co/${VLM_MMPROJ_REPO}/resolve/main/${VLM_MMPROJ_FILE}`
  : '';
