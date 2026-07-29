/**
 * AI Router Service
 * Smart routing with fallback chain: DeepSeek → OpenRouter → Anthropic → xAI → OpenAI → Gemini
 *
 * Priority Order:
 * 1. Anthropic Claude (primary - best for contracts, legal, analysis)
 * 2. xAI Grok (secondary - strong reasoning and realtime-style answers)
 * 3. OpenAI GPT-4 (tertiary - good for creative tasks)
 * 4. Google Gemini (fallback)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ENV } from '@/config/env';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, DEFAULT_OPENAI_MODEL, DEFAULT_OPENROUTER_MODEL, OPENROUTER_FALLBACK_MODELS } from '@/config/aiModels';
import { requestOpenRouterCompletion, streamOpenRouterCompletion } from '@/lib/ai/openRouterRequest';
import {
  clearAIProviderCooldown,
  classifyAIProviderFailure,
  createAIProviderUnavailableError,
  getAIProviderCooldown,
  noteAIProviderFailure,
  type AIProviderId,
} from '@/lib/ai/providerHealth';
import {
  isDeepSeekOnlyMode,
  isDeepSeekModelName,
  resolveDeepSeekModel,
  resolveModelForProvider,
  stripIncompatibleModelForProvider,
  deepSeekConfigError,
} from '@/lib/ai/deepSeekOnly';

const CLAUDE_ALLOWED_MODELS = new Set<string>([
  'claude-sonnet-4-6-20260217',
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929',
]);

const CLAUDE_MODEL_ALIASES: Record<string, string> = {
  // Keep compatibility for older callers, but route only to allowed Claude 4.x models.
  'claude-haiku-4-5-20251015': 'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-20250514',
  'claude-3-5-haiku-20241022': 'claude-sonnet-4-20250514',
};

function normalizeClaudeModel(model?: string): string {
  if (isDeepSeekModelName(model)) {
    return DEFAULT_CLAUDE_MODEL;
  }
  const rawCandidate = (model || DEFAULT_CLAUDE_MODEL).trim();
  const candidate = CLAUDE_MODEL_ALIASES[rawCandidate] || rawCandidate;
  if (CLAUDE_ALLOWED_MODELS.has(candidate)) {
    return candidate;
  }
  // Hard guard: never call other Claude models.
  return 'claude-sonnet-4-20250514';
}

function isAnthropicModelNotFound(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || 0);
  return status === 404 && message.includes('model');
}

function isXaiModelError(error: any): boolean {
  const message = String(error?.message || '').toLowerCase();
  const status = Number(error?.status || 0);
  return status === 400 || status === 404 || message.includes('model') || message.includes('grok');
}

function normalizeXaiModel(model?: string): string {
<<<<<<< HEAD
  if (isDeepSeekModelName(model)) {
    return 'grok-4.3';
  }
=======
>>>>>>> origin/main
  const candidate = String(model || 'grok-4.3').trim();
  if (!candidate) return 'grok-4.3';
  const aliases: Record<string, string> = {
    'grok-latest': 'grok-4.3',
    'grok-2-latest': 'grok-4.3',
    grok: 'grok-4.3',
  };
  return aliases[candidate] || candidate;
}

const GROK_CONVERSATION_BASE = `You are a concise, expert assistant for business operators.
- Answer directly; ask at most one clarifying question only when a critical detail is missing.
- Prefer structured bullets for multi-step answers; avoid filler and repetition.
- Do not use emojis. Keep a professional, neutral tone otherwise.
- Focus on business strategy and outcomes. Avoid technical platform advice unless explicitly requested.`;

function mergeXaiSystemPrompt(systemPrompt?: string): string {
  if (systemPrompt?.trim()) {
    return `${GROK_CONVERSATION_BASE}\n\n${systemPrompt.trim()}`;
  }
  return GROK_CONVERSATION_BASE;
}

// Initialize clients using validated ENV
const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

const openai = ENV.OPENAI_API_KEY
  ? new OpenAI({ apiKey: ENV.OPENAI_API_KEY })
  : null;

const xai = ENV.XAI_API_KEY
  ? new OpenAI({
      apiKey: ENV.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })
  : null;

const openRouterClient = ENV.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: ENV.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://alphaclonesystems.com',
        'X-Title': 'AlphaClone Systems',
      },
    })
  : null;

const geminiAI = ENV.VITE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(ENV.VITE_GEMINI_API_KEY)
  : null;

const deepseek = ENV.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: ENV.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com/v1',
    })
  : null;


// Model pricing (per 1M tokens)
export const MODEL_PRICING = {
  // DeepSeek
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  // OpenAI (per 1M tokens)
  'gpt-4o': { input: 5, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'grok-4.3': { input: 2, output: 10 },
  'grok-4': { input: 5, output: 15 },
  'grok-2-latest': { input: 2, output: 10 },
  'grok-3-mini': { input: 0.3, output: 0.5 },

  // Anthropic (per 1M tokens) - 2025/2026 pricing
  'claude-sonnet-4-6-20260217': { input: 3, output: 15 },
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-sonnet-4-5-20250929': { input: 3, output: 15 },
};

// CLAUDE_MODELS is now imported from @/config/aiModels

export interface AIRequestOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  image?: string; // Base64 image for vision tasks
  model?: string; // Optional specific model
  /** Enable Extended Thinking for Anthropic models. tokenBudget controls how many tokens Claude can use for reasoning. */
  extendedThinking?: { enabled: boolean; tokenBudget?: number };
  /** Enable Citations support for Anthropic models (structured source references). */
  enableCitations?: boolean;
}

export interface AIResponse {
  content: string;
  provider: 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter' | 'deepseek';
  model: string;
  success: boolean;
  error?: string;
  /** Thinking content blocks returned when Extended Thinking is enabled */
  thinkingContent?: string;
  /** Citation references returned when Citations are enabled */
  citations?: Array<{ document_title?: string; document_url?: string; quote?: string; start_char?: number; end_char?: number }>;
}

export interface AIStreamResponse {
  stream: ReadableStream;
  provider: 'anthropic' | 'xai' | 'openai' | 'openrouter' | 'gemini' | 'deepseek';
  model: string;
}

