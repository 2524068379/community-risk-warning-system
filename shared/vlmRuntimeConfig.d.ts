export interface VlmRuntimeConfig {
  host: string;
  port: number;
  modelAlias: string;
  gpuLayers: number;
  contextSize: number;
  batchSize: number;
  ubatchSize: number;
  cacheTypeK: string;
  cacheTypeV: string;
  startupTimeoutMs: number;
  mtpEnabled: boolean;
  mtpDraftTokens: number;
}

export declare function loadVlmRuntimeConfig(env?: NodeJS.ProcessEnv | Record<string, string | undefined>): VlmRuntimeConfig;
