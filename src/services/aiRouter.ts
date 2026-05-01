/**
 * AI Router Service
 * Smart routing with fallback chain: Anthropic (Claude) → xAI Grok → OpenAI → Gemini
 *
 * Priority Order:
 * 1. Anthropic Claude (primary - best for contracts, legal, analysis)
 * 2. xAI Grok (secondary - strong reasoning and realtime-style answers)
 * 3. OpenAI GPT-4 (tertiary - good for creative tasks)
 * 4. Google Gemini (fallback)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ENV } from '@/config/env';
import { CLAUDE_MODELS, DEFAULT_CLAUDE_MODEL, DEFAULT_OPENAI_MODEL } from '@/config/aiModels';

const CLAUDE_ALLOWED_MODELS = new Set<string>([
  'claude-sonnet-4-6-20260217',
  'claude-sonnet-4-5-20250929',
]);

const CLAUDE_MODEL_ALIASES: Record<string, string> = {
  // Keep compatibility for older callers, but route only to allowed Claude 4.x models.
  'claude-haiku-4-5-20251015': 'claude-sonnet-4-5-20250929',
  'claude-3-5-sonnet-20241022': 'claude-sonnet-4-5-20250929',
  'claude-3-5-haiku-20241022': 'claude-sonnet-4-5-20250929',
};

function normalizeClaudeModel(model?: string): string {
  const rawCandidate = (model || DEFAULT_CLAUDE_MODEL).trim();
  const candidate = CLAUDE_MODEL_ALIASES[rawCandidate] || rawCandidate;
  if (CLAUDE_ALLOWED_MODELS.has(candidate)) {
    return candidate;
  }
  // Hard guard: never call other Claude models.
  return 'claude-sonnet-4-5-20250929';
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
- Do not use emojis. Keep a professional, neutral tone unless the user asks otherwise.`;

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

// Model pricing (per 1M tokens)
export const MODEL_PRICING = {
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
}

export interface AIResponse {
  content: string;
  provider: 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter';
  model: string;
  success: boolean;
  error?: string;
}

export interface AIStreamResponse {
  stream: ReadableStream;
  provider: 'anthropic' | 'xai' | 'openai' | 'openrouter';
  model: string;
}

/**
 * Tasks for Strength-Based Routing
 */
export type AIStrengthTask = 'legal' | 'strategy' | 'social_article' | 'social_caption' | 'creative_media' | 'inbox_reply';

/**
 * Route by strength mapping:
 * - legal/strategy -> Anthropic
 * - social_article/caption/inbox -> Grok
 * - creative_media -> OpenAI
 */
const TASK_STRENGTH_MAP: Record<AIStrengthTask, { provider: 'anthropic' | 'xai' | 'openai'; model: string }> = {
  'legal': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  'strategy': { provider: 'anthropic', model: 'claude-sonnet-4-6-20260217' },
  'social_article': { provider: 'xai', model: 'grok-4.3' },
  'social_caption': { provider: 'xai', model: 'grok-4.3' },
  'inbox_reply': { provider: 'xai', model: 'grok-4.3' },
  'creative_media': { provider: 'openai', model: 'gpt-4o' }
};

/**
 * Cleans content of emojis and "messed up" characters for professional articles.
 */
export function cleanProfessionalContent(content: string): string {
    // 1. Remove Emojis and Symbols
    const noEmojis = content.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF])/g, '');
    
    // 2. Remove "messed up" characters (unusual unicode that often fails in social platforms)
    const clean = noEmojis.replace(/[^\x20-\x7E\s\u00A0-\u00FF\u2010-\u2022\u20AC]/g, '');
    
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
 * Main AI routing function with automatic fallback
 */
