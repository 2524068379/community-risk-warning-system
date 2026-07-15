export const API_HEALTH_ROUTE = '/api/health';
export const QWEN_CHAT_COMPLETIONS_ROUTE = '/api/qwen/chat/completions';
export const OLLAMA_CHAT_COMPLETIONS_ROUTE = '/api/ollama/chat/completions';
export const OLLAMA_STATUS_ROUTE = '/api/ollama/status';

export const DEFAULT_QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
export const DEFAULT_QWEN_VLM_API_MODEL = 'qwen3-vl-plus';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';
const SSE_CONTENT_TYPE = 'text/event-stream';
const DEFAULT_QWEN_TIMEOUT_MS = 60000;
const MAX_QWEN_TIMEOUT_MS = 110000;
const UPSTREAM_HEADER_TIMEOUT_MS = 8000;
const DEFAULT_REQUEST_BODY_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_CHAT_MESSAGES = 16;
const DEFAULT_MAX_CHAT_TOKENS = 2048;
const DEFAULT_MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
const MAX_UPSTREAM_RESPONSE_BYTES = 8 * 1024 * 1024;
const DISALLOWED_TOKEN_LIMIT_FIELDS = [
  'max_completion_tokens',
  'max_output_tokens',
  'max_new_tokens',
  'num_predict',
  'n_predict'
];
const VLM_API_PROFILES = {
  DASHSCOPE: 'dashscope',
  JSON_OBJECT: 'json-object',
  GENERIC: 'generic'
};
const PRIVATE_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.home.arpa'];

function normalizeRuntimeEnv(runtimeEnv = {}) {
  return runtimeEnv && typeof runtimeEnv === 'object' && !Array.isArray(runtimeEnv)
    ? runtimeEnv
    : {};
}

let generatedEnvPromise;

async function loadGeneratedEnv() {
  generatedEnvPromise ??= import('./env.generated.js')
    .then((module) => normalizeRuntimeEnv(module.default))
    .catch(() => ({}));

  return generatedEnvPromise;
}

function getEnv(runtimeEnv = {}, generatedEnv = {}) {
  const processEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  return {
    ...normalizeRuntimeEnv(generatedEnv),
    ...processEnv,
    ...normalizeRuntimeEnv(runtimeEnv)
  };
}

function normalizePublicHttpsUrl(rawUrl) {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase().replace(/\.+$/, '');
    const unbracketedHostname = hostname.replace(/^\[|\]$/g, '');
    const isIpLiteral = unbracketedHostname.includes(':') || /^\d+(?:\.\d+){0,3}$/.test(hostname);
    const isPrivateName = hostname === 'localhost' ||
      PRIVATE_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));

    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !hostname.includes('.') ||
      isIpLiteral ||
      isPrivateName
    ) {
      return '';
    }

    url.hostname = hostname;
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

export function resolveConfiguredVlmBaseUrl(rawUrl = DEFAULT_QWEN_BASE_URL) {
  return normalizePublicHttpsUrl(rawUrl);
}

// Backward-compatible export for existing tests and integrations.
export function resolveAllowedQwenBaseUrl(rawUrl = DEFAULT_QWEN_BASE_URL) {
  return resolveConfiguredVlmBaseUrl(rawUrl);
}

