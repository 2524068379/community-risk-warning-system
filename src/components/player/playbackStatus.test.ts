import { describe, expect, it } from 'vitest';
import { mediaEventToPlayerStatus } from './playbackStatus';

describe('mediaEventToPlayerStatus', () => {
  it('maps successful playback events to playing', () => {
    expect(mediaEventToPlayerStatus('playing')).toBe('playing');
    expect(mediaEventToPlayerStatus('canplay')).toBe('ready');
  });

  it('maps buffering events separately from hard errors', () => {
    expect(mediaEventToPlayerStatus('waiting')).toBe('buffering');
    expect(mediaEventToPlayerStatus('stalled')).toBe('buffering');
    expect(mediaEventToPlayerStatus('error')).toBe('error');
  });
});