function providerLabel(provider: AIProviderId): string {
  switch (provider) {
    case 'deepseek': return 'DeepSeek';
    case 'anthropic': return 'Anthropic';
    case 'xai': return 'xAI';
    case 'openai': return 'OpenAI';
    case 'gemini': return 'Gemini';
    case 'openrouter': return 'OpenRouter';
  }
}

function isBillingLikeFailure(error: unknown): boolean {
  const classification = classifyAIProviderFailure(error);
  return classification.reason === 'billing' || classification.reason === 'quota';
}

function appendCooldownSkip(errors: string[], provider: AIProviderId): boolean {
  const cooldown = getAIProviderCooldown(provider);
  if (!cooldown) return false;
  const seconds = Math.max(1, Math.ceil((cooldown.blockedUntil - Date.now()) / 1000));
  errors.push(`${providerLabel(provider)} skipped: ${cooldown.reason} cooldown active (${seconds}s remaining)`);
  return true;
}

function recordProviderSuccess(provider: AIProviderId): void {
  clearAIProviderCooldown(provider);
}

function recordProviderFailure(errors: string[], provider: AIProviderId, phase: string, error: any): void {
  const errorMsg = `${providerLabel(provider)} ${phase} failed: ${error.message}`;
  console.error(`[AI Router] ✗ ${providerLabel(provider)} ${phase} Error:`, error);
  errors.push(errorMsg);
  noteAIProviderFailure(provider, error);
}

function throwAllProvidersUnavailable(errors: string[]): never {
  const retryAfterSeconds = (['deepseek', 'anthropic', 'xai', 'openai', 'gemini', 'openrouter'] as AIProviderId[])
    .map((provider) => getAIProviderCooldown(provider))
    .filter((value): value is NonNullable<typeof value> => Boolean(value))
    .map((state) => Math.ceil((state.blockedUntil - Date.now()) / 1000))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b)[0];

  throw createAIProviderUnavailableError(errors, retryAfterSeconds);
}

/**
 * Tasks for Strength-Based Routing
 */
export type AIStrengthTask = 'legal' | 'strategy' | 'social_article' | 'social_caption' | 'creative_media' | 'inbox_reply';

/**
 * Route by strength mapping:
<<<<<<< HEAD
 * - legal/strategy -> DeepSeek reasoning
 * - social_article/caption/inbox -> DeepSeek chat
 * - creative_media -> DeepSeek chat
 */
