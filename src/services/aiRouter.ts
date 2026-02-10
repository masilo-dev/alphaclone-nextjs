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

// Initialize clients
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
      console.error(`[AI Router] ✗ ${errorMsg}`);
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
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  // Priority 3: Try Gemini (fallback)
  if (process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    try {
      console.log('[AI Router] Attempting Gemini (fallback)...');
      const response = await completeWithGemini(options);
      console.log('[AI Router] ✓ Gemini succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `Gemini failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  // All providers failed
  throw new Error(`All AI providers failed:\n${errors.join('\n')}`);
}

/**
 * Complete with Anthropic (Claude)
 */
async function completeWithAnthropic(options: AIRequestOptions): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929', // Latest Claude Sonnet 4.5
    max_tokens: options.maxTokens || 4096,
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
    model: 'claude-sonnet-4',
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
  image?: string
): Promise<AIResponse> {
  const errors: string[] = [];

  // Priority 1: Try Anthropic
  if (anthropic) {
    try {
      console.log('[AI Router] Attempting Anthropic chat...');
      const response = await chatWithAnthropic(history, message);
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
      const response = await chatWithOpenAI(history, message);
      console.log('[AI Router] ✓ OpenAI chat succeeded');
      return response;
    } catch (error: any) {
      const errorMsg = `OpenAI chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  // Priority 3: Try Gemini (supports vision)
  if (process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    try {
      console.log('[AI Router] Attempting Gemini chat...');
      // Convert history format: content → text
      const geminiHistory = history.map(msg => ({
        role: msg.role,
        text: msg.content
      }));
      const result = await chatWithGemini(geminiHistory, message, image);
      console.log('[AI Router] ✓ Gemini chat succeeded');

      return {
        content: result.text || '',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        success: true,
      };
    } catch (error: any) {
      const errorMsg = `Gemini chat failed: ${error.message}`;
      console.error(`[AI Router] ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  throw new Error(`All AI chat providers failed:\n${errors.join('\n')}`);
}

/**
 * Chat with Anthropic
 */
async function chatWithAnthropic(
  history: Array<{ role: string; content: string }>,
  message: string
): Promise<AIResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  // Convert history to Anthropic format
  const messages = [
    ...history.map(msg => ({
      role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages,
  });

  const content = response.content[0].type === 'text' ? response.content[0].text : '';

  return {
    content,
    provider: 'anthropic',
    model: 'claude-sonnet-4',
    success: true,
  };
}

/**
 * Chat with OpenAI
 */
async function chatWithOpenAI(
  history: Array<{ role: string; content: string }>,
  message: string
): Promise<AIResponse> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }

  const messages = [
    ...history.map(msg => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: msg.content,
    })),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo',
    messages,
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
    gemini: !!(process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY),
  };
}

/**
 * Get the primary provider name for display
 */
export function getPrimaryProvider(): string {
  if (anthropic) return 'Claude (Anthropic)';
  if (openai) return 'GPT-4 (OpenAI)';
  if (process.env.VITE_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    return 'Gemini (Google)';
  }
  return 'No AI provider configured';
}
