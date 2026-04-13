/**
 * AI Router Service
 * Smart routing with fallback chain: Anthropic (Claude) → OpenAI → Gemini
 *
 * Priority Order:
 * 1. Anthropic Claude (primary - best for contracts, legal, analysis)
 * 2. OpenAI GPT-4 (secondary - good for creative tasks)
 * 3. Google Gemini (tertiary - fallback)
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

// Initialize clients using validated ENV
const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

const openai = ENV.OPENAI_API_KEY
  ? new OpenAI({ apiKey: ENV.OPENAI_API_KEY })
  : null;

const openRouterClient = ENV.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: ENV.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://alphaclone.tech',
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
  provider: 'anthropic' | 'openai' | 'gemini' | 'openrouter';
  model: string;
  success: boolean;
  error?: string;
}

export interface AIStreamResponse {
  stream: ReadableStream;
  provider: 'anthropic' | 'openai' | 'openrouter';
  model: string;
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

  // Priority 2: Try OpenAI
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
    : "No AI providers are configured. Please check your .env file for ANTHROPIC_API_KEY or OPENAI_API_KEY.";

  throw new Error(finalError);
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

  // Priority 2: Try OpenAI
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

  const message = await anthropic.messages.create({
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

  const content = message.content[0].type === 'text' ? message.content[0].text : '';

  return {
    content,
    provider: 'anthropic',
    model: model,
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

  // Priority 2: Try OpenAI
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
    : "No AI chat providers are configured. Please check your .env file for ANTHROPIC_API_KEY or OPENAI_API_KEY.";

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

  const response = await anthropic.messages.create({
    model: selectedModel,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [
      ...messages,
      { role: 'user', content: message }
    ],
  });

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
export function getRecommendedModel(taskType: string): { provider: 'anthropic' | 'openai' | 'gemini' | 'openrouter'; model: string } {
  const recommendations: Record<string, { provider: 'anthropic' | 'openai' | 'gemini' | 'openrouter'; model: string }> = {
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
      const stream = await anthropic.messages.create({
        model: model,
        max_tokens: options.maxTokens || 8192,
        temperature: options.temperature || 0.7,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: options.prompt }],
        stream: true,
      });

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
