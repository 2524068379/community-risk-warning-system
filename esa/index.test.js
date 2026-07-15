import fs from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_QWEN_BASE_URL,
  DEFAULT_QWEN_VLM_API_MODEL,
  buildVlmApiRequestBody,
  handleRequest,
  loadPagesApiConfig,
  resolveAllowedQwenBaseUrl,
  validateChatCompletionPayload
} from './index.js';

const runtimeEnv = {
  QWEN_API_KEY: 'test-key',
  QWEN_MODEL: 'qwen3-vl-plus'
};

function buildChatRequest(body, headers = {}) {
  return new Request('https://demo.example/api/ollama/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://demo.example',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

function buildSseResponse(content) {
  const chunks = [
    {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 123,
      model: 'qwen3-vl-plus',
      choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }]
    },
    {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 123,
      model: 'qwen3-vl-plus',
      choices: [{ index: 0, delta: { content }, finish_reason: null }]
    },
    {
      id: 'chatcmpl-test',
      object: 'chat.completion.chunk',
      created: 123,
      model: 'qwen3-vl-plus',
      choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
    }
  ];
  const body = `${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`;
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < bytes.byteLength; offset += 7) {
        controller.enqueue(bytes.slice(offset, offset + 7));
      }
      controller.close();
    }
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-type': 'text/event-stream; charset=utf-8' }
  });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ESA Pages API config', () => {
  it('keeps Pages output isolated from Electron and aligned with esa.jsonc', () => {
    const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const esaConfig = JSON.parse(fs.readFileSync(new URL('../esa.jsonc', import.meta.url), 'utf8'));
    const gitignore = fs.readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');

    expect(packageJson.scripts['build:pages']).toContain('--outDir dist-pages');
    expect(esaConfig.assets.directory).toBe('./dist-pages');
    expect(gitignore.split(/\r?\n/)).toContain('dist-pages');
  });

  it('uses bounded Qwen VL hosted API defaults', () => {
    expect(loadPagesApiConfig({ DASHSCOPE_API_KEY: 'sk-test' })).toMatchObject({
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      chatCompletionsUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      apiProfile: 'dashscope',
      apiKey: 'sk-test',
      model: DEFAULT_QWEN_VLM_API_MODEL,
      timeoutMs: 60000,
      requestBodyBytes: 2 * 1024 * 1024,
      maxChatMessages: 16,
      maxChatTokens: 2048,
      maxUpstreamResponseBytes: 2 * 1024 * 1024
    });
  });

  it.each([
    ['ESA_VLM_API_KEY', 'esa-key'],
    ['QWEN_API_KEY', 'qwen-key'],
    ['DASHSCOPE_API_KEY', 'dashscope-key']
  ])('keeps the default DashScope endpoint compatible with %s', (keyName, keyValue) => {
    expect(loadPagesApiConfig({
      QWEN_BASE_URL: `${DEFAULT_QWEN_BASE_URL}/`,
      [keyName]: keyValue
    })).toMatchObject({
      baseUrl: DEFAULT_QWEN_BASE_URL,
      apiProfile: 'dashscope',
      apiKey: keyValue
    });
  });

  it('parses ESA request and response limits and rejects impossible timeout values', () => {
    expect(loadPagesApiConfig({
      QWEN_API_KEY: 'sk-test',
      QWEN_TIMEOUT: '90000',
      REQUEST_BODY_LIMIT: '3mb',
      MAX_CHAT_MESSAGES: '8',
      MAX_CHAT_TOKENS: '1600',
      MAX_UPSTREAM_RESPONSE_BYTES: '4096'
    })).toMatchObject({
      timeoutMs: 90000,
      requestBodyBytes: 3 * 1024 * 1024,
      maxChatMessages: 8,
      maxChatTokens: 1600,
      maxUpstreamResponseBytes: 4096
    });

    expect(loadPagesApiConfig({
      QWEN_API_KEY: 'sk-test',
      QWEN_TIMEOUT: '300000'
    }).timeoutMs).toBe(60000);
    expect(loadPagesApiConfig({
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/v1',
      ESA_VLM_API_PROFILE: 'unknown-profile'
    }).apiProfile).toBe('');
  });

  it('accepts a deployment-configured public HTTPS OpenAI-compatible endpoint', () => {
    expect(resolveAllowedQwenBaseUrl('https://api.vendor.example/openai/v1/')).toBe(
      'https://api.vendor.example/openai/v1'
    );
    expect(loadPagesApiConfig({
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/openai/v1',
      ESA_VLM_API_KEY: 'vendor-key',
      ESA_VLM_MODEL: 'vendor-vlm',
      ESA_VLM_API_PROFILE: 'json-object'
    })).toMatchObject({
      baseUrl: 'https://api.vendor.example/openai/v1',
      chatCompletionsUrl: 'https://api.vendor.example/openai/v1/chat/completions',
      apiProfile: 'json-object',
      apiKey: 'vendor-key',
      model: 'vendor-vlm'
    });
  });

  it('never combines a custom endpoint with credentials from another namespace', () => {
    expect(loadPagesApiConfig({
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/v1',
      QWEN_API_KEY: 'must-not-leak',
      QWEN_MODEL: 'qwen3-vl-plus'
    })).toMatchObject({
      chatCompletionsUrl: 'https://api.vendor.example/v1/chat/completions',
      apiKey: '',
      model: DEFAULT_QWEN_VLM_API_MODEL
    });

    expect(loadPagesApiConfig({
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      DASHSCOPE_API_KEY: 'must-not-leak'
    })).toMatchObject({
      chatCompletionsUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiKey: ''
    });
  });

  it('infers JSON object mode for a configured BigModel visual endpoint', () => {
    expect(loadPagesApiConfig({
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4/',
      QWEN_API_KEY: 'sk-test'
    })).toMatchObject({
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      chatCompletionsUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
      apiProfile: 'json-object'
    });
  });

  it.each([
    'http://api.example.com/v1',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/v1',
    'https://localhost../v1',
    'https://foo.localhost../v1',
    'https://127.0.0.1../v1',
    'https://models.internal/v1',
    'https://user:password@api.example.com/v1',
    'https://api.example.com/v1?target=internal'
  ])('blocks an unsafe upstream URL: %s', (url) => {
    expect(resolveAllowedQwenBaseUrl(url)).toBe('');
  });
});