const TASK_STRENGTH_MAP: Record<AIStrengthTask, { provider: 'deepseek' | 'anthropic' | 'xai' | 'openai'; model: string }> = {
  'legal': { provider: 'deepseek', model: 'deepseek-reasoner' },
  'strategy': { provider: 'deepseek', model: 'deepseek-reasoner' },
  'social_article': { provider: 'deepseek', model: 'deepseek-chat' },
  'social_caption': { provider: 'deepseek', model: 'deepseek-chat' },
  'inbox_reply': { provider: 'deepseek', model: 'deepseek-chat' },
  'creative_media': { provider: 'deepseek', model: 'deepseek-chat' }
=======
 * - legal/strategy -> Anthropic
 * - social_article/caption/inbox -> Grok
 * - creative_media -> OpenAI
 */
const TASK_STRENGTH_MAP: Record<AIStrengthTask, { provider: 'anthropic' | 'xai' | 'openai'; model: string }> = {
  'legal': { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
  'strategy': { provider: 'anthropic', model: 'claude-sonnet-4-6-20260217' },
  'social_article': { provider: 'xai', model: 'grok-4.3' },
  'social_caption': { provider: 'xai', model: 'grok-4.3' },
  'inbox_reply': { provider: 'xai', model: 'grok-4.3' },
  'creative_media': { provider: 'openai', model: 'gpt-4o' }
>>>>>>> origin/main
};

/**
 * Cleans content of emojis and "messed up" characters for professional articles.
 */
export function cleanProfessionalContent(content: string): string {
    // 1. Remove Emojis and Symbols
    const noEmojis = content.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])/g, '');
    
    // 2. Remove decorative symbols and "messed up" characters (unusual unicode)
    // We strictly filter to standard alphanumeric, basic punctuation, and specific currencies if needed,
    // but we remove repetitive decorative characters like ££, **, etc.
    const noDecorative = noEmojis
        .replace(/[*]{2,}/g, '') // Remove double asterisks or more
        .replace(/[£]{2,}/g, '') // Remove double pound signs or more
        .replace(/[$]{2,}/g, '') // Remove double dollar signs or more
        .replace(/[#]{2,}/g, '') // Remove double hashes or more
        .replace(/[-]{3,}/g, '-') // Reduce excessive dashes
        .replace(/[=]{2,}/g, '') // Remove decorative equals
        .replace(/[!]{2,}/g, '!') // Reduce excessive exclamation marks
        .replace(/[?]{2,}/g, '?') // Reduce excessive question marks
        .replace(/[.]{4,}/g, '...'); // Cap ellipses

    // 3. Final pass: strictly standard printable ASCII + basic Latin-1 professional subset
    const clean = noDecorative.replace(/[^\x20-\x7E\s\u00A0-\u00FF\u2010-\u2022\u20AC]/g, '');
    
    return clean.trim();
}

/**
 * Relaxed cleaner for social media that ALLOWS emojis but still removes broken characters.
 */
export function cleanSocialContent(content: string): string {
    // Keep emojis but remove non-standard control chars
    return content.replace(/[^\x20-\x7E\s\u00A0-\u00FF\u2010-\u2022\u20AC\uD800-\uDBFF\uDC00-\uDFFF]/g, '').trim();
}

/**
<<<<<<< HEAD
 * Main AI routing function with automatic fallback.
 * Default: DeepSeek only. Set AI_ALLOW_MULTI_PROVIDER=true for legacy multi-provider chain.
=======
 * Main AI routing function with automatic fallback
>>>>>>> origin/main
 */
export async function routeAIRequest(options: AIRequestOptions): Promise<AIResponse> {
  if (isDeepSeekOnlyMode()) {
    const errors: string[] = [];
    if (!deepseek) {
      throw new Error(deepSeekConfigError());
    }
    if (appendCooldownSkip(errors, 'deepseek')) {
      throwAllProvidersUnavailable(errors);
    }
    try {
      const response = await completeWithDeepSeek({
        ...options,
        model: resolveDeepSeekModel(options.model),
      });
      recordProviderSuccess('deepseek');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'deepseek', '', error);
      throwAllProvidersUnavailable(errors);
    }
  }

  const errors: string[] = [];

  // Detect provider preference from model name
  const requestedModel = options.model?.toLowerCase();

  // Specific Provider Routing
  if (requestedModel) {
    if ((requestedModel.startsWith('deepseek') || requestedModel.includes('deepseek')) && deepseek) {
      return await completeWithDeepSeek(options);
    }
    if (requestedModel.startsWith('claude') && anthropic) {
      return await completeWithAnthropic(options);
    }
    if (requestedModel.startsWith('gpt') && openai) {
      return await completeWithOpenAI(options);
    }
    if (requestedModel.startsWith('grok') && xai) {
      return await completeWithXAI(options);
    }
    if ((requestedModel.startsWith('gemini') || requestedModel.includes('gemini')) && geminiAI) {
      return await completeWithGemini(options);
    }
    if (requestedModel.startsWith('openrouter/') && openRouterClient) {
      return await completeWithOpenRouter(options);
    }
  }

  // Fallback Chain (Priority 1: DeepSeek)
  if (deepseek && !appendCooldownSkip(errors, 'deepseek')) {
    try {
      console.log('[AI Router] Attempting DeepSeek...');
      const response = await completeWithDeepSeek(options);
      console.log('[AI Router] ✓ DeepSeek succeeded');
      recordProviderSuccess('deepseek');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'deepseek', '', error);
      if (isBillingLikeFailure(error) && openRouterClient && !appendCooldownSkip(errors, 'openrouter')) {
        try {
          console.log('[AI Router] Paid provider out of credits — trying OpenRouter free models...');
          const response = await completeWithOpenRouter(options);
          console.log('[AI Router] ✓ OpenRouter succeeded');
          recordProviderSuccess('openrouter');
          return response;
        } catch (openRouterError: any) {
          recordProviderFailure(errors, 'openrouter', '', openRouterError);
        }
      }
    }
  }

  // Priority 2: OpenRouter free / universal fallback (before other paid providers)
  if (openRouterClient && !appendCooldownSkip(errors, 'openrouter')) {
    try {
      console.log('[AI Router] Attempting OpenRouter...');
      const response = await completeWithOpenRouter(
        stripIncompatibleModelForProvider('openrouter', options)
      );
      console.log('[AI Router] ✓ OpenRouter succeeded');
      recordProviderSuccess('openrouter');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'openrouter', '', error);
    }
  }

  if (isDeepSeekOnlyMode()) {
    if (errors.length > 0) {
      throwAllProvidersUnavailable(errors);
    }
    throw new Error(
      'DeepSeek is not configured. Set DEEPSEEK_API_KEY on alphaclone-web.'
    );
  }

  // Priority 3: Try Anthropic
  if (anthropic && !appendCooldownSkip(errors, 'anthropic')) {
    try {
      console.log('[AI Router] Attempting Anthropic (Claude)...');
      const response = await completeWithAnthropic(stripIncompatibleModelForProvider('anthropic', options));
      console.log('[AI Router] ✓ Anthropic succeeded');
      recordProviderSuccess('anthropic');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'anthropic', '', error);
    }
  }

  // Priority 2: Try xAI Grok
  if (xai && !appendCooldownSkip(errors, 'xai')) {
    try {
      console.log('[AI Router] Attempting xAI Grok...');
      const response = await completeWithXAI(stripIncompatibleModelForProvider('xai', options));
      console.log('[AI Router] ✓ xAI Grok succeeded');
      recordProviderSuccess('xai');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'xai', '', error);
    }
  }

  // Priority 3: Try OpenAI
  if (openai && !appendCooldownSkip(errors, 'openai')) {
    try {
      console.log(`[AI Router] Attempting OpenAI (${DEFAULT_OPENAI_MODEL})...`);
      const response = await completeWithOpenAI(stripIncompatibleModelForProvider('openai', options));
      console.log('[AI Router] ✓ OpenAI succeeded');
      recordProviderSuccess('openai');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'openai', '', error);
    }
  }

  // Priority 4: Try Gemini
  if (geminiAI && !appendCooldownSkip(errors, 'gemini')) {
    try {
      console.log('[AI Router] Attempting Google Gemini...');
      const response = await completeWithGemini(stripIncompatibleModelForProvider('gemini', options));
      console.log('[AI Router] ✓ Gemini succeeded');
      recordProviderSuccess('gemini');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'gemini', '', error);
    }
  }

  // Final OpenRouter attempt removed — already tried at priority 2

  // All providers failed
  if (errors.length > 0) {
    throwAllProvidersUnavailable(errors);
  }
  throw new Error("No AI providers are configured. Set ANTHROPIC_API_KEY, XAI_API_KEY, OPENAI_API_KEY, VITE_GEMINI_API_KEY, or OPENROUTER_API_KEY.");
}

/**
 * Specialized routing for Autonomous Operator tasks.
 * Uses the best model for the task type and cleans output of emojis.
 */
export async function routeAutonomousTask(task: AIStrengthTask, prompt: string, systemPrompt?: string): Promise<AIResponse> {
  const errors: string[] = [];
  if (deepseek && !appendCooldownSkip(errors, 'deepseek')) {
    try {
      const model = task === 'legal' || task === 'strategy' ? 'deepseek-reasoner' : 'deepseek-chat';
      const res = await completeWithDeepSeek({ prompt, systemPrompt, model });
      res.content = cleanProfessionalContent(res.content);
      return res;
    } catch (error) {
      noteAIProviderFailure('deepseek', error);
      errors.push(`DeepSeek autonomous task failed: ${error instanceof Error ? error.message : 'failed'}`);
      console.warn('[AI Router] DeepSeek failed for autonomous task, falling back:', error);
    }
  }

  const strength = TASK_STRENGTH_MAP[task] || TASK_STRENGTH_MAP['strategy'];
  
  const options = {
    prompt,
    systemPrompt,
    model: strength.model
  };

  let response: AIResponse;
  
  // Directly call the provider to avoid the general fallback chain if we know what we want
  try {
    if (strength.provider === 'anthropic' && anthropic) {
      response = await completeWithAnthropic(options);
    } else if (strength.provider === 'xai' && xai) {
      response = await completeWithXAI(options);
    } else if (strength.provider === 'openai' && openai) {
      response = await completeWithOpenAI(options);
    } else {
      // Fallback
      response = await routeAIRequest(options);
    }
  } catch (err) {
    // If specific strength provider fails, use standard failover
    response = await routeAIRequest({ ...options, model: undefined });
  }

  // ENFORCE PROFESSIONAL GUARDRAILS: No Emojis, Clean Chars
  response.content = cleanProfessionalContent(response.content);
  
  return response;
}

