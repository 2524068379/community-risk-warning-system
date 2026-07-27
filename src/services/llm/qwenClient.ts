import { http } from '@/services/http';
import type { ChatCompletionsPayload, ChatCompletionsResponse } from './types';
import { QWEN_CHAT_COMPLETIONS_ROUTE } from '../../../shared/apiRoutes.js';
import { DEFAULT_QWEN_VLM_API_MODEL } from '../../../shared/vlmModelConfig.js';

const proxyPath = import.meta.env.VITE_QWEN_PROXY_PATH || QWEN_CHAT_COMPLETIONS_ROUTE;
const model = import.meta.env.VITE_QWEN_MODEL || DEFAULT_QWEN_VLM_API_MODEL;

export async function callQwenChat(
  payload: Omit<ChatCompletionsPayload, 'model'>
): Promise<ChatCompletionsResponse> {
  const response = await http.post<ChatCompletionsResponse>(proxyPath, {
    model,
    ...payload
  });

  return response.data;
}
