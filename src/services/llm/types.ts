import type { OpenAICompatibleMessage } from '@/types';

export interface ChatCompletionsPayload {
  model: string;
  messages: OpenAICompatibleMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface ChatCompletionsResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
}
