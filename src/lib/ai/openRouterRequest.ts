import { DEFAULT_OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODELS } from '@/config/aiModels';

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function openRouterHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://alphaclonesystems.com',
    'X-Title': 'AlphaClone Systems',
  };
}

async function parseOpenRouterError(res: Response): Promise<string> {
  const err = await res.text();
  return `OpenRouter API error ${res.status}: ${err}`;
}

export async function requestOpenRouterCompletion(
  messages: OpenRouterMessage[],
  options: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<{ content: string; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const models = [
    ...(options.model ? [options.model] : []),
    ...OPENROUTER_FALLBACK_MODELS.filter((model) => model !== options.model),
  ];
  const uniqueModels = [...new Set(models.length ? models : [DEFAULT_OPENROUTER_MODEL])];

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
      if (res.status === 404 || res.status === 410) {
        continue;
      }
      throw new Error(lastError);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      lastError = 'OpenRouter returned empty response';
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
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const models = [
    ...(options.model ? [options.model] : []),
    ...OPENROUTER_FALLBACK_MODELS.filter((model) => model !== options.model),
  ];
  const uniqueModels = [...new Set(models.length ? models : [DEFAULT_OPENROUTER_MODEL])];

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
      if (res.status === 404 || res.status === 410) {
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

    lastError = 'OpenRouter returned empty stream';
  }

  throw new Error(lastError);
}
