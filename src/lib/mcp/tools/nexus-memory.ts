// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import {
  buildMemoryContextBlock,
  getMemory,
  upsertMemory,
  type NexusMemoryCategory,
} from '@/services/nexusMemoryService';

registerTool('nexus-memory', {
  name: 'get_nexus_memory',
  description: 'Read persistent tenant memory facts stored in nexus_memory (preferences, patterns, workflows).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    category: z
      .enum(['preference', 'pattern', 'workflow', 'reliability', 'general'])
      .optional(),
    key: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      category: { type: 'string' },
      key: { type: 'string' },
      limit: { type: 'number', default: 50 },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const rows = await getMemory(args.tenant_id, {
      category: args.category as NexusMemoryCategory | undefined,
      key: args.key,
      limit: args.limit,
    });
    const contextBlock = await buildMemoryContextBlock(args.tenant_id, 8);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ memories: rows, context_block: contextBlock }, null, 2),
      }],
    };
  },
});

registerTool('nexus-memory', {
  name: 'upsert_nexus_memory',
  description: 'Write or update a persistent memory fact for the tenant in nexus_memory.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    category: z.enum(['preference', 'pattern', 'workflow', 'reliability', 'general']),
    key: z.string().min(1).max(80),
    value: z.record(z.unknown()),
    source: z.enum(['dream', 'manual', 'agent']).optional().default('agent'),
    confidence: z.number().min(0).max(1).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      category: { type: 'string' },
      key: { type: 'string' },
      value: { type: 'object' },
      source: { type: 'string' },
      confidence: { type: 'number' },
    },
    required: ['tenant_id', 'category', 'key', 'value'],
  },
  handler: async (args) => {
    const result = await upsertMemory(args.tenant_id, {
      category: args.category,
      key: args.key,
      value: args.value,
      source: args.source,
      confidence: args.confidence,
    });
    if (!result.success) throw new Error(result.error || 'Failed to upsert memory');
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, id: result.id }, null, 2) }],
    };
  },
});
