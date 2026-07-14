import { describe, expect, it } from 'vitest';
import { shouldLoadRemoteBaiduMapSdk } from './baiduMap';

describe('Baidu map runtime isolation', () => {
  it('blocks the remote SDK in a privileged Electron renderer', () => {
    expect(shouldLoadRemoteBaiduMapSdk(true)).toBe(false);
  });

  it('keeps the browser-only map integration available', () => {
    expect(shouldLoadRemoteBaiduMapSdk(false)).toBe(true);
  });
});
