/**
 * Server-side AI image generation for social publishing flows.
 * Returns structured errors — never masks provider failures as Facebook errors.
 */

import {
  parseImageProviderError,
  type ParsedImageProviderError,
} from '@/lib/ai/imageProviderErrors';

const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2';

export type SocialImageSize = '1024x1024' | '1792x1024' | '1024x1792' | '1536x1024' | '1024x1536';

type ImageProvider = 'openai' | 'xai';

export type GenerateSocialImageSuccess = {
  ok: true;
  base64: string;
  provider: ImageProvider;
  revisedPrompt?: string | null;
};

export type GenerateSocialImageFailure = {
  ok: false;
  error: ParsedImageProviderError;
};

export type GenerateSocialImageResult = GenerateSocialImageSuccess | GenerateSocialImageFailure;

function mapSizeForOpenAi(size: SocialImageSize): string {
  if (size === '1536x1024') return '1792x1024';
  if (size === '1024x1536') return '1024x1792';
  return size;
}

async function callProvider(params: {
  provider: ImageProvider;
  prompt: string;
  size: SocialImageSize;
  openaiApiKey?: string;
  xaiApiKey?: string;
}): Promise<
  | { ok: true; base64: string; revisedPrompt?: string | null }
  | { ok: false; httpStatus: number; payload: unknown }
> {
  const { provider, prompt, size, openaiApiKey, xaiApiKey } = params;
  const endpoint =
    provider === 'xai'
      ? 'https://api.x.ai/v1/images/generations'
      : 'https://api.openai.com/v1/images/generations';
  const apiKey = provider === 'xai' ? xaiApiKey : openaiApiKey;
  if (!apiKey) {
    return {
      ok: false,
      httpStatus: 500,
      payload: { error: { message: `${provider} API key is not configured` } },
    };
  }

  const model =
    provider === 'xai'
      ? process.env.XAI_IMAGE_MODEL || process.env.GROK_IMAGE_MODEL || 'grok-2-image'
      : OPENAI_IMAGE_MODEL;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt: prompt.trim(),
      n: 1,
      size: provider === 'openai' ? mapSizeForOpenAi(size) : size,
      ...(provider === 'openai' ? { quality: 'high', output_format: 'png' } : {}),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, httpStatus: response.status, payload };
  }

  const base64 = (payload as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
  if (!base64) {
    return {
      ok: false,
      httpStatus: 502,
      payload: { error: { message: 'Image provider returned no image bytes' } },
    };
  }

  const revisedPrompt = (payload as { data?: Array<{ revised_prompt?: string }> })?.data?.[0]
    ?.revised_prompt;

  return { ok: true, base64, revisedPrompt: revisedPrompt || null };
}

/**
 * Generate one PNG image for social publishing. Tries preferred provider then fallback.
 */
export async function generateSocialImage(params: {
  prompt: string;
  size?: SocialImageSize;
  provider?: 'openai' | 'xai' | 'grok' | 'auto';
}): Promise<GenerateSocialImageResult> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const xaiApiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const size = params.size || '1024x1024';
  const preferred = (params.provider || 'auto').toLowerCase();
  const preferXai = preferred === 'xai' || preferred === 'grok';
  const order: ImageProvider[] = preferXai ? ['xai', 'openai'] : ['openai', 'xai'];
  const available = order.filter((p) => (p === 'xai' ? !!xaiApiKey : !!openaiApiKey));

  if (available.length === 0) {
    return {
      ok: false,
      error: parseImageProviderError({
        fallbackMessage: 'No AI image provider API key is configured on the server',
      }),
    };
  }

  let lastFailure: ParsedImageProviderError | null = null;

  for (const provider of available) {
    const result = await callProvider({
      provider,
      prompt: params.prompt,
      size,
      openaiApiKey: openaiApiKey || undefined,
      xaiApiKey: xaiApiKey || undefined,
    });

    if (result.ok) {
      return {
        ok: true,
        base64: result.base64,
        provider,
        revisedPrompt: result.revisedPrompt,
      };
    }

    lastFailure = parseImageProviderError({
      payload: result.payload,
      httpStatus: result.httpStatus,
      provider,
    });
  }

  return {
    ok: false,
    error:
      lastFailure ||
      parseImageProviderError({ fallbackMessage: 'All AI image providers failed' }),
  };
}
