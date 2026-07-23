/**
 * Provider-neutral model router. Routes by task, cost, latency, privacy, health.
 * Does not embed business logic — adapters only.
 */

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'
  | 'openrouter'
  | 'local';

export type ModelRouteRequest = {
  taskType: 'plan' | 'reason' | 'extract' | 'generate' | 'code' | 'embed' | 'classify';
  preferredProvider?: ModelProvider;
  fallbackChain?: ModelProvider[];
  privacyRequired?: boolean;
  maxLatencyMs?: number;
  contextTokens?: number;
  tenantPreference?: ModelProvider;
};

export type ModelRouteDecision = {
  provider: ModelProvider;
  model: string;
  fallbacks: Array<{ provider: ModelProvider; model: string }>;
  reason: string;
};

const DEFAULT_MODELS: Record<ModelProvider, string> = {
  openai: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  gemini: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  deepseek: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  openrouter: process.env.OPENROUTER_MODEL || 'openrouter/auto',
  local: process.env.LOCAL_MODEL || 'local',
};

function providerHealthy(provider: ModelProvider): boolean {
  const envMap: Record<ModelProvider, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    gemini: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    openrouter: process.env.OPENROUTER_API_KEY,
    local: process.env.LOCAL_MODEL_ENDPOINT || '1',
  };
  return Boolean(envMap[provider]?.trim());
}

export function routeModel(req: ModelRouteRequest): ModelRouteDecision {
  const chain: ModelProvider[] =
    req.fallbackChain && req.fallbackChain.length > 0
      ? req.fallbackChain
      : [
          req.tenantPreference || req.preferredProvider || 'anthropic',
          'openai',
          'deepseek',
          'gemini',
          'openrouter',
          'local',
        ];

  // Privacy: prefer local / anthropic when required
  const ordered = req.privacyRequired
    ? (['local', 'anthropic', ...chain.filter((p) => p !== 'local' && p !== 'anthropic')] as ModelProvider[])
    : chain;

  const unique = [...new Set(ordered)];
  const healthy = unique.filter(providerHealthy);
  const primary = healthy[0] || unique[0];
  const fallbacks = healthy.slice(1).map((p) => ({ provider: p, model: DEFAULT_MODELS[p] }));

  return {
    provider: primary,
    model: DEFAULT_MODELS[primary],
    fallbacks,
    reason: healthy.length
      ? `selected ${primary} for task=${req.taskType}`
      : `no healthy providers; defaulting to ${primary}`,
  };
}

export type ModelExecutionEvidence = {
  provider: ModelProvider;
  model: string;
  prompt_version?: string;
  latency_ms?: number;
  token_usage?: Record<string, number>;
  estimated_cost?: number;
  fallback_reason?: string | null;
  output_validation?: Record<string, unknown>;
};
