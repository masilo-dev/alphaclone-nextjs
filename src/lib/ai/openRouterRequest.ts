import { ENV } from '@/config/env';
import { DEFAULT_OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODELS } from '@/config/aiModels';

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function resolveOpenRouterApiKey(): string {
  const apiKey = ENV.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }
  return apiKey.trim();
}

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://alphaclonesystems.com',
    'X-Title': 'AlphaClone Systems',
  };
}

function isRetriableOpenRouterStatus(status: number): boolean {
  // Try the next model when this one is missing, rate-limited, or requires paid credits.
  return (
    status === 402 ||
    status === 404 ||
    status === 410 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 524 ||
    status === 529
  );
}

async function parseOpenRouterError(res: Response): Promise<string> {
  const err = await res.text();
  return `OpenRouter API error ${res.status}: ${err}`;
}

function buildOpenRouterModelList(preferredModel?: string): string[] {
  const models = [
    ...(preferredModel ? [preferredModel] : []),
    ...OPENROUTER_FALLBACK_MODELS.filter((model) => model !== preferredModel),
  ];
  return [...new Set(models.length ? models : [DEFAULT_OPENROUTER_MODEL])];
}

export async function requestOpenRouterCompletion(
  messages: OpenRouterMessage[],
  options: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<{ content: string; model: string }> {
  const apiKey = resolveOpenRouterApiKey();
  const uniqueModels = buildOpenRouterModelList(options.model);

  let lastError = 'OpenRouter request failed';

  for (const model of uniqueModels) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.7,
      }),
    });

    if (!res.ok) {
      lastError = await parseOpenRouterError(res);
      if (isRetriableOpenRouterStatus(res.status)) {
        continue;
      }
      throw new Error(lastError);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      lastError = `OpenRouter returned empty response for ${model}`;
      continue;
    }

    return { content, model };
  }

  throw new Error(lastError);
}

export async function streamOpenRouterCompletion(
  messages: OpenRouterMessage[],
  options: { maxTokens?: number; temperature?: number; model?: string } = {},
  onToken: (chunk: string) => void
): Promise<{ content: string; model: string }> {
  const apiKey = resolveOpenRouterApiKey();
  const uniqueModels = buildOpenRouterModelList(options.model);

  let lastError = 'OpenRouter stream failed';

  for (const model of uniqueModels) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        max_tokens: options.maxTokens ?? 2000,
        temperature: options.temperature ?? 0.5,
        stream: true,
      }),
    });

    if (!res.ok) {
      lastError = await parseOpenRouterError(res);
      if (isRetriableOpenRouterStatus(res.status)) {
        continue;
      }
      throw new Error(lastError);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      lastError = 'OpenRouter stream unavailable';
      continue;
    }

    const decoder = new TextDecoder();
    let full = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const block = decoder.decode(value, { stream: true });
      for (const line of block.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            full += delta;
            onToken(delta);
          }
        } catch {
          // Ignore malformed SSE chunks.
        }
      }
    }

    if (full.trim()) {
      return { content: full, model };
    }

    lastError = `OpenRouter returned empty stream for ${model}`;
  }

  throw new Error(lastError);
}
