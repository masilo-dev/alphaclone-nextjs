/**
 * Anthropic Message Batches Service
 *
 * Implements the Anthropic Message Batches API for sending bulk personalized outreach
 * at 50% cost reduction with up to 100k requests per batch.
 *
 * Reference: https://docs.anthropic.com/en/docs/build-with-claude/message-batches
 */

import Anthropic from '@anthropic-ai/sdk';
import { ENV } from '@/config/env';

const anthropic = ENV.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: ENV.ANTHROPIC_API_KEY })
  : null;

export interface BatchRequest {
  /** Unique ID for this request within the batch (e.g. contact ID) */
  custom_id: string;
  /** The user message to send */
  userMessage: string;
  /** Optional system prompt override for this request */
  systemPrompt?: string;
  maxTokens?: number;
}

export interface BatchResult {
  custom_id: string;
  result: 'success' | 'error';
  content?: string;
  error?: string;
}

/**
 * Creates a new Anthropic Message Batch for bulk personalized outreach.
 * Returns the batch ID — call pollBatch() to retrieve results.
 */
export async function createMessageBatch(
  requests: BatchRequest[],
  model = 'claude-sonnet-4-20250514',
  defaultSystemPrompt?: string
): Promise<string> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  if (requests.length === 0) {
    throw new Error('At least one request is required');
  }
  if (requests.length > 100_000) {
    throw new Error('Maximum 100,000 requests per batch');
  }

  const batchRequests = requests.map(req => ({
    custom_id: req.custom_id,
    params: {
      model,
      max_tokens: req.maxTokens || 1024,
      ...(req.systemPrompt || defaultSystemPrompt
        ? { system: req.systemPrompt || defaultSystemPrompt }
        : {}),
      messages: [{ role: 'user', content: req.userMessage }],
    },
  }));

  const batch = await (anthropic as any).beta.messages.batches.create({
    requests: batchRequests,
  });

  return batch.id;
}

/**
 * Polls the status of a batch. Returns the batch status and results if complete.
 */
export async function getBatchStatus(batchId: string): Promise<{
  id: string;
  status: 'in_progress' | 'ended' | 'canceling' | 'canceled';
  requestCounts: { processing: number; succeeded: number; errored: number; canceled: number; expired: number };
  resultsUrl?: string;
}> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const batch = await (anthropic as any).beta.messages.batches.retrieve(batchId);

  return {
    id: batch.id,
    status: batch.processing_status,
    requestCounts: {
      processing: batch.request_counts?.processing ?? 0,
      succeeded: batch.request_counts?.succeeded ?? 0,
      errored: batch.request_counts?.errored ?? 0,
      canceled: batch.request_counts?.canceled ?? 0,
      expired: batch.request_counts?.expired ?? 0,
    },
    resultsUrl: batch.results_url,
  };
}

/**
 * Streams results from a completed batch.
 * Returns an array of BatchResult objects.
 */
export async function getBatchResults(batchId: string): Promise<BatchResult[]> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }

  const results: BatchResult[] = [];

  for await (const result of await (anthropic as any).beta.messages.batches.results(batchId)) {
    if (result.result.type === 'succeeded') {
      const msg = result.result.message;
      const content = msg.content?.[0]?.type === 'text' ? msg.content[0].text : '';
      results.push({ custom_id: result.custom_id, result: 'success', content });
    } else {
      results.push({
        custom_id: result.custom_id,
        result: 'error',
        error: result.result.error?.message || 'Unknown batch error',
      });
    }
  }

  return results;
}

/**
 * Cancels an in-progress batch.
 */
export async function cancelBatch(batchId: string): Promise<void> {
  if (!anthropic) {
    throw new Error('Anthropic API key not configured');
  }
  await (anthropic as any).beta.messages.batches.cancel(batchId);
}
