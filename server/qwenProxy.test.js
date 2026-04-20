import { describe, expect, it } from 'vitest';
import { buildQwenRequestBody, isAllowedCorsOrigin, loadQwenProxyConfig } from './qwenProxy.js';

describe('qwenProxy', () => {
  it('normalizes config from environment variables', () => {
    const config = loadQwenProxyConfig({
      CORS_ORIGIN: 'http://localhost:5173, http://localhost:4173',
      QWEN_BASE_URL: 'http://127.0.0.1:1234/v1/',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'qwen-vl',
      QWEN_TIMEOUT: '12000'
    });

    expect(config.corsOrigin).toEqual(['http://localhost:5173', 'http://localhost:4173']);
    expect(config.qwenBaseUrl).toBe('http://127.0.0.1:1234/v1');
    expect(config.qwenApiKey).toBe('test-key');
    expect(config.qwenModel).toBe('qwen-vl');
    expect(config.qwenTimeout).toBe(12000);
  });

  it('uses the default model only when the request body omits model', () => {
    expect(buildQwenRequestBody({ messages: [] }, 'qwen-default')).toEqual({
      model: 'qwen-default',
      messages: []
    });

    expect(buildQwenRequestBody({ model: 'custom', messages: [] }, 'qwen-default')).toEqual({
      model: 'custom',
      messages: []
    });
  });

  it('allows Electron file origins without opening configured web origins broadly', () => {
    const allowedOrigins = ['http://localhost:5173'];

    expect(isAllowedCorsOrigin(undefined, allowedOrigins)).toBe(true);
    expect(isAllowedCorsOrigin('null', allowedOrigins)).toBe(true);
    expect(isAllowedCorsOrigin('file://', allowedOrigins)).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:5173', allowedOrigins)).toBe(true);
    expect(isAllowedCorsOrigin('https://example.com', allowedOrigins)).toBe(false);
  });
});
