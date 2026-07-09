export type AIProviderId = 'deepseek' | 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter';

type ProviderBlockReason =
  | 'billing'
  | 'quota'
  | 'auth'
  | 'suspended'
  | 'model_unavailable';

type ProviderHealthState = {
  provider: AIProviderId;
  blockedUntil: number;
  reason: ProviderBlockReason;
  message: string;
  updatedAt: number;
};

type ProviderFailureClassification = {
  shouldCooldown: boolean;
  reason?: ProviderBlockReason;
  cooldownMs?: number;
  message: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __alphaclone_ai_provider_health__: Map<AIProviderId, ProviderHealthState> | undefined;
}

const DEFAULT_RETRY_MS = 5 * 60 * 1000;
const LONG_RETRY_MS = 15 * 60 * 1000;
const AUTH_RETRY_MS = 30 * 60 * 1000;

function getStore(): Map<AIProviderId, ProviderHealthState> {
  if (!globalThis.__alphaclone_ai_provider_health__) {
    globalThis.__alphaclone_ai_provider_health__ = new Map<AIProviderId, ProviderHealthState>();
  }
  return globalThis.__alphaclone_ai_provider_health__;
}

function normalizeMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || 'Unknown AI provider error';
  return String(error || 'Unknown AI provider error');
}

export function classifyAIProviderFailure(error: unknown): ProviderFailureClassification {
  const message = normalizeMessage(error);
  const normalized = message.toLowerCase();

  if (
    normalized.includes('insufficient balance') ||
    normalized.includes('insufficient credits') ||
    normalized.includes('insufficient balance') ||
    normalized.includes('credit balance too low') ||
    normalized.includes('billing') ||
    normalized.includes('payment required') ||
    normalized.includes('account not active') ||
    normalized.includes('monthly spending limit')
  ) {
    return { shouldCooldown: true, reason: 'billing', cooldownMs: LONG_RETRY_MS, message };
  }

  if (
    normalized.includes('credits exhausted') ||
    normalized.includes('quota') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests')
  ) {
    return { shouldCooldown: true, reason: 'quota', cooldownMs: DEFAULT_RETRY_MS, message };
  }

  if (
    normalized.includes('forbidden') ||
    normalized.includes('suspended')
  ) {
    return { shouldCooldown: true, reason: 'suspended', cooldownMs: LONG_RETRY_MS, message };
  }

  if (
    normalized.includes('invalid api key') ||
    normalized.includes('api key not configured') ||
    normalized.includes('not configured') ||
    normalized.includes('unauthorized') ||
    normalized.includes('invalid_auth') ||
    normalized.includes('authentication')
  ) {
    return { shouldCooldown: true, reason: 'auth', cooldownMs: AUTH_RETRY_MS, message };
  }

  if (
    normalized.includes('no endpoints found') ||
    normalized.includes('model not found') ||
    (normalized.includes('404') && normalized.includes('model'))
  ) {
    return { shouldCooldown: true, reason: 'model_unavailable', cooldownMs: DEFAULT_RETRY_MS, message };
  }

  return { shouldCooldown: false, message };
}

export function noteAIProviderFailure(provider: AIProviderId, error: unknown): void {
  const classification = classifyAIProviderFailure(error);
  if (!classification.shouldCooldown || !classification.reason || !classification.cooldownMs) return;

  const now = Date.now();
  getStore().set(provider, {
    provider,
    blockedUntil: now + classification.cooldownMs,
    reason: classification.reason,
    message: classification.message,
    updatedAt: now,
  });
}

export function getAIProviderCooldown(provider: AIProviderId): ProviderHealthState | null {
  const state = getStore().get(provider);
  if (!state) return null;
  if (state.blockedUntil <= Date.now()) {
    getStore().delete(provider);
    return null;
  }
  return state;
}

export function clearAIProviderCooldown(provider: AIProviderId): void {
  getStore().delete(provider);
}

export class AIProviderUnavailableError extends Error {
  code = 'AI_PROVIDER_UNAVAILABLE';
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 300) {
    super(message);
    this.name = 'AIProviderUnavailableError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function createAIProviderUnavailableError(reasons: string[], retryAfterSeconds?: number): AIProviderUnavailableError {
  const retry = Number.isFinite(retryAfterSeconds) && retryAfterSeconds && retryAfterSeconds > 0
    ? Math.max(1, Math.floor(retryAfterSeconds))
    : 300;
  const details = reasons.length ? `\n${reasons.join('\n')}` : '';
  return new AIProviderUnavailableError(`All AI providers failed:${details}`, retry);
}

export function isAIProviderUnavailableError(error: unknown): error is AIProviderUnavailableError {
  return error instanceof AIProviderUnavailableError || (typeof error === 'object' && error !== null && (error as any).code === 'AI_PROVIDER_UNAVAILABLE');
}
