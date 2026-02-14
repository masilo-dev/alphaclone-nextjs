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
import { geminiService, chatWithGemini } from './geminiService';
import { ENV } from '@/config/env';

// Initialize clients using validated ENV
const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

const openai = ENV.OPENAI_API_KEY
  ? new OpenAI({ apiKey: ENV.OPENAI_API_KEY })
  : null;

// Model pricing (per 1M tokens)
export const MODEL_PRICING = {
  // OpenAI (per 1M tokens)
  'gpt-4-turbo': { input: 10, output: 30 },
  'gpt-4': { input: 30, output: 60 },
  'gpt-3.5-turbo': { input: 0.5, output: 1.5 },

  // Anthropic (per 1M tokens)
  'claude-3-5-sonnet': { input: 3, output: 15 },
  'claude-3-opus': { input: 15, output: 75 },
  'claude-3-haiku': { input: 0.25, output: 1.25 },
};

export interface AIRequestOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  image?: string; // Base64 image for vision tasks
}

export interface AIResponse {
  content: string;
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  success: boolean;
  error?: string;
}

/**
 * Main AI routing function with automatic fallback
 */
export async function routeAIRequest(options: AIRequestOptions): Promise<AIResponse> {
  const errors: string[] = [];

  // Priority 1: Try Anthropic (Claude)
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
      console.log('[AI Router] Attempting OpenAI (GPT-4)...');
      const response = await completeWithOpenAI(options);
      console.log('[AI Router] ✓ OpenAI succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `OpenAI failed: ${error.message}`;
      console.error(`[AI Router] ✗ OpenAI Error:`, error);
      errors.push(errorMsg);
    }
  }

  // Priority 3: Try Gemini (fallback)
  if (ENV.VITE_GEMINI_API_KEY) {
    try {
      console.log('[AI Router] Attempting Gemini (fallback)...');
      const response = await completeWithGemini(options);
      console.log('[AI Router] ✓ Gemini succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `Gemini failed: ${error.message}`;
      console.error(`[AI Router] ✗ Gemini Error:`, error);
      errors.push(errorMsg);
    }
  }

  // All providers failed
  const finalError = errors.length > 0
    ? `All AI providers failed:\n${errors.join('\n')}`
    : "No AI providers are configured. Please check your .env file for ANTHROPIC_API_KEY, OPENAI_API_KEY, or VITE_GEMINI_API_KEY.";

  throw new Error(finalError);
}

/**
 * Complete with Anthropic (Claude)
 */
async function completeWithAnthropic(options: AIRequestOptions): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const message = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022', // Use stable date-based version
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
    model: 'claude-3-5-sonnet',
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

  const messages: any[] = [];
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt });
  }
  messages.push({ role: 'user', content: options.prompt });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
    max_tokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return {
    content: completion.choices[0]?.message?.content || '',
    provider: 'openai',
    model: 'gpt-4-turbo',
    success: true,
  };
}

/**
 * Complete with Gemini (fallback)
 */
async function completeWithGemini(options: AIRequestOptions): Promise<AIResponse> {
  const result = await geminiService.generateContent(options.prompt);

  if (result.error || !result.text) {
    throw new Error((result.error as any)?.message || 'Gemini generation failed');
  }

  return {
    content: result.text,
    provider: 'gemini',
    model: 'gemini-1.5-flash',
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
  image?: string
): Promise<AIResponse> {
  const errors: string[] = [];

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

  // Priority 3: Try Gemini (supports vision)
  if (ENV.VITE_GEMINI_API_KEY) {
    try {
      console.log('[AI Router] Attempting Gemini chat...');
      // Gemini REQUIRED: Roles MUST alternate and history should start with 'user'
      // Growth Agent greeting is 'model', so we skip if first
      const validHistory = history.filter((msg, idx) => {
        if (idx === 0 && msg.role !== 'user') return false;
        return true;
      });

      const geminiHistory: any[] = [];
      for (const msg of validHistory) {
        const role = msg.role === 'model' ? 'model' : 'user';
        if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === role) {
          continue; // Skip consecutive same roles
        }
        geminiHistory.push({
          role,
          text: msg.content || (msg as any).text || ''
        });
      }

      const result = await chatWithGemini(geminiHistory, message, image, systemPrompt);
      console.log('[AI Router] ✓ Gemini chat succeeded');

      return {
        content: result.text || '',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        success: true,
      };
    } catch (error: any) {
      const errorMsg = `Gemini chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ Gemini Chat Error:`, error);
      errors.push(errorMsg);
    }
  }

  const finalError = errors.length > 0
    ? `All AI chat providers failed:\n${errors.join('\n')}`
    : "No AI chat providers are configured. Please check your .env file for ANTHROPIC_API_KEY, OPENAI_API_KEY, or VITE_GEMINI_API_KEY.";

  throw new Error(finalError);
}

/**
 * Chat with Anthropic
 */
async function chatWithAnthropic(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string
): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

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
    model: 'claude-3-5-sonnet-20241022',
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
    model: 'claude-3-5-sonnet',
    success: true,
  };
}

/**
 * Chat with OpenAI
 */
async function chatWithOpenAI(
  history: Array<{ role: string; content: string }>,
  message: string,
  systemPrompt?: string
): Promise<AIResponse> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
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

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
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
    model: 'gpt-4-turbo',
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
    gemini: !!ENV.VITE_GEMINI_API_KEY,
  };
}

/**
 * Get the primary provider name for display
 */
export function getPrimaryProvider(): string {
  if (anthropic) return 'Claude (Anthropic)';
  if (openai) return 'GPT-4 (OpenAI)';
  if (ENV.VITE_GEMINI_API_KEY) {
    return 'Gemini (Google)';
  }
  return 'No AI provider configured';
}

/**
 * Get model recommendations based on task
 */
export function getRecommendedModel(taskType: string): { provider: 'anthropic' | 'openai' | 'gemini'; model: string } {
  const recommendations: Record<string, { provider: 'anthropic' | 'openai' | 'gemini'; model: string }> = {
    'contract_generation': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'document_analysis': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'code_generation': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'email_drafting': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'summarization': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'chat': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
    'quick_task': { provider: 'anthropic', model: 'claude-haiku-4.5' },
    'translation': { provider: 'anthropic', model: 'claude-sonnet-4-5-20250929' },
  };

  return recommendations[taskType] || { provider: 'anthropic', model: 'claude-3-5-sonnet' };
}

/**
 * Estimate cost before making request
 */
export function estimateCost(prompt: string, model: string): number {
  // Rough token estimation (1 token ≈ 4 characters)
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = 500; // Assume 500 token response

  const pricing = (MODEL_PRICING as any)[model] || MODEL_PRICING['claude-3-5-sonnet'];
  return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
}
