export const GPU_AVAILABILITY_UNKNOWN = 'unknown';

export function resolveOllamaHealthStatus(statusCode) {
  if (statusCode >= 200 && statusCode < 300) {
    return { ready: true, status: 'ready', gpu: GPU_AVAILABILITY_UNKNOWN };
  }

  if (statusCode === 503) {
    return { ready: false, status: 'loading', gpu: GPU_AVAILABILITY_UNKNOWN };
  }

  return { ready: false, status: 'error', gpu: GPU_AVAILABILITY_UNKNOWN };
}
