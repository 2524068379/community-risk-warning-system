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
});