/**
 * Specialized routing for Autonomous Operator tasks.
 * Uses the best model for the task type and cleans output of emojis.
 */
export async function routeAutonomousTask(task: AIStrengthTask, prompt: string, systemPrompt?: string): Promise<AIResponse> {
  const strength = TASK_STRENGTH_MAP[task] || TASK_STRENGTH_MAP['strategy'];
  
  const options = {
    prompt,
    systemPrompt,
    model: strength.model
  };

  let response: AIResponse;
  
  // Directly call the provider to avoid the general fallback chain if we know what we want
  try {
    if (strength.provider === 'anthropic' && anthropic) {
      response = await completeWithAnthropic(options);
    } else if (strength.provider === 'xai' && xai) {
      response = await completeWithXAI(options);
    } else if (strength.provider === 'openai' && openai) {
      response = await completeWithOpenAI(options);
    } else {
      // Fallback
      response = await routeAIRequest(options);
    }
  } catch (err) {
    // If specific strength provider fails, use standard failover
    response = await routeAIRequest({ ...options, model: undefined });
  }

  // ENFORCE PROFESSIONAL GUARDRAILS: No Emojis, Clean Chars
  response.content = cleanProfessionalContent(response.content);
  
  return response;
}

/**
 * Streaming version of AI routing
 */
