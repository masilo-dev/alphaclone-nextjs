/**
 * DeepSeek API client — sole platform AI provider (no OpenRouter fallback).
 * Docs: https://platform.deepseek.com/api-docs
 */
import {
  clearAIProviderCooldown,
  createAIProviderUnavailableError,
  getAIProviderCooldown,
  noteAIProviderFailure,
} from '@/lib/ai/providerHealth';
import { resolveDeepSeekModel } from '@/lib/ai/deepSeekOnly';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

export interface DeepSeekOptions {
  model?: DeepSeekModel;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function isServerRuntime(): boolean {
  return typeof window === 'undefined';
}

function deepSeekUnavailable(reason: string): never {
  throw createAIProviderUnavailableError([reason]);
}

async function deepSeekCompletion(
  messages: DeepSeekMessage[],
  options: DeepSeekOptions = {}
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    deepSeekUnavailable('DEEPSEEK_API_KEY is not configured on alphaclone-web.');
  }

  const model = resolveDeepSeekModel(options.model);
  const maxTokens = options.maxTokens ?? 2000;
  const temperature = options.temperature ?? 0.7;

  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek returned empty response');
  }
  clearAIProviderCooldown('deepseek');
  return content as string;
}

async function runDeepSeekCompletion(
  messages: DeepSeekMessage[],
  options: DeepSeekOptions
): Promise<string> {
  if (getAIProviderCooldown('deepseek')) {
    deepSeekUnavailable('DeepSeek is temporarily unavailable — retry in a few minutes.');
  }
  try {
    return await deepSeekCompletion(messages, options);
  } catch (err) {
    noteAIProviderFailure('deepseek', err);
    throw err;
  }
}

export async function callDeepSeek(
  prompt: string,
  options: DeepSeekOptions = {}
): Promise<string> {
  if (!isServerRuntime()) {
    const response = await fetch('/api/ai/deepseek', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, options }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error || 'DeepSeek request failed');
    }

    if (typeof payload?.content !== 'string' || !payload.content) {
      throw new Error('DeepSeek returned empty response');
    }

    return payload.content;
  }

  const messages: DeepSeekMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: prompt });
  return runDeepSeekCompletion(messages, options);
}

export async function chatDeepSeek(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
  options: DeepSeekOptions = {}
): Promise<string> {
  const messages: DeepSeekMessage[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  for (const turn of history) {
    messages.push({ role: turn.role, content: turn.content });
  }
  messages.push({ role: 'user', content: message });
  return runDeepSeekCompletion(messages, options);
}

/** Stream tokens from DeepSeek — used by Bonnie for DeepChat-style responses. */
export async function streamDeepSeek(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  message: string,
  options: DeepSeekOptions = {},
  onToken: (chunk: string) => void
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    deepSeekUnavailable('DEEPSEEK_API_KEY is not configured on alphaclone-web.');
  }
  if (getAIProviderCooldown('deepseek')) {
    deepSeekUnavailable('DeepSeek is temporarily unavailable — retry in a few minutes.');
  }

  const messages: DeepSeekMessage[] = [];
  if (options.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
  for (const turn of history) messages.push({ role: turn.role, content: turn.content });
  messages.push({ role: 'user', content: message });

  const model = resolveDeepSeekModel(options.model);

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com',
    });
    const stream = await client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.5,
      stream: true,
    });

    let full = '';
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        onToken(delta);
      }
    }

    clearAIProviderCooldown('deepseek');
    return full;
  } catch (err) {
    noteAIProviderFailure('deepseek', err);
    throw err;
  }
}
