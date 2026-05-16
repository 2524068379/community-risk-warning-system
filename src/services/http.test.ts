import { describe, expect, it } from 'vitest';
import { createApiBaseResolver } from './http';

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
