import { z } from 'zod';
import { defineConnectorTool, tenantIdField } from '@/lib/mcp/connector';
import { okResult } from '@/lib/mcp/connector/response';
import {
  executeBulkEmail,
  executeBulkUpdateRecords,
  executeBulkUploadMedia,
} from '@/lib/mcp/bulkOperations';

const recordTypeSchema = z.enum(['lead', 'client', 'contact', 'invoice', 'project', 'task']);
const mediaItemSchema = z.object({
  filename: z.string().min(1).max(255).optional(),
  mime_type: z.string().max(150).optional(),
  media_type: z.enum(['image', 'video', 'document']).optional(),
  purpose: z.string().max(100).optional(),
  alt_text: z.string().max(1000).optional(),
  source_url: z.string().url().optional(),
  content_base64: z.string().min(1).optional(),
  data_url: z.string().min(1).optional(),
}).refine((item) => Boolean(item.source_url || item.content_base64 || item.data_url), {
  message: 'Each file must include source_url, content_base64, or data_url',
});

defineConnectorTool({
  module: 'bulk-operations',
  name: 'bulk_update_records',
  description:
    'Safely simulate or apply one common status/stage patch to up to 250 leads, clients, contacts, invoices, projects, or tasks. Dry run is the default; execution requires confirm_execute and an idempotency key.',
  permission: 'crm:write',
  rateLimitClass: 'heavy',
  auditAction: 'mcp_bulk_update_records',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    record_type: recordTypeSchema,
    record_ids: z.array(z.string().uuid()).min(1).max(250),
    patch: z.record(z.string(), z.unknown()).refine((value) => Object.keys(value).length > 0, 'patch cannot be empty'),
    dry_run: z.boolean().optional().default(true),
    confirm_execute: z.boolean().optional().default(false),
    idempotency_key: z.string().min(8).max(200).optional(),
    reason: z.string().max(500).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      record_type: { type: 'string', enum: ['lead', 'client', 'contact', 'invoice', 'project', 'task'] },
      record_ids: { type: 'array', maxItems: 250, items: { type: 'string', format: 'uuid' } },
      patch: { type: 'object', description: 'One shared patch. Supported fields vary by record_type.' },
      dry_run: { type: 'boolean', default: true },
      confirm_execute: { type: 'boolean', default: false },
      idempotency_key: { type: 'string', description: 'Required when dry_run is false.' },
      reason: { type: 'string' },
    },
    required: ['record_type', 'record_ids', 'patch'],
  },
  handler: async (args, ctx) => {
    const dryRun = args.dry_run !== false;
    if (!dryRun && args.confirm_execute === true) {
      const { enqueueBulkMcpJob } = await import('@/lib/mcp/bulkJobQueue');
      const job = await enqueueBulkMcpJob({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        tool: 'bulk_update_records',
        args: args as unknown as Record<string, unknown>,
        requested: args.record_ids.length,
        idempotencyKey: args.idempotency_key,
      });
      return okResult('bulk_update_records', {
        status: 'queued',
        job_id: job.jobId,
        requested: job.requested,
        execution_mode: 'durable',
        message: 'Bulk update queued. Poll get_bulk_job_status for progress.',
      });
    }
    const output = (await executeBulkUpdateRecords(args, { tenantId: ctx.tenantId, userId: ctx.userId })) as Record<string, any>;
    return okResult('bulk_update_records', output, {
      receipt: {
        action_id: String(output.action_id),
        status: args.dry_run === false ? 'completed' : 'simulated',
        entity_id: String(output.action_id),
        entity_type: `${args.record_type}_batch`,
        verification: {
          requested: output.requested,
          eligible: output.eligible,
          updated: output.updated_or_sent,
          skipped: output.skipped,
          failed: output.failed,
        },
        rollback_available: false,
        retry_available: args.dry_run !== false,
      },
    });
  },
});

defineConnectorTool({
  module: 'bulk-operations',
  name: 'bulk_upload_media',
  description:
    'Ingest up to 50 media files from HTTPS URLs, base64 values, or data URLs into tenant storage. Returns a per-file upload receipt and does not publish content.',
  permission: 'social:write',
  rateLimitClass: 'heavy',
  auditAction: 'mcp_bulk_upload_media',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    files: z.array(mediaItemSchema).min(1).max(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            mime_type: { type: 'string' },
            media_type: { type: 'string', enum: ['image', 'video', 'document'] },
            purpose: { type: 'string' },
            alt_text: { type: 'string' },
            source_url: { type: 'string', format: 'uri' },
            content_base64: { type: 'string' },
            data_url: { type: 'string' },
          },
        },
      },
    },
    required: ['files'],
  },
  handler: async (args, ctx) => {
    if (args.files.length > 1) {
      const { enqueueBulkMcpJob } = await import('@/lib/mcp/bulkJobQueue');
      const job = await enqueueBulkMcpJob({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        tool: 'bulk_upload_media',
        args: args as unknown as Record<string, unknown>,
        requested: args.files.length,
      });
      return okResult('bulk_upload_media', {
        status: 'queued',
        job_id: job.jobId,
        requested: job.requested,
        execution_mode: 'durable',
        message: 'Bulk media upload queued. Poll get_bulk_job_status for progress.',
      });
    }
    const output = (await executeBulkUploadMedia(args, { tenantId: ctx.tenantId, userId: ctx.userId })) as Record<string, any>;
    return okResult('bulk_upload_media', output, {
      receipt: {
        action_id: String(output.action_id),
        status: output.failed ? 'completed_with_failures' : 'completed',
        entity_id: String(output.action_id),
        entity_type: 'media_batch',
        verification: {
          requested: output.requested,
          uploaded: output.updated_or_sent,
          failed: output.failed,
        },
      },
    });
  },
});

