/**
 * Anthropic Prompt Caching Service
 *
 * Implements Anthropic's prompt caching API (cache_control: { type: 'ephemeral' }).
 * Reduces costs and latency for repeated long-context calls (system prompts, documents, tools).
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '@/config/env';

const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

export interface CachedPromptRequest {
  model?: string;
  systemPrompt: string;
  userMessage: string;
  /** Optional additional context to cache (e.g. large documents) */
  cachedContext?: string;
  maxTokens?: number;
}

export interface CachedPromptResponse {
  content: string;
  cacheCreationInputTokens?: number;
  cacheReadInputTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
}

/**
 * Calls Claude with prompt caching enabled.
 * The system prompt (and optional context) are marked with cache_control: ephemeral
 * so they are cached for up to 5 minutes across repeated calls.
 */
export async function callWithPromptCaching(
  req: CachedPromptRequest
): Promise<CachedPromptResponse> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const model = req.model || 'claude-sonnet-4-20250514';

  // Build system content with cache control on the expensive parts
  const systemContent: any[] = [
    {
      type: 'text',
      text: req.systemPrompt,
      cache_control: { type: 'ephemeral' },
    },
  ];

  // Optionally cache a large context block (e.g. document, knowledge base)
  if (req.cachedContext) {
    systemContent.push({
      type: 'text',
      text: req.cachedContext,
      cache_control: { type: 'ephemeral' },
    });
  }

  const response = await (anthropic as any).messages.create({
    model,
    max_tokens: req.maxTokens || 4096,
    system: systemContent,
    messages: [{ role: 'user', content: req.userMessage }],
    betas: ['prompt-caching-2024-07-31'],
  });

  const content = response.content?.[0]?.type === 'text' ? response.content[0].text : '';
  const usage = response.usage || {};

  return {
    content,
    cacheCreationInputTokens: usage.cache_creation_input_tokens,
    cacheReadInputTokens: usage.cache_read_input_tokens,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
  };
}
