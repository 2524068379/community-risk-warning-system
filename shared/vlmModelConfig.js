export const DEFAULT_VLM_MODEL_ALIAS = 'qwen3.5-4b-mtp:q4_k_m';
export const DEFAULT_QWEN_VLM_API_MODEL = 'qwen3-vl-plus';
export const VLM_MODEL_REPO = 'unsloth/Qwen3.5-4B-MTP-GGUF';
export const VLM_MODEL_FILE = 'Qwen3.5-4B-Q4_K_M.gguf';
export const VLM_MMPROJ_REPO = 'unsloth/Qwen3.5-4B-MTP-GGUF';
export const VLM_MMPROJ_FILE = 'mmproj-BF16.gguf';
export const VLM_MODEL_SHA256 = '3874209241c9a397e2f62cd3f70f80fd2dfbf0dfccb6838416bdb48a714e8630';
export const VLM_MMPROJ_SHA256 = '169ee40fb1e234ff38b2d814eb8633611a54b6f941f11b700d96dec02cb44ddf';
export const VLM_HAS_MMPROJ = Boolean(VLM_MMPROJ_FILE);
export const LLAMA_CPP_VERSION = 'b9484';
export const LLAMA_CPP_CUDA_VERSION = '12.4';
export const LLAMA_CPP_CUDA_ZIP_SHA256 = '0bcaf3a067c42fe5b49a2c867282ef9332efba42cec78fa04d53497057b93ca7';
export const LLAMA_CPP_CUDART_ZIP_SHA256 = '8c79a9b226de4b3cacfd1f83d24f962d0773be79f1e7b75c6af4ded7e32ae1d6';

export const VLM_MODEL_URL = `https://huggingface.co/${VLM_MODEL_REPO}/resolve/main/${VLM_MODEL_FILE}`;
export const VLM_MMPROJ_URL = VLM_HAS_MMPROJ
  ? `https://huggingface.co/${VLM_MMPROJ_REPO}/resolve/main/${VLM_MMPROJ_FILE}`
  : '';