export async function streamAIRequest(options: AIRequestOptions): Promise<AIStreamResponse> {
  if (isDeepSeekOnlyMode()) {
    if (!deepseek) {
      throw new Error(deepSeekConfigError());
    }
    const errors: string[] = [];
    if (appendCooldownSkip(errors, 'deepseek')) {
      throwAllProvidersUnavailable(errors);
    }
    try {
      const model = resolveDeepSeekModel(options.model);
      const stream = await streamWithDeepSeek({ ...options, model });
      recordProviderSuccess('deepseek');
      return { stream, provider: 'deepseek', model };
    } catch (error: any) {
      recordProviderFailure(errors, 'deepseek', 'stream', error);
      throwAllProvidersUnavailable(errors);
    }
  }

  const errors: string[] = [];
  const requestedModel = options.model?.toLowerCase();

  // Specific Provider Routing
  if (requestedModel) {
    if ((requestedModel.startsWith('deepseek') || requestedModel.includes('deepseek')) && deepseek) {
      return {
        stream: await streamWithDeepSeek(options),
        provider: 'deepseek',
        model: options.model || 'deepseek-chat'
      };
    }
    if (requestedModel.startsWith('claude') && anthropic) {
      return {
        stream: await streamWithAnthropic(options),
        provider: 'anthropic',
        model: options.model || DEFAULT_CLAUDE_MODEL
      };
    }
    if (requestedModel.startsWith('gpt') && openai) {
      return {
        stream: await streamWithOpenAI(options),
        provider: 'openai',
        model: options.model || 'gpt-4-turbo'
      };
    }
    if (requestedModel.startsWith('grok') && xai) {
      return {
        stream: await streamWithXAI(options),
        provider: 'xai',
        model: options.model || 'grok-4.3'
<<<<<<< HEAD
      };
    }
    if ((requestedModel.startsWith('gemini') || requestedModel.includes('gemini')) && geminiAI) {
      return {
        stream: await streamWithGemini(options),
        provider: 'gemini',
        model: options.model || 'gemini-1.5-flash'
      };
    }
    if (requestedModel.startsWith('openrouter/') && openRouterClient) {
      return {
        stream: await streamWithOpenRouter(options),
        provider: 'openrouter',
        model: options.model || DEFAULT_OPENROUTER_MODEL,
=======
>>>>>>> origin/main
      };
    }
  }

  // Fallback Chain (Priority 1: DeepSeek)
  if (deepseek && !appendCooldownSkip(errors, 'deepseek')) {
    try {
      console.log('[AI Router] Attempting DeepSeek stream...');
      return {
        stream: await streamWithDeepSeek(options),
        provider: 'deepseek',
        model: options.model || 'deepseek-chat'
      };
    } catch (error) {
      noteAIProviderFailure('deepseek', error);
      console.warn('[AI Router] DeepSeek stream failed, falling back...');
      errors.push(`DeepSeek stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  // Priority 2: OpenRouter free / universal fallback
  if (openRouterClient && !appendCooldownSkip(errors, 'openrouter')) {
    try {
      console.log('[AI Router] Attempting OpenRouter stream...');
      return {
        stream: await streamWithOpenRouter(options),
        provider: 'openrouter',
        model: options.model || DEFAULT_OPENROUTER_MODEL,
      };
    } catch (error) {
      noteAIProviderFailure('openrouter', error);
      console.warn('[AI Router] OpenRouter stream failed, falling back...');
      errors.push(`OpenRouter stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  // Priority 3: Try Anthropic
  if (anthropic && !appendCooldownSkip(errors, 'anthropic')) {
    try {
      console.log('[AI Router] Attempting Anthropic stream...');
      return {
        stream: await streamWithAnthropic(options),
        provider: 'anthropic',
        model: options.model || DEFAULT_CLAUDE_MODEL
      };
    } catch (error) {
      noteAIProviderFailure('anthropic', error);
      console.warn('[AI Router] Anthropic stream failed, falling back...');
      errors.push(`Anthropic stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  // Priority 2: Try xAI Grok
  if (xai && !appendCooldownSkip(errors, 'xai')) {
    try {
      console.log('[AI Router] Attempting xAI stream...');
      return {
        stream: await streamWithXAI(options),
        provider: 'xai',
        model: options.model || 'grok-4.3'
      };
    } catch (error) {
      noteAIProviderFailure('xai', error);
      console.warn('[AI Router] xAI stream failed, falling back...');
      errors.push(`xAI stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  // Priority 3: Try OpenAI
  if (openai && !appendCooldownSkip(errors, 'openai')) {
    try {
      console.log('[AI Router] Attempting OpenAI stream...');
      return {
        stream: await streamWithOpenAI(options),
        provider: 'openai',
        model: options.model || 'gpt-4-turbo'
      };
    } catch (error) {
      noteAIProviderFailure('openai', error);
      console.warn('[AI Router] OpenAI stream failed, falling back...');
      errors.push(`OpenAI stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  // Priority 4: Try Gemini
  if (geminiAI && !appendCooldownSkip(errors, 'gemini')) {
    try {
      console.log('[AI Router] Attempting Gemini stream...');
      return {
        stream: await streamWithGemini(options),
        provider: 'gemini',
        model: options.model || 'gemini-1.5-flash'
      };
    } catch (error) {
      noteAIProviderFailure('gemini', error);
      console.warn('[AI Router] Gemini stream failed, falling back...');
      errors.push(`Gemini stream failed: ${error instanceof Error ? error.message : 'stream failed'}`);
    }
  }

  if (errors.length > 0) {
    throwAllProvidersUnavailable(errors);
  }
  throw new Error('No AI providers available for streaming');
}

/**
 * Complete with Anthropic (Claude)
 */
async function completeWithAnthropic(options: AIRequestOptions): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const model = normalizeClaudeModel(options.model);

  // Build request params
  const useThinking = options.extendedThinking?.enabled === true;
  const thinkingBudget = options.extendedThinking?.tokenBudget ?? 5000;
  const useCitations = options.enableCitations === true;

  const betaHeaders: string[] = [];
  if (useThinking) betaHeaders.push('interleaved-thinking-2025-05-14');
  if (useCitations) betaHeaders.push('citations-2023-06-01');

  const buildParams = (mdl: string): any => ({
    model: mdl,
    max_tokens: options.maxTokens || 8192,
    ...(useThinking ? {} : { temperature: options.temperature || 0.7 }),
    system: options.systemPrompt,
    messages: [
      {
        role: 'user',
        content: options.prompt,
      },
    ],
    ...(useThinking ? { thinking: { type: 'enabled', budget_tokens: thinkingBudget } } : {}),
    ...(betaHeaders.length ? { betas: betaHeaders } : {}),
  });

  let message;
  try {
    message = await (anthropic as any).messages.create(buildParams(model));
  } catch (error: any) {
    if (model !== 'claude-sonnet-4-20250514' && isAnthropicModelNotFound(error)) {
      message = await (anthropic as any).messages.create(buildParams('claude-sonnet-4-20250514'));
    } else {
      throw error;
    }
  }

  // Extract text, thinking, and citations from content blocks
  let content = '';
  let thinkingContent = '';
  const citations: AIResponse['citations'] = [];

  for (const block of message.content || []) {
    if (block.type === 'text') {
      content += block.text;
      // Extract inline citations if present
      if (useCitations && Array.isArray((block as any).citations)) {
        for (const c of (block as any).citations) {
          citations.push({
            document_title: c.document?.title,
            document_url: c.document?.url,
            quote: c.cited_text,
            start_char: c.start_char_index,
            end_char: c.end_char_index,
          });
        }
      }
    } else if (block.type === 'thinking') {
      thinkingContent += (block as any).thinking || '';
    }
  }

  return {
    content: content || '',
    provider: 'anthropic',
    model: model,
    success: true,
    ...(thinkingContent ? { thinkingContent } : {}),
    ...(citations.length ? { citations } : {}),
  };
}

async function completeWithXAI(options: AIRequestOptions): Promise<AIResponse> {
  if (!xai) {
    throw new Error('xAI API key not configured');
  }
  const model = normalizeXaiModel(options.model);
  const messages: any[] = [];
  messages.push({ role: 'system', content: mergeXaiSystemPrompt(options.systemPrompt) });

  // Handle Vision (Base64 Image) if provided
  if (options.image) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: options.prompt },
        {
          type: 'image_url',
          image_url: {
            url: options.image.startsWith('data:') ? options.image : `data:image/jpeg;base64,${options.image}`
          }
        }
      ]
    });
  } else {
    messages.push({ role: 'user', content: options.prompt });
  }

  let completion;
  try {
    completion = await xai.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.7,
    });
  } catch (error: any) {
    if (model !== 'grok-3-mini' && isXaiModelError(error)) {
      completion = await xai.chat.completions.create({
        model: 'grok-3-mini',
        messages,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      });
    } else {
      throw error;
    }
  }

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'xai',
    model,
    success: true,
  };
}

/**
 * Complete with OpenAI (GPT-4)
 */
async function completeWithOpenAI(options: AIRequestOptions): Promise<AIResponse> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  const model = isDeepSeekModelName(options.model)
    ? DEFAULT_OPENAI_MODEL
    : options.model || DEFAULT_OPENAI_MODEL;

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const completion = await openai.chat.completions.create({
    model: model,
    messages,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'openai',
    model: model,
    success: true,
  };
}

/**
 * Chat-specific routing (for conversational AI)
 */
export async function routeAIChat(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  image?: string,
  model?: string
): Promise<AIResponse> {
  if (isDeepSeekOnlyMode()) {
    const errors: string[] = [];
    if (!deepseek) {
      throw new Error(deepSeekConfigError());
    }
    if (appendCooldownSkip(errors, 'deepseek')) {
      throwAllProvidersUnavailable(errors);
    }
    try {
      const dsModel = resolveDeepSeekModel(model);
      const response = await chatWithDeepSeek(history, message, systemPrompt, dsModel);
      recordProviderSuccess('deepseek');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'deepseek', 'chat', error);
      throwAllProvidersUnavailable(errors);
    }
  }

  const errors: string[] = [];

  // Specific Provider Routing
  if (model) {
    const requestedModel = model.toLowerCase();
    if ((requestedModel.startsWith('deepseek') || requestedModel.includes('deepseek')) && deepseek) {
      return await chatWithDeepSeek(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('claude') && anthropic) {
      return await chatWithAnthropic(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('gpt') && openai) {
      return await chatWithOpenAI(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('grok') && xai) {
      return await chatWithXAI(history, message, systemPrompt, model, image);
    }
    if (requestedModel.startsWith('gemini') && geminiAI) {
      return await chatWithGemini(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('openrouter/') && openRouterClient) {
      return await chatWithOpenRouter(history, message, systemPrompt, model);
    }
  }

  // Priority 1: Try DeepSeek
  if (deepseek && !appendCooldownSkip(errors, 'deepseek')) {
    try {
      console.log('[AI Router] Attempting DeepSeek chat...');
      const response = await chatWithDeepSeek(history, message, systemPrompt, model);
      console.log('[AI Router] ✓ DeepSeek chat succeeded');
      recordProviderSuccess('deepseek');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'deepseek', 'chat', error);
      if (isBillingLikeFailure(error) && openRouterClient && !appendCooldownSkip(errors, 'openrouter')) {
        try {
          console.log('[AI Router] Paid provider out of credits — trying OpenRouter free chat...');
          const response = await chatWithOpenRouter(history, message, systemPrompt, model);
          recordProviderSuccess('openrouter');
          return response;
        } catch (openRouterError: any) {
          recordProviderFailure(errors, 'openrouter', 'chat', openRouterError);
        }
      }
    }
  }

  // Priority 2: OpenRouter free / universal fallback
  if (openRouterClient && !appendCooldownSkip(errors, 'openrouter')) {
    try {
      console.log('[AI Router] Attempting OpenRouter chat...');
      const orModel = resolveModelForProvider('openrouter', model) || model;
      const response = await chatWithOpenRouter(history, message, systemPrompt, orModel);
      console.log('[AI Router] ✓ OpenRouter chat succeeded');
      recordProviderSuccess('openrouter');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'openrouter', 'chat', error);
    }
  }

  if (isDeepSeekOnlyMode()) {
    if (errors.length > 0) {
      throwAllProvidersUnavailable(errors);
    }
    throw new Error(
      'DeepSeek is not configured. Set DEEPSEEK_API_KEY on alphaclone-web.'
    );
  }

  // Priority 3: Try Anthropic
  if (anthropic && !appendCooldownSkip(errors, 'anthropic')) {
    try {
      console.log('[AI Router] Attempting Anthropic chat...');
      const response = await chatWithAnthropic(history, message, systemPrompt);
      console.log('[AI Router] ✓ Anthropic chat succeeded');
      recordProviderSuccess('anthropic');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'anthropic', 'chat', error);
    }
  }

  // Priority 2: Try xAI Grok
  if (xai && !appendCooldownSkip(errors, 'xai')) {
    try {
      console.log('[AI Router] Attempting xAI chat...');
      const response = await chatWithXAI(history, message, systemPrompt, undefined, image);
      console.log('[AI Router] ✓ xAI chat succeeded');
      recordProviderSuccess('xai');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'xai', 'chat', error);
    }
  }

  // Priority 3: Try OpenAI
  if (openai && !appendCooldownSkip(errors, 'openai')) {
    try {
      console.log('[AI Router] Attempting OpenAI chat...');
      const response = await chatWithOpenAI(history, message, systemPrompt);
      console.log('[AI Router] ✓ OpenAI chat succeeded');
      recordProviderSuccess('openai');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'openai', 'chat', error);
    }
  }

  // Priority 4: Try Gemini
  if (geminiAI && !appendCooldownSkip(errors, 'gemini')) {
    try {
      console.log('[AI Router] Attempting Gemini chat...');
      const response = await chatWithGemini(history, message, systemPrompt, isDeepSeekModelName(model) ? undefined : model);
      console.log('[AI Router] ✓ Gemini chat succeeded');
      recordProviderSuccess('gemini');
      return response;
    } catch (error: any) {
      recordProviderFailure(errors, 'gemini', 'chat', error);
    }
  }

  if (errors.length > 0) {
    throwAllProvidersUnavailable(errors);
  }
  throw new Error("No AI chat providers are configured. Set ANTHROPIC_API_KEY, XAI_API_KEY, OPENAI_API_KEY, VITE_GEMINI_API_KEY, or OPENROUTER_API_KEY.");
}

/**
 * Chat with Anthropic
 */
async function chatWithAnthropic(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string
): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const selectedModel = normalizeClaudeModel(model);

  // Ensure history alternates and starts with 'user'
  const messages: Anthropic.MessageParam[] = [];

  // Anthropic REQUIRED: First message must be 'user'
  // Growth Agent starts with an 'agent' greeting, so we skip it if it's first
  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  for (const msg of validHistory) {
    const role = msg.role === 'user' ? ('user' as const) : ('assistant' as const);

    // Anthropic REQUIRED: Roles MUST alternate
    if (messages.length > 0 && messages[messages.length - 1].role === role) {
      // If consecutive roles are same, merge them or skip. Here we skip for simplicity
      // but in a production app we might join the text.
      continue;
    }

    messages.push({
      role,
      content: msg.content || (msg as any).text || '',
    });
  }

  // Ensure current message is added safely
  if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
    // This shouldn't happen with normal turns, but for safety:
    // If last was user, we'd need an assistant turn before another user turn.
    // However, 'message' is the new user turn.
  }

  let response;
  try {
    response = await anthropic.messages.create({
      model: selectedModel,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        ...messages,
        { role: 'user', content: message }
      ],
    });
  } catch (error: any) {
    if (selectedModel !== 'claude-sonnet-4-20250514' && isAnthropicModelNotFound(error)) {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: 'user', content: message }
        ],
      });
    } else {
      throw error;
    }
  }

  const content = response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content,
    provider: 'anthropic',
    model: selectedModel,
    success: true,
  };
}

/**
 * Chat with OpenAI
 */
async function chatWithOpenAI(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string
): Promise<AIResponse> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const selectedModel = model || 'gpt-4-turbo';

  // Ensure history alternates and starts with 'user'
  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  const chatMessages: any[] = [];
  for (const msg of validHistory) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
      continue;
    }
    chatMessages.push({
      role,
      content: msg.content || (msg as any).text || '',
    });
  }

  const completion = await openai.chat.completions.create({
    model: selectedModel,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...chatMessages,
      { role: 'user', content: message }
    ],
    max_tokens: 4096,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'openai',
    model: selectedModel,
    success: true,
  };
}

async function chatWithXAI(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string,
  image?: string
): Promise<AIResponse> {
  if (!xai) {
    throw new Error('xAI API key not configured');
  }
  const selectedModel = normalizeXaiModel(model);

  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  const chatMessages: any[] = [];
  for (const msg of validHistory) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
      continue;
    }
    chatMessages.push({
      role,
      content: msg.content || (msg as any).text || '',
    });
  }

  // Handle Vision for the latest message if image is provided
  const finalMessageContent = image 
    ? [
        { type: 'text', text: message },
        { 
          type: 'image_url', 
          image_url: { 
            url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` 
          } 
        }
      ]
    : message;

  let completion;
  try {
    completion = await xai.chat.completions.create({
      model: selectedModel,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        ...chatMessages,
        { role: 'user', content: finalMessageContent }
      ],
      max_tokens: 4096,
      temperature: 0.7,
    });
  } catch (error: any) {
    if (selectedModel !== 'grok-3-mini' && isXaiModelError(error)) {
      completion = await xai.chat.completions.create({
        model: 'grok-3-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          ...chatMessages,
          { role: 'user', content: message }
        ],
        max_tokens: 4096,
        temperature: 0.7,
      });
    } else {
      throw error;
    }
  }

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'xai',
    model: selectedModel,
    success: true,
  };
}

/**
 * Complete with OpenRouter
 */
async function completeWithOpenRouter(options: AIRequestOptions): Promise<AIResponse> {
  if (!openRouterClient) {
    throw new Error('OpenRouter API key not configured');
  }

  let model = options.model || DEFAULT_OPENROUTER_MODEL;
  if (model.startsWith('openrouter/')) {
    model = model.replace('openrouter/', '');
  }
  if (isDeepSeekModelName(model)) {
    model = resolveModelForProvider('openrouter', model) || DEFAULT_OPENROUTER_MODEL;
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const models = [
    model,
    ...OPENROUTER_FALLBACK_MODELS.filter((candidate) => candidate !== model),
  ];

  let lastError = 'OpenRouter request failed';
  for (const candidate of models) {
    try {
      const { content, model: usedModel } = await requestOpenRouterCompletion(messages, {
        model: candidate,
        maxTokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
      });
      return {
        content,
        provider: 'openrouter',
        model: usedModel,
        success: true,
      };
    } catch (error: any) {
      lastError = error?.message || lastError;
    }
  }

  throw new Error(lastError);
}

/**
 * Chat with OpenRouter
 */
async function chatWithOpenRouter(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string
): Promise<AIResponse> {
  if (!openRouterClient) {
    throw new Error('OpenRouter API key not configured');
  }

  let selectedModel = model || DEFAULT_OPENROUTER_MODEL;
  if (selectedModel.startsWith('openrouter/')) {
    selectedModel = selectedModel.replace('openrouter/', '');
  }

  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  for (const msg of validHistory) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
      continue;
    }
    chatMessages.push({
      role,
      content: msg.content || (msg as any).text || '',
    });
  }
  if (systemPrompt) {
    chatMessages.unshift({ role: 'system', content: systemPrompt });
  }
  chatMessages.push({ role: 'user', content: message });

  const models = [
    selectedModel,
    ...OPENROUTER_FALLBACK_MODELS.filter((candidate) => candidate !== selectedModel),
  ];

  let lastError = 'OpenRouter chat failed';
  for (const candidate of models) {
    try {
      const { content, model: usedModel } = await requestOpenRouterCompletion(chatMessages, {
        model: candidate,
        maxTokens: 4096,
      });
      return {
        content,
        provider: 'openrouter',
        model: usedModel,
        success: true,
      };
    } catch (error: any) {
      lastError = error?.message || lastError;
    }
  }

  throw new Error(lastError);
}

/**
 * Check which AI providers are available
 */
export function getAvailableProviders() {
  return {
    anthropic: !!anthropic,
    xai: !!xai,
    openai: !!openai,
    openrouter: !!openRouterClient,
    gemini: !!ENV.VITE_GEMINI_API_KEY,
    deepseek: !!deepseek,
  };
}

/**
 * Get the primary provider name for display
 */
export function getPrimaryProvider(): string {
  if (deepseek) return 'DeepSeek';
  if (anthropic) return 'Claude (Anthropic)';
  if (xai) return 'Grok (xAI)';
  if (openai) return 'GPT-4 (OpenAI)';
  if (openRouterClient) return 'OpenRouter';
  if (geminiAI) return 'Gemini';
  return 'No AI provider configured';
}

/**
 * Get available Claude models
 */
export function getClaudeModels() {
  return CLAUDE_MODELS;
}

/**
 * Get model recommendations based on task
 */
export function getRecommendedModel(taskType: string): { provider: 'deepseek' | 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter'; model: string } {
  const recommendations: Record<string, { provider: 'deepseek' | 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter'; model: string }> = {
    'contract_generation': { provider: 'deepseek', model: 'deepseek-reasoner' },
    'document_analysis': { provider: 'deepseek', model: 'deepseek-reasoner' },
    'code_generation': { provider: 'deepseek', model: 'deepseek-reasoner' },
    'email_drafting': { provider: 'deepseek', model: 'deepseek-chat' },
    'summarization': { provider: 'deepseek', model: 'deepseek-chat' },
    'chat': { provider: 'deepseek', model: 'deepseek-chat' },
    'quick_task': { provider: 'deepseek', model: 'deepseek-chat' },
    'translation': { provider: 'deepseek', model: 'deepseek-chat' },
  };

  return recommendations[taskType] || { provider: 'deepseek', model: 'deepseek-chat' };
}

/**
 * Estimate cost before making request
 */
export function estimateCost(prompt: string, model: string): number {
  // Rough token estimation (1 token ≈ 4 characters)
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = 500; // Assume 500 token response

  const pricing = (MODEL_PRICING as any)[model] || MODEL_PRICING['claude-sonnet-4-5-20250929'];
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}

/**
 * Stream with Anthropic
 */
async function streamWithAnthropic(options: AIRequestOptions): Promise<ReadableStream> {
  if (!anthropic) throw new Error('Anthropic not configured');

  const model = normalizeClaudeModel(options.model);
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      let stream: any;
      try {
        stream = await anthropic.messages.create({
          model: model,
          max_tokens: options.maxTokens || 8192,
          temperature: options.temperature || 0.7,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: options.prompt }],
          stream: true,
        });
      } catch (error: any) {
        if (model !== 'claude-sonnet-4-5-20250929' && isAnthropicModelNotFound(error)) {
          stream = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: options.maxTokens || 8192,
            temperature: options.temperature || 0.7,
            system: options.systemPrompt,
            messages: [{ role: 'user', content: options.prompt }],
            stream: true,
          });
        } else {
          throw error;
        }
      }

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });
}

