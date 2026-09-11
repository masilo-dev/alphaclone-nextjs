import type { DeepSeekModel } from '@/lib/ai/deepseek';
import type { AIProviderId } from '@/lib/ai/providerHealth';

/** Platform default: DeepSeek only. Set AI_ALLOW_MULTI_PROVIDER=true to enable other providers. */
export function isDeepSeekOnlyMode(): boolean {
  return process.env.AI_ALLOW_MULTI_PROVIDER !== 'true';
}

export function deepSeekConfigError(): string {
  return 'DEEPSEEK_API_KEY is not configured on alphaclone-web.';
}

export function isDeepSeekModelName(model?: string): boolean {
  const m = (model || '').toLowerCase();
  return m.includes('deepseek');
}

export function resolveDeepSeekModel(requested?: string): DeepSeekModel {
  const m = (requested || '').toLowerCase();
  if (
    m.includes('reason') ||
    m.includes('legal') ||
    m.includes('strategy') ||
    m.includes('claude') ||
    m.includes('opus') ||
    m.includes('sonnet')
  ) {
    return 'deepseek-reasoner';
  }
  return 'deepseek-chat';
}

/** Map a DeepSeek-style model name to the correct id for each provider (never pass deepseek-* to OpenAI/Gemini). */
export function resolveModelForProvider(provider: AIProviderId, requested?: string): string | undefined {
  if (!isDeepSeekModelName(requested)) return requested;

  switch (provider) {
    case 'deepseek':
      return resolveDeepSeekModel(requested);
    case 'openrouter':
      return resolveDeepSeekModel(requested) === 'deepseek-reasoner'
        ? 'deepseek/deepseek-reasoner'
        : 'deepseek/deepseek-chat';
    default:
      return undefined;
  }
}

export function stripIncompatibleModelForProvider<T extends { model?: string }>(
  provider: AIProviderId,
  options: T
): T {
  if (!isDeepSeekModelName(options.model)) return options;
  const mapped = resolveModelForProvider(provider, options.model);
  if (mapped) return { ...options, model: mapped };
  const { model: _drop, ...rest } = options;
  return rest as T;
}
