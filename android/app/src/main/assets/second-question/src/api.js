// OpenAI-compatible client with SSE streaming and tool-call accumulation.

export class ApiError extends Error {
  constructor(kind, message, status = 0, detail = '') {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

const KIND_TEXT = {
  auth: 'API Key 无效或已过期',
  quota: '额度不足',
  rate: '请求太频繁，稍后再试',
  server: '服务端出错',
  http: '请求被拒绝',
  network: '连接失败：可能是网络、CORS 或地址不对',
  protocol: '返回内容无法解析',
};

export function classifyHttp(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'quota';
  if (status === 429) return 'rate';
  if (status >= 500) return 'server';
  return 'http';
}

export function errorText(err) {
  if (err instanceof ApiError) return `${KIND_TEXT[err.kind] || err.message}${err.detail ? `：${err.detail}` : ''}`;
  if (err?.name === 'AbortError') return '已停止';
  return err?.message || '未知错误';
}

function endpoint(baseUrl) {
  return `${String(baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '')}/chat/completions`;
}

async function readErrorDetail(res) {
  try {
    const text = await res.text();
    if (!text) return '';
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return '';
  }
}

function parseToolArguments(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { __parseError: raw };
  }
}

function accumulateToolCalls(map, deltas) {
  for (const tc of deltas || []) {
    const index = tc.index ?? 0;
    if (!map.has(index)) map.set(index, { id: '', name: '', args: '' });
    const slot = map.get(index);
    if (tc.id) slot.id = tc.id;
    if (tc.function?.name) slot.name = tc.function.name;
    if (tc.function?.arguments) slot.args += tc.function.arguments;
  }
}

function finalizeCalls(map) {
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, slot]) => ({
      id: slot.id || `call_${index}`,
      name: slot.name,
      arguments: parseToolArguments(slot.args),
    }))
    .filter((c) => c.name);
}

export async function* streamChat({
  baseUrl,
  apiKey,
  model,
  messages,
  tools,
  temperature = 0.6,
  maxTokens = 800,
  signal,
  fetchImpl = fetch,
}) {
  const body = {
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  let res;
  try {
    res = await fetchImpl(endpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('network', KIND_TEXT.network);
  }

  if (!res.ok) {
    const detail = await readErrorDetail(res);
    const kind = classifyHttp(res.status);
    throw new ApiError(kind, KIND_TEXT[kind], res.status, detail);
  }
  if (!res.body) throw new ApiError('protocol', '没有响应体');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const toolMap = new Map();
  let buffer = '';
  let usage = null;
  let finishReason = null;

  const handleLine = (line) => {
    const trimmed = line.replace(/\r$/, '');
    if (!trimmed.startsWith('data:')) return null;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') return null;
    let json;
    try {
      json = JSON.parse(payload);
    } catch {
      return null;
    }
    if (json.usage) usage = json.usage;
    const choice = json.choices?.[0];
    if (!choice) return null;
    if (choice.finish_reason) finishReason = choice.finish_reason;
    const delta = choice.delta || {};
    if (delta.tool_calls) accumulateToolCalls(toolMap, delta.tool_calls);
    if (delta.content) return { type: 'text', text: delta.content };
    return null;
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      const event = handleLine(line);
      if (event) yield event;
    }
  }
  if (buffer.trim()) {
    const event = handleLine(buffer);
    if (event) yield event;
  }

  const calls = finalizeCalls(toolMap);
  if (calls.length) yield { type: 'tool_calls', calls };
  yield { type: 'done', usage, finishReason };
}

export async function chatOnce({
  baseUrl,
  apiKey,
  model,
  messages,
  tools,
  temperature = 0.2,
  maxTokens = 700,
  signal,
  fetchImpl = fetch,
}) {
  const body = { model, messages, stream: false, temperature, max_tokens: maxTokens };
  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }
  let res;
  try {
    res = await fetchImpl(endpoint(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError('network', KIND_TEXT.network);
  }
  if (!res.ok) {
    const detail = await readErrorDetail(res);
    const kind = classifyHttp(res.status);
    throw new ApiError(kind, KIND_TEXT[kind], res.status, detail);
  }
  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError('protocol', KIND_TEXT.protocol);
  }
  const message = json.choices?.[0]?.message || {};
  const calls = (message.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: parseToolArguments(tc.function?.arguments),
  }));
  return { content: message.content || '', calls: calls.filter((c) => c.name), usage: json.usage || null };
}

export async function testConnection({ baseUrl, apiKey, model, fetchImpl = fetch }) {
  const started = Date.now();
  const result = await chatOnce({
    baseUrl,
    apiKey,
    model,
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 1,
    fetchImpl,
  });
  return { ms: Date.now() - started, result };
}