export async function routeAIRequest(options: AIRequestOptions): Promise<AIResponse> {
  const errors: string[] = [];

  // Detect provider preference from model name
  const requestedModel = options.model?.toLowerCase();

  // Specific Provider Routing
  if (requestedModel) {
    if (requestedModel.startsWith('claude') && anthropic) {
      return await completeWithAnthropic(options);
    }
    if (requestedModel.startsWith('gpt') && openai) {
      return await completeWithOpenAI(options);
    }
    if (requestedModel.startsWith('grok') && xai) {
      return await completeWithXAI(options);
    }
    if (requestedModel.startsWith('openrouter/') && openRouterClient) {
      return await completeWithOpenRouter(options);
    }
  }

  // Fallback Chain (Priority 1: Anthropic)
  if (anthropic) {
    try {
      console.log('[AI Router] Attempting Anthropic (Claude)...');
      const response = await completeWithAnthropic(options);
      console.log('[AI Router] ✓ Anthropic succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `Anthropic failed: ${error.message}`;
      console.error(`[AI Router] ✗ Anthropic Error:`, error);
      errors.push(errorMsg);
    }
  }

  // Priority 2: Try xAI Grok
  if (xai) {
    try {
      console.log('[AI Router] Attempting xAI Grok...');
      const response = await completeWithXAI(options);
      console.log('[AI Router] ✓ xAI Grok succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `xAI failed: ${error.message}`;
      console.error(`[AI Router] ✗ xAI Error:`, error);
      errors.push(errorMsg);
    }
  }

  // Priority 3: Try OpenAI
  if (openai) {
    try {
      console.log(`[AI Router] Attempting OpenAI (${DEFAULT_OPENAI_MODEL})...`);
      const response = await completeWithOpenAI(options);
      console.log('[AI Router] ✓ OpenAI succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `OpenAI failed: ${error.message}`;
      console.error(`[AI Router] ✗ OpenAI Error:`, error);
      errors.push(errorMsg);
    }
  }

  // All providers failed
  const finalError = errors.length > 0
    ? `All AI providers failed:\n${errors.join('\n')}`
    : "No AI providers are configured. Please check your .env file for ANTHROPIC_API_KEY, XAI_API_KEY, or OPENAI_API_KEY.";

  throw new Error(finalError);
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
  const requestedModel = options.model?.toLowerCase();

  // Specific Provider Routing
  if (requestedModel) {
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
      };
    }
  }

  // Fallback Chain (Priority 1: Anthropic)
  if (anthropic) {
    try {
      console.log('[AI Router] Attempting Anthropic stream...');
      return {
        stream: await streamWithAnthropic(options),
        provider: 'anthropic',
        model: options.model || DEFAULT_CLAUDE_MODEL
      };
    } catch (error) {
      console.warn('[AI Router] Anthropic stream failed, falling back...');
    }
  }

  // Priority 2: Try xAI Grok
  if (xai) {
    try {
      console.log('[AI Router] Attempting xAI stream...');
      return {
        stream: await streamWithXAI(options),
        provider: 'xai',
        model: options.model || 'grok-4.3'
      };
    } catch (error) {
      console.warn('[AI Router] xAI stream failed, falling back...');
    }
  }

  // Priority 3: Try OpenAI
  if (openai) {
    return {
      stream: await streamWithOpenAI(options),
      provider: 'openai',
      model: options.model || 'gpt-4-turbo'
    };
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

  let message;
  try {
    message = await anthropic.messages.create({
      model: model,
      max_tokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
      system: options.systemPrompt,
      messages: [
        {
          role: 'user',
          content: options.prompt,
        },
      ],
    });
  } catch (error: any) {
    if (model !== 'claude-sonnet-4-5-20250929' && isAnthropicModelNotFound(error)) {
      message = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: options.maxTokens || 8192,
        temperature: options.temperature || 0.7,
        system: options.systemPrompt,
        messages: [
          {
            role: 'user',
            content: options.prompt,
          },
        ],
      });
    } else {
      throw error;
    }
  }

  const content = message.content[0].type === 'text' ? message.content[0].text : '';

  return {
    content,
    provider: 'anthropic',
    model: model,
    success: true,
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
  const model = options.model || DEFAULT_OPENAI_MODEL;

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
  const errors: string[] = [];

  // Specific Provider Routing
  if (model) {
    const requestedModel = model.toLowerCase();
    if (requestedModel.startsWith('claude') && anthropic) {
      return await chatWithAnthropic(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('gpt') && openai) {
      return await chatWithOpenAI(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('grok') && xai) {
      return await chatWithXAI(history, message, systemPrompt, model);
    }
    if (requestedModel.startsWith('gemini') && ENV.VITE_GEMINI_API_KEY) {
      // Gemini chat is fallback-only in this simplified router, but we can call it directly
      // Note: chatWithGemini handles its own model logic usually, but we should pass it if possible
    }
    if (requestedModel.startsWith('openrouter/') && openRouterClient) {
      return await chatWithOpenRouter(history, message, systemPrompt, model);
    }
  }

  // Priority 1: Try Anthropic
  if (anthropic) {
    try {
      console.log('[AI Router] Attempting Anthropic chat...');
      const response = await chatWithAnthropic(history, message, systemPrompt);
      console.log('[AI Router] ✓ Anthropic chat succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `Anthropic chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  // Priority 2: Try xAI Grok
  if (xai) {
    try {
      console.log('[AI Router] Attempting xAI chat...');
      const response = await chatWithXAI(history, message, systemPrompt);
      console.log('[AI Router] ✓ xAI chat succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `xAI chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  // Priority 3: Try OpenAI
  if (openai) {
    try {
      console.log('[AI Router] Attempting OpenAI chat...');
      const response = await chatWithOpenAI(history, message, systemPrompt);
      console.log('[AI Router] ✓ OpenAI chat succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `OpenAI chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  const finalError = errors.length > 0
    ? `All AI chat providers failed:\n${errors.join('\n')}`
    : "No AI chat providers are configured. Please check your .env file for ANTHROPIC_API_KEY, XAI_API_KEY, or OPENAI_API_KEY.";

  throw new Error(finalError);
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
    if (selectedModel !== 'claude-sonnet-4-5-20250929' && isAnthropicModelNotFound(error)) {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
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
  model?: string
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

  let model = options.model || 'anthropic/claude-3.5-sonnet';
  if (model.startsWith('openrouter/')) {
    model = model.replace('openrouter/', '');
  }

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const completion = await openRouterClient.chat.completions.create({
    model: model,
    messages,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'openrouter',
    model: model,
    success: true,
  };
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

  let selectedModel = model || 'anthropic/claude-3.5-sonnet';
  if (selectedModel.startsWith('openrouter/')) {
    selectedModel = selectedModel.replace('openrouter/', '');
  }

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

  const completion = await openRouterClient.chat.completions.create({
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
    provider: 'openrouter',
    model: selectedModel,
    success: true,
  };
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
  };
}

/**
 * Get the primary provider name for display
 */
export function getPrimaryProvider(): string {
  if (anthropic) return 'Claude (Anthropic)';
  if (xai) return 'Grok (xAI)';
  if (openRouterClient) return 'OpenRouter';
  if (openai) return 'GPT-4 (OpenAI)';
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
export function getRecommendedModel(taskType: string): { provider: 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter'; model: string } {
  const recommendations: Record<string, { provider: 'anthropic' | 'xai' | 'openai' | 'gemini' | 'openrouter'; model: string }> = {
    'contract_generation': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'document_analysis': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'code_generation': { provider: 'anthropic', model: 'claude-sonnet-4-6-20260217' },
    'email_drafting': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'summarization': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'chat': { provider: 'anthropic', model: 'claude-sonnet-4-6-20260217' },
    'quick_task': { provider: 'anthropic', model: 'claude-haiku-4-5-20251015' },
    'translation': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  };

  return recommendations[taskType] || { provider: 'anthropic', model: 'claude-sonnet-4-6-20260217' };
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