describe('ESA Pages VLM request normalization', () => {
  it('rejects an invalid provider profile instead of silently changing formats', () => {
    expect(() => buildVlmApiRequestBody({ messages: [] }, 'model', 'typo')).toThrow(
      'Unsupported VLM API profile'
    );
  });

  it('converts llama.cpp JSON schema mode into DashScope streaming JSON mode', () => {
    expect(buildVlmApiRequestBody({
      model: 'local-model',
      stream: false,
      response_format: { type: 'json_schema', schema: { type: 'object' } },
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: 'user', content: 'JSON only' }]
    }, 'qwen3-vl-plus', 'dashscope', 1200)).toEqual({
      model: 'qwen3-vl-plus',
      max_tokens: 1200,
      stream: true,
      response_format: { type: 'json_object' },
      enable_thinking: false,
      messages: [{ role: 'user', content: 'JSON only' }]
    });
  });

  it('uses JSON object mode for the BigModel visual endpoint', () => {
    expect(buildVlmApiRequestBody({
      stream: false,
      response_format: { type: 'json_schema', schema: { type: 'object' } },
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: 'user', content: 'JSON only' }]
    }, 'glm-4v-flash', 'json-object', 800)).toEqual({
      model: 'glm-4v-flash',
      max_tokens: 800,
      stream: true,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'JSON only' }]
    });
  });

  it('enforces message, token, and single-choice limits before spending upstream quota', () => {
    const config = loadPagesApiConfig({
      QWEN_API_KEY: 'sk-test',
      MAX_CHAT_MESSAGES: '2',
      MAX_CHAT_TOKENS: '100'
    });

    expect(validateChatCompletionPayload({
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 100,
      stream: false
    }, config)).toBe('');
    expect(validateChatCompletionPayload({
      messages: [
        { role: 'user', content: '1' },
        { role: 'user', content: '2' },
        { role: 'user', content: '3' }
      ]
    }, config)).toMatch(/messages exceeds/);
    expect(validateChatCompletionPayload({
      messages: [{ role: 'user', content: 'ok' }],
      max_completion_tokens: 10
    }, config)).toMatch(/not supported/);
    expect(validateChatCompletionPayload({
      messages: [{ role: 'user', content: 'ok' }],
      max_tokens: 101
    }, config)).toMatch(/configured limit/);
    expect(validateChatCompletionPayload({
      messages: [{ role: 'user', content: 'ok' }],
      n: 2
    }, config)).toBe('n must be 1');
  });
});