defineConnectorTool({
  module: 'bulk-operations',
  name: 'send_bulk_email',
  description:
    'Safely simulate or send one message to up to 100 unique lead, contact, or client email recipients. Dry run is the default; actual sending requires confirm_send and an idempotency key.',
  permission: 'sales:write',
  rateLimitClass: 'heavy',
  auditAction: 'mcp_send_bulk_email',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    lead_ids: z.array(z.string().uuid()).max(100).optional(),
    contact_ids: z.array(z.string().uuid()).max(100).optional(),
    client_ids: z.array(z.string().uuid()).max(100).optional(),
    subject: z.string().min(1).max(500),
    text: z.string().max(100000).optional(),
    html: z.string().max(200000).optional(),
    provider: z.enum(['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid']).optional(),
    from_name: z.string().min(1).max(100).optional(),
    dry_run: z.boolean().optional().default(true),
    confirm_send: z.boolean().optional().default(false),
    idempotency_key: z.string().min(8).max(200).optional(),
  }).refine((value) => Boolean(value.text || value.html), { message: 'Provide text or html content' })
    .refine((value) => Boolean(value.lead_ids?.length || value.contact_ids?.length || value.client_ids?.length), {
      message: 'Provide at least one lead_ids, contact_ids, or client_ids collection',
    }),
  jsonSchema: {
    type: 'object',
    properties: {
      lead_ids: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } },
      contact_ids: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } },
      client_ids: { type: 'array', maxItems: 100, items: { type: 'string', format: 'uuid' } },
      subject: { type: 'string' },
      text: { type: 'string' },
      html: { type: 'string' },
      provider: { type: 'string', enum: ['zoho', 'brevo', 'gmail', 'outlook', 'resend', 'sendgrid'] },
      from_name: { type: 'string' },
      dry_run: { type: 'boolean', default: true },
      confirm_send: { type: 'boolean', default: false },
      idempotency_key: { type: 'string', description: 'Required when dry_run is false.' },
    },
    required: ['subject'],
  },
  handler: async (args, ctx) => {
    const dryRun = args.dry_run !== false;
    const recipientCount =
      (args.lead_ids?.length || 0) + (args.contact_ids?.length || 0) + (args.client_ids?.length || 0);
    const useDurableQueue = !dryRun && args.confirm_send === true && recipientCount > 10;
    if (useDurableQueue) {
      const { enqueueBulkMcpJob } = await import('@/lib/mcp/bulkJobQueue');
      const job = await enqueueBulkMcpJob({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        tool: 'send_bulk_email',
        args: args as unknown as Record<string, unknown>,
        requested: recipientCount,
        idempotencyKey: args.idempotency_key,
      });
      return okResult('send_bulk_email', {
        status: 'queued',
        job_id: job.jobId,
        requested: job.requested,
        execution_mode: 'durable',
        message: 'Bulk email queued (>10 recipients). Poll get_bulk_job_status for progress.',
      });
    }
    const output = (await executeBulkEmail(args, { tenantId: ctx.tenantId, userId: ctx.userId })) as Record<string, any>;
    return okResult('send_bulk_email', output, {
      receipt: {
        action_id: String(output.action_id),
        status: args.dry_run === false
          ? (Number(output.failed || 0) > 0 ? 'completed_with_failures' : 'completed')
          : 'simulated',
        entity_id: String(output.action_id),
        entity_type: 'bulk_email',
        verification: {
          requested: output.requested,
          eligible: output.eligible,
          sent: output.updated_or_sent,
          skipped: output.skipped,
          failed: output.failed,
        },
        retry_available: args.dry_run !== false,
      },
    });
  },
});

defineConnectorTool({
  module: 'bulk-operations',
  name: 'get_bulk_job_status',
  description:
    'Poll status of a queued bulk MCP job (bulk_update_records, send_bulk_email, bulk_upload_media).',
  permission: 'platform:read',
  rateLimitClass: 'light',
  auditAction: 'mcp_get_bulk_job_status',
  inputSchema: z.object({
    tenant_id: tenantIdField.optional(),
    job_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      job_id: { type: 'string', format: 'uuid' },
    },
    required: ['job_id'],
  },
  handler: async (args, ctx) => {
    const { getBulkJobStatus } = await import('@/lib/mcp/bulkJobQueue');
    const status = await getBulkJobStatus(ctx.tenantId, args.job_id);
    return okResult('get_bulk_job_status', status);
  },
});