function buildChatCompletionsUrl(baseUrl) {
  if (!baseUrl) return '';
  const url = new URL(baseUrl);
  if (!url.pathname.endsWith('/chat/completions')) {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/completions`;
  }
  return url.toString();
}

function resolveConfiguredVlmEndpoint(rawBaseUrl, rawChatCompletionsUrl = '') {
  const baseUrl = normalizePublicHttpsUrl(rawBaseUrl || DEFAULT_QWEN_BASE_URL);
  const chatCompletionsUrl = rawChatCompletionsUrl
    ? normalizePublicHttpsUrl(rawChatCompletionsUrl)
    : buildChatCompletionsUrl(baseUrl);
  return { baseUrl, chatCompletionsUrl };
}

function normalizeVlmApiProfile(rawProfile, baseUrl) {
  const profile = String(rawProfile || '').trim().toLowerCase();
  if (profile) {
    return Object.values(VLM_API_PROFILES).includes(profile) ? profile : '';
  }

  if (baseUrl) {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname === 'dashscope.aliyuncs.com' || /^dashscope-[a-z0-9-]+\.aliyuncs\.com$/.test(hostname)) {
      return VLM_API_PROFILES.DASHSCOPE;
    }
  }

  return VLM_API_PROFILES.GENERIC;
}

function parseInteger(value, fallback, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function parseByteLimit(value, fallback = DEFAULT_REQUEST_BODY_BYTES) {
  const match = String(value || '').trim().toLowerCase().match(/^(\d+)\s*(b|kb|mb)?$/);
  if (!match) {
    return fallback;
  }

  const units = { b: 1, kb: 1024, mb: 1024 * 1024 };
  const bytes = Number(match[1]) * units[match[2] || 'b'];
  return Number.isSafeInteger(bytes) && bytes >= 1024 && bytes <= MAX_REQUEST_BODY_BYTES
    ? bytes
    : fallback;
}

function parseTimeout(value) {
  return parseInteger(value, DEFAULT_QWEN_TIMEOUT_MS, 15000, MAX_QWEN_TIMEOUT_MS);
}

const VLM_CONFIG_NAMESPACES = [
  {
    baseUrl: 'ESA_VLM_API_BASE_URL',
    chatCompletionsUrl: 'ESA_VLM_CHAT_COMPLETIONS_URL',
    apiKey: 'ESA_VLM_API_KEY',
    model: 'ESA_VLM_MODEL',
    timeout: 'ESA_VLM_TIMEOUT',
    apiProfile: 'ESA_VLM_API_PROFILE'
  },
  {
    baseUrl: 'QWEN_BASE_URL',
    chatCompletionsUrl: 'QWEN_CHAT_COMPLETIONS_URL',
    apiKey: 'QWEN_API_KEY',
    model: 'QWEN_MODEL',
    timeout: 'QWEN_TIMEOUT',
    apiProfile: 'QWEN_API_PROFILE'
  },
  {
    baseUrl: 'DASHSCOPE_BASE_URL',
    chatCompletionsUrl: '',
    apiKey: 'DASHSCOPE_API_KEY',
    model: 'DASHSCOPE_MODEL',
    timeout: 'DASHSCOPE_TIMEOUT',
    apiProfile: ''
  }
];

function readEnvValue(env, key) {
  return key ? String(env[key] || '').trim() : '';
}

function selectVlmConfigNamespace(env) {
  // An explicitly configured endpoint always owns its credentials. If there is
  // no endpoint, prefer a namespace containing a key, then any legacy options.
  // This preserves default-DashScope compatibility without ever combining a
  // third-party URL with a secret from another provider namespace.
  return VLM_CONFIG_NAMESPACES.find((namespace) =>
    readEnvValue(env, namespace.chatCompletionsUrl) || (
      readEnvValue(env, namespace.baseUrl) &&
      normalizePublicHttpsUrl(readEnvValue(env, namespace.baseUrl)) !== DEFAULT_QWEN_BASE_URL
    )
  ) || VLM_CONFIG_NAMESPACES.find((namespace) =>
    readEnvValue(env, namespace.apiKey)
  ) || VLM_CONFIG_NAMESPACES.find((namespace) =>
    Object.values(namespace).some((key) => readEnvValue(env, key))
  ) || VLM_CONFIG_NAMESPACES[1];
}

export function loadPagesApiConfig(env = getEnv()) {
  const namespace = selectVlmConfigNamespace(env);
  const endpoint = resolveConfiguredVlmEndpoint(
    readEnvValue(env, namespace.baseUrl) || DEFAULT_QWEN_BASE_URL,
    readEnvValue(env, namespace.chatCompletionsUrl)
  );

  return {
    baseUrl: endpoint.baseUrl,
    chatCompletionsUrl: endpoint.chatCompletionsUrl,
    apiProfile: normalizeVlmApiProfile(
      readEnvValue(env, namespace.apiProfile),
      endpoint.chatCompletionsUrl || endpoint.baseUrl
    ),
    apiKey: readEnvValue(env, namespace.apiKey),
    model: readEnvValue(env, namespace.model) || DEFAULT_QWEN_VLM_API_MODEL,
    timeoutMs: parseTimeout(readEnvValue(env, namespace.timeout)),
    requestBodyBytes: parseByteLimit(env.REQUEST_BODY_LIMIT),
    maxChatMessages: parseInteger(
      env.MAX_CHAT_MESSAGES,
      DEFAULT_MAX_CHAT_MESSAGES,
      1,
      128
    ),
    maxChatTokens: parseInteger(
      env.MAX_CHAT_TOKENS,
      DEFAULT_MAX_CHAT_TOKENS,
      1,
      32768
    ),
    maxUpstreamResponseBytes: parseInteger(
      env.MAX_UPSTREAM_RESPONSE_BYTES,
      DEFAULT_MAX_UPSTREAM_RESPONSE_BYTES,
      1024,
      MAX_UPSTREAM_RESPONSE_BYTES
    )
  };
}

function normalizeCorsOrigins(rawOrigin = '') {
  return String(rawOrigin || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsHeaders(request, env = getEnv()) {
  const origin = request.headers.get('origin');
  if (!origin) {
    return {};
  }

  const requestOrigin = new URL(request.url).origin;
  const extraOrigins = normalizeCorsOrigins(env.CORS_ORIGIN);
  if (origin !== requestOrigin && !extraOrigins.includes(origin)) {
    return {};
  }

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-expose-headers': 'X-VLM-Source',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function jsonResponse(request, body, status = 200, extraHeaders = {}, env = getEnv()) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': JSON_CONTENT_TYPE,
      'cache-control': 'no-store',
      ...buildCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function methodNotAllowed(request, allow, env = getEnv()) {
  return jsonResponse(request, {
    error: {
      message: 'Method not allowed',
      type: 'method_not_allowed'
    }
  }, 405, { allow }, env);
}

export function validateChatCompletionPayload(body, config = loadPagesApiConfig({})) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return 'request body must be an object';
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return 'messages must be a non-empty array';
  }

  if (body.messages.length > config.maxChatMessages) {
    return 'messages exceeds the configured limit';
  }

  if (body.messages.some((message) => (
    !message ||
    typeof message !== 'object' ||
    Array.isArray(message) ||
    typeof message.role !== 'string' ||
    !Object.prototype.hasOwnProperty.call(message, 'content')
  ))) {
    return 'each message must contain role and content';
  }

  for (const field of DISALLOWED_TOKEN_LIMIT_FIELDS) {
    if (body[field] !== undefined) {
      return `${field} is not supported; use max_tokens`;
    }
  }

  for (const field of ['tools', 'tool_choice', 'functions', 'function_call', 'modalities', 'audio']) {
    if (body[field] !== undefined) {
      return `${field} is not supported by the VLM proxy`;
    }
  }

  if (body.stream !== undefined && body.stream !== false) {
    return 'client streaming responses are not supported';
  }

  if (body.n !== undefined && body.n !== 1) {
    return 'n must be 1';
  }

  if (body.best_of !== undefined && body.best_of !== 1) {
    return 'best_of must be 1';
  }

  if (body.max_tokens !== undefined && body.max_tokens !== null) {
    const maxTokens = Number(body.max_tokens);
    if (!Number.isInteger(maxTokens) || maxTokens < 1) {
      return 'max_tokens must be a positive integer';
    }

    if (maxTokens > config.maxChatTokens) {
      return 'max_tokens exceeds the configured limit';
    }
  }

  return '';
}

export function buildVlmApiRequestBody(
  body = {},
  model = DEFAULT_QWEN_VLM_API_MODEL,
  apiProfile = VLM_API_PROFILES.DASHSCOPE,
  maxChatTokens = DEFAULT_MAX_CHAT_TOKENS
) {
  if (!Object.values(VLM_API_PROFILES).includes(apiProfile)) {
    throw new Error('Unsupported VLM API profile');
  }

  const requestBody = {
    ...body,
    model,
    max_tokens: body.max_tokens === undefined || body.max_tokens === null
      ? maxChatTokens
      : Number(body.max_tokens),
    stream: true
  };

  delete requestBody.chat_template_kwargs;
  delete requestBody.best_of;
  for (const field of DISALLOWED_TOKEN_LIMIT_FIELDS) {
    delete requestBody[field];
  }

  if (apiProfile === VLM_API_PROFILES.GENERIC) {
    // Generic visual endpoints may not support OpenAI JSON mode. Rely on the
    // strict JSON prompt and validate the returned payload locally.
    delete requestBody.response_format;
    delete requestBody.enable_thinking;
  } else {
    // Cloud OpenAI-compatible APIs accept json_object rather than llama.cpp's
    // direct json_schema shape.
    requestBody.response_format = { type: 'json_object' };
    if (apiProfile === VLM_API_PROFILES.DASHSCOPE) {
      requestBody.enable_thinking = false;
    } else {
      delete requestBody.enable_thinking;
    }
  }

  return requestBody;
}

function createTimeoutError() {
  const error = new Error('VLM upstream response header timeout');
  error.name = 'TimeoutError';
  return error;
}

async function fetchConfiguredVlmEndpoint(url, init, timeoutMs) {
  const safeUrl = normalizePublicHttpsUrl(url);
  if (!safeUrl) {
    throw new Error('Unsupported VLM upstream endpoint');
  }

  const fetchPromise = fetch(safeUrl, {
    ...init,
    // Do not let a public endpoint redirect the edge subrequest to an internal host.
    redirect: 'error'
  });
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(createTimeoutError()), timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      // ESA does not document AbortController. Drain a late response when possible so
      // the request does not retain a response body after the local deadline.
      fetchPromise
        .then((response) => response.body?.cancel?.())
        .catch(() => {});
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function createBodyLimitError(message, type) {
  const error = new Error(message);
  error.name = 'BodyLimitError';
  error.type = type;
  return error;
}

async function readRequestBodyText(request, maxBytes) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw createBodyLimitError('request body exceeds the configured limit', 'request_too_large');
  }

  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw createBodyLimitError('request body exceeds the configured limit', 'request_too_large');
      }

      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function readRequestJson(request, maxBytes) {
  const text = await readRequestBodyText(request, maxBytes);
  return JSON.parse(text);
}

function createSseAccumulator() {
  const state = {
    id: '',
    requestId: '',
    created: undefined,
    model: '',
    systemFingerprint: undefined,
    content: '',
    reasoningContent: '',
    finishReason: null,
    usage: undefined,
    sawData: false
  };

  const consumeEvent = (eventText) => {
    const data = eventText
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
      .trim();

    if (!data || data === '[DONE]') {
      return;
    }

    const chunk = JSON.parse(data);
    if (!chunk || typeof chunk !== 'object' || Array.isArray(chunk)) {
      throw new Error('upstream SSE chunk must be a JSON object');
    }

    if (chunk.error) {
      const message = typeof chunk.error?.message === 'string'
        ? chunk.error.message
        : 'upstream returned an SSE error';
      throw new Error(message);
    }

    state.sawData = true;
    if (typeof chunk.id === 'string') state.id ||= chunk.id;
    if (typeof chunk.request_id === 'string') state.requestId ||= chunk.request_id;
    if (Number.isFinite(chunk.created)) state.created ??= chunk.created;
    if (typeof chunk.model === 'string') state.model ||= chunk.model;
    if (chunk.system_fingerprint !== undefined) {
      state.systemFingerprint ??= chunk.system_fingerprint;
    }
    if (chunk.usage && typeof chunk.usage === 'object' && !Array.isArray(chunk.usage)) {
      state.usage = chunk.usage;
    }

    if (!Array.isArray(chunk.choices)) {
      if (chunk.usage) return;
      throw new Error('upstream SSE chunk is missing choices');
    }

    if (chunk.choices.length === 0) {
      return;
    }

    if (chunk.choices.length !== 1 || chunk.choices[0]?.index !== 0) {
      throw new Error('upstream SSE must contain exactly one choice');
    }

    const choice = chunk.choices[0];
    const delta = choice.delta;
    if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
      throw new Error('upstream SSE choice is missing delta');
    }

    if (delta.role !== undefined && delta.role !== 'assistant') {
      throw new Error('upstream SSE role must be assistant');
    }
    if (delta.content !== undefined && delta.content !== null) {
      if (typeof delta.content !== 'string') {
        throw new Error('upstream SSE content must be text');
      }
      state.content += delta.content;
    }
    if (delta.reasoning_content !== undefined && delta.reasoning_content !== null) {
      if (typeof delta.reasoning_content !== 'string') {
        throw new Error('upstream SSE reasoning_content must be text');
      }
      state.reasoningContent += delta.reasoning_content;
    }
    if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
      state.finishReason = choice.finish_reason;
    }
  };

  const buildResponse = () => {
    if (!state.sawData) {
      throw new Error('upstream SSE response was empty');
    }

    const message = {
      role: 'assistant',
      content: state.content
    };
    if (state.reasoningContent) {
      message.reasoning_content = state.reasoningContent;
    }

    return {
      ...(state.id ? { id: state.id } : {}),
      ...(state.requestId ? { request_id: state.requestId } : {}),
      object: 'chat.completion',
      ...(state.created !== undefined ? { created: state.created } : {}),
      ...(state.model ? { model: state.model } : {}),
      choices: [{
        index: 0,
        message,
        finish_reason: state.finishReason,
        logprobs: null
      }],
      ...(state.usage ? { usage: state.usage } : {}),
      ...(state.systemFingerprint !== undefined
        ? { system_fingerprint: state.systemFingerprint }
        : {})
    };
  };

  return { consumeEvent, buildResponse };
}

function createStreamingErrorPayload(message, type) {
  return JSON.stringify({
    error: {
      message,
      type
    }
  });
}

function createSseAggregationTransform(timeoutMs, maxBytes) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const accumulator = createSseAccumulator();
  let buffer = '';
  let totalBytes = 0;
  let settled = false;
  let timer;

  const clearTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const endWithError = (controller, message, type, terminate = true) => {
    if (settled) return;
    settled = true;
    clearTimer();
    try {
      controller.enqueue(encoder.encode(createStreamingErrorPayload(message, type)));
      if (terminate && typeof controller.terminate === 'function') {
        controller.terminate();
      } else if (terminate) {
        controller.error(new Error(message));
      }
    } catch {
      // A simultaneous browser cancellation may have already closed the stream.
    }
  };

  const drainEvents = (flush = false) => {
    while (true) {
      const separator = /\r?\n\r?\n/.exec(buffer);
      if (!separator) break;
      const eventText = buffer.slice(0, separator.index);
      buffer = buffer.slice(separator.index + separator[0].length);
      accumulator.consumeEvent(eventText);
    }

    if (flush && buffer.trim()) {
      accumulator.consumeEvent(buffer);
      buffer = '';
    }
  };

  return {
    transformer: {
      start(controller) {
        // JSON permits leading whitespace. Sending it immediately satisfies ESA's
        // 10-second first-byte requirement while the SSE body is aggregated.
        controller.enqueue(encoder.encode('\n'));
        timer = setTimeout(() => {
          endWithError(controller, 'VLM 接口请求超时', 'timeout_error');
        }, timeoutMs);
      },
      transform(chunk, controller) {
        if (settled) return;
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          endWithError(
            controller,
            'VLM 上游响应超过大小限制',
            'upstream_response_too_large'
          );
          return;
        }

        try {
          buffer += decoder.decode(chunk, { stream: true });
          drainEvents();
        } catch (error) {
          endWithError(
            controller,
            error instanceof Error ? error.message : 'VLM 流式响应无效',
            'upstream_stream_error'
          );
        }
      },
      flush(controller) {
        if (settled) return;
        clearTimer();
        try {
          buffer += decoder.decode();
          drainEvents(true);
          controller.enqueue(encoder.encode(JSON.stringify(accumulator.buildResponse())));
          settled = true;
        } catch (error) {
          endWithError(
            controller,
            error instanceof Error ? error.message : 'VLM 流式响应无效',
            'upstream_stream_error',
            false
          );
        }
      }
    },
    cancel() {
      settled = true;
      clearTimer();
    }
  };
}

function createBufferedResponseTransform(timeoutMs, maxBytes) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let totalBytes = 0;
  let text = '';
  let settled = false;
  let timer;

  const clearTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  const endWithError = (controller, message, type, terminate = true) => {
    if (settled) return;
    settled = true;
    clearTimer();
    try {
      controller.enqueue(encoder.encode(createStreamingErrorPayload(message, type)));
      if (terminate && typeof controller.terminate === 'function') {
        controller.terminate();
      } else if (terminate) {
        controller.error(new Error(message));
      }
    } catch {
      // A simultaneous browser cancellation may have already closed the stream.
    }
  };

  return {
    transformer: {
      start(controller) {
        controller.enqueue(encoder.encode('\n'));
        timer = setTimeout(() => {
          endWithError(controller, 'VLM 接口请求超时', 'timeout_error');
        }, timeoutMs);
      },
      transform(chunk, controller) {
        if (settled) return;
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          endWithError(
            controller,
            'VLM 上游响应超过大小限制',
            'upstream_response_too_large'
          );
          return;
        }
        text += decoder.decode(chunk, { stream: true });
      },
      flush(controller) {
        if (settled) return;
        clearTimer();
        text += decoder.decode();
        controller.enqueue(encoder.encode(text));
        settled = true;
      }
    },
    cancel() {
      settled = true;
      clearTimer();
    }
  };
}

function pipeTransformedResponseBody(source, lifecycle) {
  const output = new TransformStream();
  const transformed = source.pipeThrough(new TransformStream(lifecycle.transformer));
  const pipePromise = transformed.pipeTo(output.writable, { preventAbort: true });

  void pipePromise.then(
    () => lifecycle.cancel(),
    async () => {
      lifecycle.cancel();
      let writer;
      try {
        writer = output.writable.getWriter();
        await writer.write(new TextEncoder().encode(createStreamingErrorPayload(
          'VLM 上游响应流中断',
          'upstream_stream_error'
        )));
        await writer.close();
      } catch {
        // The browser may have canceled the response. The source is canceled by
        // pipeTo and lifecycle.cancel already cleared the edge timeout.
      } finally {
        try {
          writer?.releaseLock();
        } catch {
          // The destination may already be errored after a browser cancellation.
        }
      }
    }
  ).catch(() => lifecycle.cancel());

  return output.readable;
}

function buildUpstreamResponse(request, upstreamResponse, config, env, elapsedMs) {
  const contentLength = Number(upstreamResponse.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > config.maxUpstreamResponseBytes) {
    upstreamResponse.body?.cancel?.().catch(() => {});
    return jsonResponse(request, {
      error: {
        message: 'VLM 上游响应超过大小限制',
        type: 'upstream_response_too_large'
      }
    }, 502, { 'x-vlm-source': 'cloud' }, env);
  }

  if (!upstreamResponse.body) {
    return jsonResponse(request, {
      error: {
        message: 'VLM 上游响应为空',
        type: 'empty_upstream_response'
      }
    }, 502, { 'x-vlm-source': 'cloud' }, env);
  }

  const upstreamContentType = upstreamResponse.headers.get('content-type') || JSON_CONTENT_TYPE;
  const isSuccessfulSse = upstreamResponse.ok &&
    upstreamContentType.toLowerCase().includes(SSE_CONTENT_TYPE);
  const remainingTimeoutMs = Math.max(1000, config.timeoutMs - elapsedMs);
  const transform = isSuccessfulSse
    ? createSseAggregationTransform(remainingTimeoutMs, config.maxUpstreamResponseBytes)
    : createBufferedResponseTransform(remainingTimeoutMs, config.maxUpstreamResponseBytes);

  return new Response(pipeTransformedResponseBody(upstreamResponse.body, transform), {
    status: upstreamResponse.status,
    headers: {
      'content-type': isSuccessfulSse ? JSON_CONTENT_TYPE : upstreamContentType,
      'cache-control': 'no-store',
      'x-vlm-source': 'cloud',
      ...buildCorsHeaders(request, env)
    }
  });
}

async function handleChatCompletions(request, config, env) {
  if (request.method !== 'POST') {
    return methodNotAllowed(request, 'POST, OPTIONS', env);
  }

  if (!config.chatCompletionsUrl || !config.apiKey || !config.apiProfile) {
    return jsonResponse(request, {
      error: {
        message: 'VLM API 地址、密钥或 profile 无效，请检查 ESA Pages 环境变量',
        type: 'configuration_error'
      }
    }, 500, {}, env);
  }

  let body;
  try {
    body = await readRequestJson(request, config.requestBodyBytes);
  } catch (error) {
    const requestTooLarge = error instanceof Error && error.name === 'BodyLimitError';
    return jsonResponse(request, {
      error: {
        message: requestTooLarge
          ? 'request body exceeds the configured limit'
          : 'request body must be valid JSON',
        type: requestTooLarge ? 'request_too_large' : 'invalid_request'
      }
    }, requestTooLarge ? 413 : 400, {}, env);
  }

  const validationMessage = validateChatCompletionPayload(body, config);
  if (validationMessage) {
    return jsonResponse(request, {
      error: {
        message: validationMessage,
        type: 'invalid_request'
      }
    }, 400, {}, env);
  }

  try {
    const startedAt = Date.now();
    const upstreamResponse = await fetchConfiguredVlmEndpoint(config.chatCompletionsUrl, {
      method: 'POST',
      headers: {
        'content-type': JSON_CONTENT_TYPE,
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(buildVlmApiRequestBody(
        body,
        config.model,
        config.apiProfile,
        config.maxChatTokens
      ))
    }, Math.min(config.timeoutMs, UPSTREAM_HEADER_TIMEOUT_MS));

    return buildUpstreamResponse(
      request,
      upstreamResponse,
      config,
      env,
      Date.now() - startedAt
    );
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    return jsonResponse(request, {
      error: {
        message: isTimeout ? 'VLM 接口请求超时' : 'VLM 代理请求失败',
        type: isTimeout ? 'timeout_error' : 'proxy_error'
      }
    }, isTimeout ? 504 : 500, { 'x-vlm-source': 'cloud' }, env);
  }
}

function handleHealth(request, config, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS', env);
  }

  const configured = Boolean(config.chatCompletionsUrl && config.apiKey && config.apiProfile);
  return jsonResponse(request, {
    ok: true,
    service: 'community-risk-warning-pages-api',
    qwenConfigured: configured,
    vlmConfigured: configured,
    model: config.model,
    timestamp: new Date().toISOString()
  }, 200, {}, env);
}

function handleVlmStatus(request, config, env) {
  if (request.method !== 'GET') {
    return methodNotAllowed(request, 'GET, OPTIONS', env);
  }

  const ready = Boolean(config.chatCompletionsUrl && config.apiKey && config.apiProfile);
  return jsonResponse(request, {
    ready,
    status: ready ? 'ready' : 'error',
    gpu: 'unknown',
    source: 'cloud'
  }, 200, {}, env);
}

export async function handleRequest(request, runtimeEnv = {}) {
  const env = getEnv(runtimeEnv, await loadGeneratedEnv());
  const config = loadPagesApiConfig(env);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request, env)
    });
  }

  const pathname = new URL(request.url).pathname;
  if (pathname === API_HEALTH_ROUTE) {
    return handleHealth(request, config, env);
  }

  if (pathname === OLLAMA_STATUS_ROUTE) {
    return handleVlmStatus(request, config, env);
  }

  if (pathname === QWEN_CHAT_COMPLETIONS_ROUTE || pathname === OLLAMA_CHAT_COMPLETIONS_ROUTE) {
    return handleChatCompletions(request, config, env);
  }

  return jsonResponse(request, {
    error: {
      message: 'Not found',
      type: 'not_found'
    }
  }, 404, {}, env);
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  }
};
