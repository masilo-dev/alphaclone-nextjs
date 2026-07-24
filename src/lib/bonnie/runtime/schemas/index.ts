/**
 * Zod schemas for durable runtime agent I/O and events.
 * Model output must pass these before tools execute.
 */

import { z } from 'zod';

export const executionModeSchema = z.enum([
  'ask_only',
  'plan_only',
  'approval_required',
  'semi_autonomous',
  'autonomous_low_risk',
]);

export const riskLevelSchema = z.enum(['low', 'medium', 'high', 'critical']);

export const taskStatusSchema = z.enum([
  'DRAFT',
  'READY',
  'QUEUED',
  'CLAIMED',
  'RUNNING',
  'WAITING_FOR_DEPENDENCY',
  'WAITING_FOR_EVENT',
  'WAITING_FOR_APPROVAL',
  'WAITING_FOR_USER',
  'RETRY_SCHEDULED',
  'PAUSED',
  'EXECUTION_UNCERTAIN',
  'COMPLETED',
  'PARTIALLY_COMPLETED',
  'FAILED',
  'CANCELLED',
  'SKIPPED',
  'COMPENSATING',
  'ROLLED_BACK',
]);

export const thinQueuePayloadSchema = z.object({
  task_id: z.string().uuid(),
  run_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  correlation_id: z.string().uuid().nullable().optional(),
});

export const eventEnvelopeSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.string().min(1),
  event_version: z.number().int().positive().default(1),
  tenant_id: z.string().uuid(),
  workspace_id: z.string().uuid().nullable().optional(),
  actor_type: z.string().optional(),
  actor_id: z.string().optional(),
  entity_type: z.string().nullable().optional(),
  entity_id: z.string().nullable().optional(),
  correlation_id: z.string().nullable().optional(),
  causation_id: z.string().nullable().optional(),
  occurred_at: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
  authenticity_metadata: z.record(z.string(), z.unknown()).optional(),
});

export const agentHandoffSchema = z.object({
  sourceAgentId: z.string().min(1),
  destinationAgentId: z.string().min(1),
  goal: z.string().min(1),
  currentTaskId: z.string().uuid().optional(),
  reason: z.string().min(1),
  structuredContext: z.record(z.string(), z.unknown()).default({}),
  expectedOutput: z.record(z.string(), z.unknown()).default({}),
  deadline: z.string().datetime().nullable().optional(),
  priority: z.number().int().min(1).max(5).default(3),
  permissions: z.array(z.string()).default([]),
  linkedRecords: z.array(z.record(z.string(), z.unknown())).default([]),
  previousResults: z.array(z.record(z.string(), z.unknown())).default([]),
});

export const invoiceChaseTargetSchema = z.object({
  invoiceId: z.string().min(1),
  customerId: z.string().nullable().optional(),
  amountDue: z.union([z.string(), z.number()]).optional(),
  currency: z.string().optional(),
  daysOverdue: z.number().int().nonnegative().optional(),
});

export const chasingPolicySchema = z.object({
  targetType: z.enum([
    'unpaid_invoice',
    'unanswered_proposal',
    'missing_signature',
    'unresponsive_lead',
    'document_approval',
    'failed_payment',
    'expiring_contract',
    'support_escalation',
  ]),
  terminalOutcomes: z.array(z.string()).min(1),
  followUpIntervalHours: z.number().positive().default(72),
  maxAttempts: z.number().int().positive().max(20).default(5),
  channel: z.enum(['email', 'sms', 'in_app', 'mixed']).default('email'),
  requireApproval: z.boolean().default(true),
  escalationAfterAttempts: z.number().int().positive().default(3),
  respectWorkingHours: z.boolean().default(true),
  respectOptOut: z.boolean().default(true),
  stopOn: z.array(z.string()).default(['PAID', 'DISPUTED', 'CANCELLED', 'OPTED_OUT']),
});

export const verificationResultSchema = z.object({
  verified: z.boolean(),
  outcome: z.enum([
    'COMPLETED',
    'COMPLETED_WITH_EXCEPTIONS',
    'PARTIALLY_COMPLETED',
    'BLOCKED',
    'FAILED',
    'CANCELLED',
    'UNVERIFIED',
  ]),
  checks: z.array(
    z.object({
      name: z.string(),
      passed: z.boolean(),
      detail: z.string().optional(),
      evidence: z.record(z.string(), z.unknown()).optional(),
    })
  ),
  summary: z.string(),
});

export const createRunRequestSchema = z.object({
  tenantId: z.string().uuid(),
  objective: z.string().min(3).max(4000),
  conversationId: z.string().uuid().nullable().optional(),
  executionMode: executionModeSchema.optional(),
  priority: z.number().int().min(1).max(5).optional(),
  successCriteria: z.record(z.string(), z.unknown()).optional(),
  seedGraph: z.boolean().optional(),
  workflowTemplate: z.enum(['generic', 'invoice_collection']).optional(),
});

export type ChasingPolicy = z.infer<typeof chasingPolicySchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type InvoiceChaseTarget = z.infer<typeof invoiceChaseTargetSchema>;
