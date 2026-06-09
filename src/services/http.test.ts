import { describe, expect, it } from 'vitest';
import { createApiAuthHeaderResolver, createApiBaseResolver, extractProxyErrorMessage } from './http';

describe('createApiBaseResolver', () => {
  it('waits for the Electron API base and caches the result', async () => {
    let calls = 0;
    const resolver = createApiBaseResolver({
      electronApi: {
        getApiBase: async () => {
          calls += 1;
          return 'http://localhost:4567';
        }
      }
    });

    await expect(resolver.getApiBase()).resolves.toBe('http://localhost:4567');
    await expect(resolver.getApiBase()).resolves.toBe('http://localhost:4567');
    expect(calls).toBe(1);
  });

  it('prefers an explicit environment base over Electron discovery', async () => {
    let calls = 0;
    const resolver = createApiBaseResolver({
      envBase: 'http://localhost:8787',
      electronApi: {
        getApiBase: async () => {
          calls += 1;
          return 'http://localhost:4567';
        }
      }
    });

    await expect(resolver.getApiBase()).resolves.toBe('http://localhost:8787');
    expect(calls).toBe(0);
  });

  it('does not cache an Electron API base before the proxy port is assigned', async () => {
    const bases = ['http://127.0.0.1:0', 'http://127.0.0.1:4567'];
    const resolver = createApiBaseResolver({
      electronApi: {
        getApiBase: async () => bases.shift()
      }
    });

    await expect(resolver.getApiBase()).resolves.toBeUndefined();
    await expect(resolver.getApiBase()).resolves.toBe('http://127.0.0.1:4567');
  });
});

describe('createApiAuthHeaderResolver', () => {
  it('waits for Electron auth headers and caches normalized non-empty values', async () => {
    let calls = 0;
    const resolver = createApiAuthHeaderResolver({
      electronApi: {
        getApiBase: async () => 'http://localhost:4567',
        getApiAuthHeaders: async () => {
          calls += 1;
          return {
            ' X-Local-Proxy-Token ': ' token ',
            Empty: ''
          };
        },
        getOllamaStatus: async () => ({
          ready: true,
          status: 'ready',
          baseUrl: 'http://127.0.0.1:11434',
          gpu: 'unknown'
        })
      }
    });

    await expect(resolver.getApiAuthHeaders()).resolves.toEqual({
      'X-Local-Proxy-Token': 'token'
    });
    await expect(resolver.getApiAuthHeaders()).resolves.toEqual({
      'X-Local-Proxy-Token': 'token'
    });
    expect(calls).toBe(1);
  });

  it('returns undefined when Electron does not provide auth headers', async () => {
    const resolver = createApiAuthHeaderResolver({
      electronApi: {
        getApiBase: async () => 'http://localhost:4567',
        getOllamaStatus: async () => ({
          ready: true,
          status: 'ready',
          baseUrl: 'http://127.0.0.1:11434',
          gpu: 'unknown'
        })
      }
    });

    await expect(resolver.getApiAuthHeaders()).resolves.toBeUndefined();
  });
});

describe('extractProxyErrorMessage', () => {
  it('extracts structured proxy error messages', () => {
    expect(extractProxyErrorMessage({
      error: {
        message: 'QWEN_BASE_URL 或 QWEN_API_KEY 未配置'
      }
    })).toBe('QWEN_BASE_URL 或 QWEN_API_KEY 未配置');
  });

  it('ignores malformed proxy error payloads', () => {
    expect(extractProxyErrorMessage({ error: { message: '' } })).toBeUndefined();
    expect(extractProxyErrorMessage({ message: 'top-level' })).toBeUndefined();
    expect(extractProxyErrorMessage(null)).toBeUndefined();
  });
});
