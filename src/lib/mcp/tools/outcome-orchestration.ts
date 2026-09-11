import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { listSupportedOutcomesForDiscovery } from '@/lib/mcp/intentAdapter';
import { getOutcomeStatus, requestOutcome } from '@/lib/mcp/outcomeOrchestrator';

const tenantField = z.string().uuid().optional();

const requestOutcomeSchema = z
  .object({
    tenant_id: tenantField,
    outcome_key: z.string().optional(),
    intent: z.string().optional(),
    objective: z.string().optional(),
    params: z.record(z.string(), z.unknown()).optional(),
    execute: z.boolean().optional(),
    execute_actions: z.boolean().optional(),
    idempotency_key: z.string().optional(),
    caption: z.string().optional(),
    content: z.string().optional(),
    identity_id: z.string().optional(),
    platform: z.string().optional(),
    lead_id: z.string().optional(),
    to: z.string().optional(),
    subject: z.string().optional(),
    text: z.string().optional(),
  })
  .passthrough();

registerTool('outcome-orchestration', {
  name: 'list_supported_outcomes',
  description:
    'Discovery: list governed business outcomes (Content-to-Publish, Lead-to-Meeting, Send Outreach Email) with required params and step counts.',
  inputSchema: z.object({ tenant_id: tenantField }).passthrough(),
  jsonSchema: {
    type: 'object',
    properties: { tenant_id: { type: 'string', format: 'uuid' } },
    required: [],
  },
  handler: async () => {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: true,
            data: {
              outcomes: listSupportedOutcomesForDiscovery(),
              poll_tool: 'get_outcome_status',
              request_tool: 'request_outcome',
            },
          }),
        },
      ],
    };
  },
});

registerTool('outcome-orchestration', {
  name: 'request_outcome',
  description:
    'Primary outcome entry: resolve intent to a governed mission, validate params, enqueue durable Bonnie task graph. Set execute=true (or execute_actions=true) to run provider writes.',
  inputSchema: requestOutcomeSchema as unknown as z.ZodObject<any>,
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      outcome_key: {
        type: 'string',
        description: 'content_to_publish | lead_to_meeting | send_outreach_email',
      },
      intent: { type: 'string', description: 'Natural language objective when outcome_key omitted' },
      objective: { type: 'string' },
      execute: { type: 'boolean', description: 'When true, runs execute_now steps (publish, send, schedule)' },
      execute_actions: { type: 'boolean', description: 'Alias for execute' },
      params: { type: 'object', description: 'Mission-specific payload (caption, lead_id, to/subject/text, …)' },
      idempotency_key: { type: 'string' },
      caption: { type: 'string' },
      identity_id: { type: 'string' },
      platform: { type: 'string' },
      lead_id: { type: 'string' },
      to: { type: 'string' },
      subject: { type: 'string' },
      text: { type: 'string' },
    },
    required: [],
  },
  handler: async (args, ctx) => {
    const raw = args && typeof args === 'object' ? (args as Record<string, unknown>) : {};
    const nested = (raw.params && typeof raw.params === 'object' ? raw.params : {}) as Record<string, unknown>;
    const mergedParams = { ...nested, ...raw };
    delete mergedParams.params;
    delete mergedParams.tenant_id;
    delete mergedParams.outcome_key;
    delete mergedParams.intent;
    delete mergedParams.objective;
    delete mergedParams.idempotency_key;

    const result = await requestOutcome({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      outcome_key: typeof raw.outcome_key === 'string' ? raw.outcome_key : undefined,
      intent: typeof raw.intent === 'string' ? raw.intent : undefined,
      objective: typeof raw.objective === 'string' ? raw.objective : undefined,
      params: mergedParams,
      idempotency_key: typeof raw.idempotency_key === 'string' ? raw.idempotency_key : undefined,
      source: 'mcp:request_outcome',
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            ok: result.ok,
            data: result.ok
              ? {
                  outcome_key: result.outcome_key,
                  run_id: result.run_id,
                  graph_id: result.graph_id,
                  task_ids: result.task_ids,
                  correlation_id: result.correlation_id,
                  execute: result.execute,
                  steps_planned: result.steps_planned,
                  intent_confidence: result.intent.confidence,
                  poll_tool: result.poll_tool,
                }
              : undefined,
            error: result.ok
              ? undefined
              : {
                  message: result.error,
                  missing_params: result.missing_params,
                },
          }),
        },
      ],
      isError: !result.ok,
    };
  },
});

registerTool('outcome-orchestration', {
  name: 'get_outcome_status',
  description: 'Poll outcome run progress, per-step tool results, and verification summary for a Bonnie agent run.',
  inputSchema: z.object({
    tenant_id: tenantField,
    run_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      run_id: { type: 'string', format: 'uuid' },
    },
    required: ['run_id'],
  },
  handler: async (args, ctx) => {
    const runId = String((args as { run_id?: string }).run_id || '');
    const status = await getOutcomeStatus({ tenantId: ctx.tenantId, runId });
    return {
      content: [{ type: 'text', text: JSON.stringify({ ok: true, data: status }) }],
    };
  },
});
