export type LivePlayerStatus = 'idle' | 'ready' | 'buffering' | 'playing' | 'error';

export function mediaEventToPlayerStatus(eventType: string): LivePlayerStatus {
  if (eventType === 'playing') {
    return 'playing';
  }

  if (eventType === 'waiting' || eventType === 'stalled') {
    return 'buffering';
  }

  if (eventType === 'error') {
    return 'error';
  }

  return 'ready';
}