/**
 * Stream with OpenAI
 */
async function streamWithOpenAI(options: AIRequestOptions): Promise<ReadableStream> {
  if (!openai) throw new Error('OpenAI not configured');

  const model = options.model || 'gpt-4-turbo';
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const stream = await openai.chat.completions.create({
        model: model,
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: options.prompt },
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          controller.enqueue(encoder.encode(content));
        }
      }
      controller.close();
    },
  });
}

async function streamWithOpenRouter(options: AIRequestOptions): Promise<ReadableStream> {
  if (!openRouterClient) throw new Error('OpenRouter not configured');

  let model = options.model || DEFAULT_OPENROUTER_MODEL;
  if (model.startsWith('openrouter/')) {
    model = model.replace('openrouter/', '');
  }
  if (isDeepSeekModelName(model)) {
    model = resolveModelForProvider('openrouter', model) || DEFAULT_OPENROUTER_MODEL;
  }

  const encoder = new TextEncoder();
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  return new ReadableStream({
    async start(controller) {
      try {
        await streamOpenRouterCompletion(
          messages,
          {
            model,
            maxTokens: options.maxTokens || 4096,
            temperature: options.temperature || 0.7,
          },
          (chunk) => {
            controller.enqueue(encoder.encode(chunk));
          }
        );
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Complete with Google Gemini
 */
async function completeWithGemini(options: AIRequestOptions): Promise<AIResponse> {
  if (!geminiAI) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = isDeepSeekModelName(options.model)
    ? 'gemini-1.5-flash'
    : options.model || 'gemini-1.5-flash';
  const model = geminiAI.getGenerativeModel({
    model: modelName,
    ...(options.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
  });

  const result = await model.generateContent(options.prompt);
  const content = result.response.text() || '';

  return {
    content,
    provider: 'gemini',
    model: modelName,
    success: true,
  };
}

/**
 * Chat with Google Gemini
 */
async function chatWithGemini(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string
): Promise<AIResponse> {
  if (!geminiAI) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = model || 'gemini-1.5-flash';
  const geminiModel = geminiAI.getGenerativeModel({
    model: modelName,
    ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
  });

  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  const contents: any[] = [];
  for (const msg of validHistory) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  const chat = geminiModel.startChat({
    history: contents,
  });

  const result = await chat.sendMessage(message);
  const content = result.response.text() || '';

  return {
    content,
    provider: 'gemini',
    model: modelName,
    success: true,
  };
}

/**
 * Stream with Google Gemini
 */
async function streamWithGemini(options: AIRequestOptions): Promise<ReadableStream> {
  if (!geminiAI) {
    throw new Error('Gemini API key not configured');
  }

  const modelName = options.model || 'gemini-1.5-flash';
  const geminiModel = geminiAI.getGenerativeModel({
    model: modelName,
    ...(options.systemPrompt ? { systemInstruction: options.systemPrompt } : {}),
  });
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const result = await geminiModel.generateContentStream(options.prompt);
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err: any) {
        controller.enqueue(encoder.encode(`[Gemini stream error: ${err.message}]`));
      } finally {
        controller.close();
      }
    },
  });
}

async function streamWithXAI(options: AIRequestOptions): Promise<ReadableStream> {
  if (!xai) throw new Error('xAI not configured');

  const model = normalizeXaiModel(options.model);
  const encoder = new TextEncoder();

  // Vision support in stream if provided
  const userContent = options.image
    ? [
        { type: 'text', text: options.prompt },
        {
          type: 'image_url',
          image_url: {
            url: options.image.startsWith('data:') ? options.image : `data:image/jpeg;base64,${options.image}`
          }
        }
      ]
    : options.prompt;

  return new ReadableStream({
    async start(controller) {
      const stream = await xai.chat.completions.create({
        model,
        messages: [
          { role: 'system' as const, content: mergeXaiSystemPrompt(options.systemPrompt) },
          { role: 'user' as const, content: userContent as any },
<<<<<<< HEAD
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          controller.enqueue(encoder.encode(content));
        }
      }
      controller.close();
    },
  });
}

/**
 * Complete with DeepSeek
 */
async function completeWithDeepSeek(options: AIRequestOptions): Promise<AIResponse> {
  if (!deepseek) {
    throw new Error('DeepSeek API key not configured');
  }
  const model = resolveDeepSeekModel(options.model);

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const completion = await deepseek.chat.completions.create({
    model: model,
    messages,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'deepseek',
    model: model,
    success: true,
  };
}

/**
 * Stream with DeepSeek
 */
async function streamWithDeepSeek(options: AIRequestOptions): Promise<ReadableStream> {
  if (!deepseek) throw new Error('DeepSeek not configured');

  const model = options.model || 'deepseek-chat';
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const stream = await deepseek.chat.completions.create({
        model: model,
        messages: [
          ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
          { role: 'user' as const, content: options.prompt },
=======
>>>>>>> origin/main
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          controller.enqueue(encoder.encode(content));
        }
      }
      controller.close();
    },
  });
}

/**
 * Chat with DeepSeek
 */
async function chatWithDeepSeek(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string,
  model?: string
): Promise<AIResponse> {
  if (!deepseek) {
    throw new Error('DeepSeek API key not configured');
  }

  const selectedModel = model || 'deepseek-chat';

  // Ensure history alternates and starts with 'user'
  const validHistory = history.filter((msg, idx) => {
    if (idx === 0 && msg.role !== 'user') return false;
    return true;
  });

  const chatMessages: any[] = [];
  for (const msg of validHistory) {
    const role = msg.role === 'user' ? 'user' : 'assistant';
    if (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === role) {
      continue;
    }
    chatMessages.push({
      role,
      content: msg.content || (msg as any).text || '',
    });
  }

  const completion = await deepseek.chat.completions.create({
    model: selectedModel,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...chatMessages,
      { role: 'user', content: message }
    ],
    max_tokens: 4096,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'deepseek',
    model: selectedModel,
    success: true,
  };
}
