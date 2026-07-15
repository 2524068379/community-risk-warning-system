export declare const VLM_RESPONSE_FIELDS: readonly string[];

export declare const VLM_RESPONSE_SCHEMA: {
  readonly type: 'object';
  readonly additionalProperties: false;
  readonly required: readonly string[];
  readonly properties: Record<string, unknown>;
};

export declare const VLM_RESPONSE_FORMAT: {
  readonly type: 'json_schema';
  readonly schema: typeof VLM_RESPONSE_SCHEMA;
};
