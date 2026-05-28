export interface VlmRuntimeConfig {
  host: string;
  port: number;
  modelAlias: string;
  gpuLayers: number;
  contextSize: number;
  startupTimeoutMs: number;
}

export declare function loadVlmRuntimeConfig(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): VlmRuntimeConfig;
