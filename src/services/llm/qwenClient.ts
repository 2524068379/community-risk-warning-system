import { http } from '@/services/http';
import type { ChatCompletionsPayload, ChatCompletionsResponse } from './types';

const proxyPath = import.meta.env.VITE_QWEN_PROXY_PATH || '/api/qwen/chat/completions';
const model = import.meta.env.VITE_QWEN_MODEL || 'qwen3.5-vl';

export async function callQwenChat(
  payload: Omit<ChatCompletionsPayload, 'model'>
): Promise<ChatCompletionsResponse> {
  const response = await http.post<ChatCompletionsResponse>(proxyPath, {
    model,
    ...payload
  });

  return response.data;
}

/**
 * 多模态示例：
 * messages: [
 *   {
 *     role: 'user',
 *     content: [
 *       { type: 'text', text: '请分析这张图片中的社区风险。' },
 *       { type: 'image_url', image_url: { url: 'https://example.com/demo.jpg' } }
 *     ]
 *   }
 * ]
 */
export async function analyzeCommunityRiskFromImage(imageUrl: string) {
  return callQwenChat({
    temperature: 0.2,
    max_tokens: 1024,
    messages: [
      {
        role: 'system',
        content:
          '你是社区风险预警智能体，请识别社区场景中的消防、治安、人员求助、异常聚集、电动车违规充电等风险，并返回结构化结论。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '请分析这张图片中的社区风险，并给出风险等级、原因和建议处置措施。' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ]
  });
}