describe('ESA Pages API routes', () => {
  it('fails closed before fetch when the configured provider profile is invalid', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const invalidEnv = {
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/v1',
      ESA_VLM_API_KEY: 'vendor-key',
      ESA_VLM_API_PROFILE: 'typo'
    };

    const response = await handleRequest(buildChatRequest({}), invalidEnv);
    const health = await handleRequest(
      new Request('https://demo.example/api/health'),
      invalidEnv
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: { type: 'configuration_error' }
    });
    expect(await health.json()).toMatchObject({ vlmConfigured: false });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reads ESA runtime env bindings passed to the fetch handler', async () => {
    const env = {
      QWEN_BASE_URL: 'https://open.bigmodel.cn/api/paas/v4',
      QWEN_API_KEY: 'test-key',
      QWEN_MODEL: 'glm-4v-flash'
    };

    const health = await handleRequest(new Request('https://demo.example/api/health'), env);
    const healthJson = await health.json();

    expect(health.status).toBe(200);
    expect(healthJson).toMatchObject({
      ok: true,
      qwenConfigured: true,
      vlmConfigured: true,
      model: 'glm-4v-flash'
    });

    const status = await handleRequest(new Request('https://demo.example/api/ollama/status'), env);
    const statusJson = await status.json();

    expect(status.status).toBe(200);
    expect(statusJson).toMatchObject({
      ready: true,
      status: 'ready',
      source: 'cloud'
    });
  });

  it('streams a first byte, aggregates upstream SSE into one JSON response, and marks cloud source', async () => {
    const content = '{"hasRisk":false,"riskScore":0,"summary":"画面正常"}';
    const upstreamResponse = buildSseResponse(content);
    const request = buildChatRequest({
      model: 'local-model',
      stream: false,
      max_tokens: 800,
      response_format: { type: 'json_schema', schema: { type: 'object' } },
      chat_template_kwargs: { enable_thinking: false },
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    const fetchMock = vi.fn().mockResolvedValue(upstreamResponse);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('AbortController', undefined);

    const response = await handleRequest(request, runtimeEnv);
    const responseText = await response.text();
    const responseJson = JSON.parse(responseText);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vlm-source')).toBe('cloud');
    expect(response.headers.get('access-control-expose-headers')).toContain('X-VLM-Source');
    expect(responseText.startsWith('\n')).toBe(true);
    expect(responseJson).toMatchObject({
      id: 'chatcmpl-test',
      object: 'chat.completion',
      choices: [{
        index: 0,
        message: { role: 'assistant', content },
        finish_reason: 'stop'
      }]
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'qwen3-vl-plus',
      stream: true,
      response_format: { type: 'json_object' },
      enable_thinking: false,
      max_tokens: 800
    });
  });

  it('returns JSON headers and leading whitespace before upstream response headers arrive', async () => {
    const request = buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('AbortController', undefined);

    const response = await handleRequest(request, {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const reader = response.body.getReader();
    const firstChunk = await reader.read();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-vlm-source')).toBe('cloud');
    expect(new TextDecoder().decode(firstChunk.value)).toBe('\n');

    await reader.cancel('test complete');
  });

  it('does not require the ReadableStream constructor in the ESA runtime', async () => {
    const request = buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('AbortController', undefined);
    vi.stubGlobal('ReadableStream', undefined);

    const response = await handleRequest(request, runtimeEnv);
    const reader = response.body.getReader();
    const firstChunk = await reader.read();

    expect(new TextDecoder().decode(firstChunk.value)).toBe('\n');
    await reader.cancel('test complete');
  });

  it('calls a deployment-configured provider without a source-code endpoint allowlist', async () => {
    const fetchMock = vi.fn().mockResolvedValue(buildSseResponse('{"provider":"custom"}'));
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleRequest(buildChatRequest({
      response_format: { type: 'json_schema', schema: { type: 'object' } },
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ESA_VLM_API_BASE_URL: 'https://api.vendor.example/openai/v1',
      ESA_VLM_API_KEY: 'vendor-key',
      ESA_VLM_MODEL: 'vendor-vlm',
      ESA_VLM_API_PROFILE: 'generic'
    });

    expect(response.status).toBe(200);
    await response.text();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.vendor.example/openai/v1/chat/completions');
    expect(JSON.parse(init.body)).toMatchObject({
      model: 'vendor-vlm',
      stream: true
    });
    expect(init.redirect).toBe('error');
    expect(JSON.parse(init.body)).not.toHaveProperty('response_format');
    expect(JSON.parse(init.body)).not.toHaveProperty('enable_thinking');
  });

  it('rejects an oversized request before calling the paid upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const request = buildChatRequest(
      { messages: [{ role: 'user', content: 'small body' }] },
      { 'content-length': String(2 * 1024 * 1024 + 1) }
    );

    const response = await handleRequest(request, runtimeEnv);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { type: 'request_too_large' }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns an upstream error as a bounded JSON body after streaming starts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { message: 'quota exceeded', type: 'rate_limit' }
    }), {
      status: 429,
      headers: { 'content-type': 'application/json' }
    })));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), runtimeEnv);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vlm-source')).toBe('cloud');
    expect(await response.json()).toMatchObject({
      error: { message: 'quota exceeded' }
    });
  });

  it('allows upstream response headers to take longer than eight seconds within the total timeout', async () => {
    vi.useFakeTimers();
    let resolveFetch;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve;
    })));
    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseTextPromise = response.text();

    await vi.advanceTimersByTimeAsync(12000);
    resolveFetch(buildSseResponse('{"hasRisk":false,"summary":"late but valid"}'));
    await vi.advanceTimersByTimeAsync(0);

    expect(response.status).toBe(200);
    expect(JSON.parse(await responseTextPromise)).toMatchObject({
      choices: [{
        message: { content: '{"hasRisk":false,"summary":"late but valid"}' }
      }]
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('returns one JSON error body when the configured total timeout expires', async () => {
    vi.useFakeTimers();
    const request = buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    vi.stubGlobal('AbortController', undefined);
    const response = await handleRequest(request, {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseTextPromise = response.text();

    await vi.advanceTimersByTimeAsync(15000);

    expect(response.status).toBe(200);
    expect(JSON.parse(await responseTextPromise)).toMatchObject({
      error: { type: 'timeout_error' }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps timeout classification when aborting a pending fetch', async () => {
    vi.useFakeTimers();
    let capturedSignal;
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      capturedSignal = init.signal;
      capturedSignal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseTextPromise = response.text();

    await vi.advanceTimersByTimeAsync(15000);

    expect(capturedSignal.aborted).toBe(true);
    expect(JSON.parse(await responseTextPromise)).toMatchObject({
      error: { type: 'timeout_error' }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('closes a stalled SSE body with one valid JSON error envelope', async () => {
    vi.useFakeTimers();
    const upstreamResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': upstream connected\n\n'));
      }
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseTextPromise = response.text();

    await vi.advanceTimersByTimeAsync(15000);
    const responseJson = JSON.parse(await responseTextPromise);

    expect(response.status).toBe(200);
    expect(responseJson).toMatchObject({
      error: { type: 'timeout_error' }
    });
  });

  it('closes a stalled JSON body with one valid JSON error envelope', async () => {
    vi.useFakeTimers();
    const upstreamResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"partial":'));
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseTextPromise = response.text();

    await vi.advanceTimersByTimeAsync(15000);

    expect(response.status).toBe(200);
    expect(JSON.parse(await responseTextPromise)).toMatchObject({
      error: { type: 'timeout_error' }
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('converts an upstream stream failure into JSON and clears its timeout', async () => {
    vi.useFakeTimers();
    const upstreamResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': upstream connected\n\n'));
        controller.error(new Error('socket reset'));
      }
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const responseJson = JSON.parse(await response.text());

    expect(responseJson).toMatchObject({
      error: { type: 'upstream_stream_error' }
    });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(15000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels the upstream stream and timeout when the browser stops reading', async () => {
    vi.useFakeTimers();
    let upstreamCanceled = false;
    const upstreamResponse = new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(': upstream connected\n\n'));
      },
      cancel() {
        upstreamCanceled = true;
      }
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstreamResponse));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const reader = response.body.getReader();
    await reader.read();
    await reader.cancel('browser navigation');
    await vi.advanceTimersByTimeAsync(0);

    expect(upstreamCanceled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(15000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the timeout and cancels a late response when the browser leaves before headers arrive', async () => {
    vi.useFakeTimers();
    const request = buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    vi.stubGlobal('AbortController', undefined);
    let resolveFetch;
    let upstreamCanceled = false;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve;
    })));

    const response = await handleRequest(request, {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    const reader = response.body.getReader();
    await reader.read();
    await reader.cancel('browser navigation');
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);

    resolveFetch(new Response(new ReadableStream({
      cancel() {
        upstreamCanceled = true;
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    await vi.advanceTimersByTimeAsync(0);

    expect(upstreamCanceled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('handles cancellation before the client reads the queued first byte', async () => {
    vi.useFakeTimers();
    const request = buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    });
    vi.stubGlobal('AbortController', undefined);
    let resolveFetch;
    let upstreamCanceled = false;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      resolveFetch = resolve;
    })));

    const response = await handleRequest(request, {
      ...runtimeEnv,
      QWEN_TIMEOUT: '15000'
    });
    await response.body.cancel('browser left before read');
    await vi.advanceTimersByTimeAsync(0);

    expect(vi.getTimerCount()).toBe(0);

    resolveFetch(new Response(new ReadableStream({
      cancel() {
        upstreamCanceled = true;
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }));
    await vi.advanceTimersByTimeAsync(0);

    expect(upstreamCanceled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects an upstream response whose declared size exceeds the configured cap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'content-length': '2048'
      }
    })));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      MAX_UPSTREAM_RESPONSE_BYTES: '1024'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      error: { type: 'upstream_response_too_large' }
    });
  });

  it('stops a chunked upstream response that exceeds the actual byte cap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(1025));
        controller.close();
      }
    }), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' }
    })));

    const response = await handleRequest(buildChatRequest({
      messages: [{ role: 'user', content: 'Return JSON' }]
    }), {
      ...runtimeEnv,
      MAX_UPSTREAM_RESPONSE_BYTES: '1024'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      error: { type: 'upstream_response_too_large' }
    });
  });
});
