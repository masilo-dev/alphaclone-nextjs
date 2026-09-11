/**
 * Document Operating System MCP tools.
 * AI agents provide structured data only — never raw HTML/SQL/tenant spoofing.
 */

import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveBrandProfile } from '@/lib/document-os/brandProfile';
import { validateDocument } from '@/lib/document-os/validation';
import { renderCorporateDocumentHtml } from '@/lib/document-os/corporateRenderer';
import {
  createDocumentOsStore,
  DocumentOsService,
} from '@/services/documentOs/documentOsService';
import type { DocumentType, DocumentStatus, ContractClause } from '@/lib/document-os/types';
import {
  createSignatureEnvelope,
  getSignatureStatus,
  recordSignature,
  requireOwnerApprovalForSensitiveAction,
} from '@/lib/document-os/engines/signatureEngine';
import { resolveActorFromSession } from '@/lib/document-os/actors';
import { formatRecordChainForAi, buildRecordChain } from '@/lib/document-os/relationships';

/** Process-local stores keyed by tenant for MCP demos/tests without DB. */
const memoryStores = new Map<string, ReturnType<typeof createDocumentOsStore>>();

function storeFor(tenantId: string) {
  if (!memoryStores.has(tenantId)) memoryStores.set(tenantId, createDocumentOsStore());
  return memoryStores.get(tenantId)!;
}

async function loadBrand(tenantId: string) {
  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  const { data: settings } = await supabase
    .from('business_settings')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  const brand = resolveBrandProfile(
    tenant ? { ...tenant, id: tenantId } : { id: tenantId, name: null },
    settings
  );
  if (!brand.legal_business_name || brand.legal_business_name === 'Unconfigured Business') {
    // Prefer DB brand profile table when present
    const { data: profile } = await supabase
      .from('document_brand_profiles')
      .select('*')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (profile) {
      return { ...brand, ...profile, tenant_id: tenantId } as typeof brand;
    }
  }
  return brand;
}

function sessionFromArgs(args: {
  tenant_id: string;
  user_id?: string;
  correlation_id?: string;
  channel?: string;
}) {
  return {
    userId: args.user_id || 'mcp-user',
    userName: 'MCP User',
    channel: (args.channel as 'mcp_chatgpt') || 'mcp_chatgpt',
    correlationId: args.correlation_id,
  };
}

const writeMeta = {
  idempotency_key: z.string().optional(),
  expected_current_version: z.number().int().optional(),
  reason: z.string().optional(),
  correlation_id: z.string().optional(),
  owner_approved: z.boolean().optional(),
};

function textResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

registerTool('document-os', {
  name: 'create_document',
  description:
    'Create a professional tenant document from structured data (contracts, invoices, quotes, etc.). Does not accept raw HTML/SQL.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_type: z.string(),
    title: z.string().min(1),
    structured_data: z.record(z.string(), z.unknown()),
    client_id: z.string().uuid().optional(),
    company_id: z.string().uuid().optional(),
    project_id: z.string().uuid().optional(),
    currency: z.string().optional(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_type: { type: 'string' },
      title: { type: 'string' },
      structured_data: { type: 'object' },
      client_id: { type: 'string', format: 'uuid' },
      idempotency_key: { type: 'string' },
      reason: { type: 'string' },
      correlation_id: { type: 'string' },
    },
    required: ['tenant_id', 'document_type', 'title', 'structured_data'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.createDocument({
      session: sessionFromArgs(args),
      document_type: args.document_type as DocumentType,
      title: args.title,
      structured_data: args.structured_data,
      client_id: args.client_id,
      company_id: args.company_id,
      project_id: args.project_id,
      currency: args.currency,
      meta: {
        idempotency_key: args.idempotency_key,
        reason: args.reason,
        correlation_id: args.correlation_id,
      },
    });
    return textResult({ success: true, document: doc });
  },
});

registerTool('document-os', {
  name: 'update_document',
  description: 'Create a new immutable version of a document with updated structured data.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    structured_data: z.record(z.string(), z.unknown()),
    title: z.string().optional(),
    change_summary: z.string().optional(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      structured_data: { type: 'object' },
      expected_current_version: { type: 'number' },
      idempotency_key: { type: 'string' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'structured_data'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.updateDocument({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      structured_data: args.structured_data,
      title: args.title,
      change_summary: args.change_summary,
      meta: {
        expected_current_version: args.expected_current_version,
        reason: args.reason,
        correlation_id: args.correlation_id,
        idempotency_key: args.idempotency_key,
      },
    });
    return textResult({ success: true, document: doc });
  },
});

registerTool('document-os', {
  name: 'validate_document',
  description:
    'Run professional validation (data, financial, legal consistency, brand, layout, contacts, permissions).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid().optional(),
    document_type: z.string().optional(),
    structured_data: z.record(z.string(), z.unknown()).optional(),
    clauses: z.array(z.record(z.string(), z.unknown())).optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      document_type: { type: 'string' },
      structured_data: { type: 'object' },
      clauses: { type: 'array' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    if (args.document_id) {
      const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
      return textResult(svc.validate(args.document_id, {
        clauses: args.clauses as ContractClause[] | undefined,
      }));
    }
    return textResult(
      validateDocument({
        documentType: (args.document_type || 'contract') as DocumentType,
        brand,
        structuredData: args.structured_data || {},
        clauses: args.clauses as ContractClause[] | undefined,
      })
    );
  },
});

registerTool('document-os', {
  name: 'preview_document',
  description: 'Render a professional HTML preview using the tenant brand profile and design system.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.getDocument(args.document_id);
    const html = svc.preview(args.document_id, {
      clientName: String(doc.structured_data.client_legal_name || ''),
      clientEmail: String(doc.structured_data.client_email || ''),
      clauses: doc.structured_data.clauses as ContractClause[] | undefined,
      showSignatures: false,
    });
    return textResult({ document_id: doc.document_id, html_length: html.length, html });
  },
});

registerTool('document-os', {
  name: 'render_document',
  description: 'Alias of preview_document — render corporate HTML for PDF pipeline.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args, ctx) => {
    const tool = { name: 'preview_document' };
    void tool;
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), {
      ...brand,
      tenant_id: args.tenant_id || ctx.tenantId,
    });
    const doc = svc.getDocument(args.document_id);
    const html = renderCorporateDocumentHtml({
      documentType: doc.document_type,
      brand,
      title: doc.title,
      documentNumber: doc.document_number,
      version: doc.version,
      status: doc.status,
      clauses: doc.structured_data.clauses as ContractClause[] | undefined,
      metadata: { documentId: doc.document_id, author: brand.legal_business_name },
    });
    return textResult({ rendered: true, html_length: html.length });
  },
});

registerTool('document-os', {
  name: 'approve_document',
  description: 'Approve the current document version after validation passes.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
      owner_approved: { type: 'boolean' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.getDocument(args.document_id);
    const to: DocumentStatus =
      doc.status === 'draft' || doc.status === 'under_review' || doc.status === 'revised'
        ? 'approved'
        : 'approved';
    if (doc.status === 'draft') {
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'under_review',
        action: 'submitted_for_review',
      });
    }
    const updated = svc.transition({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      to,
      action: 'approved',
      reason: args.reason,
      requireValidation: true,
      meta: { reason: args.reason, correlation_id: args.correlation_id },
    });
    return textResult({ success: true, document: updated });
  },
});

registerTool('document-os', {
  name: 'send_document',
  description: 'Send an approved document after full validation. Requires owner approval for AI actors.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    recipients: z.array(z.string().email()).min(1),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      recipients: { type: 'array', items: { type: 'string' } },
      owner_approved: { type: 'boolean' },
    },
    required: ['tenant_id', 'document_id', 'recipients'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const actor = resolveActorFromSession(sessionFromArgs(args));
    const doc = new DocumentOsService(storeFor(args.tenant_id), brand).getDocument(args.document_id);
    const action =
      doc.document_type === 'invoice' || doc.document_type === 'credit_note'
        ? 'send_invoice'
        : 'send_contract';
    requireOwnerApprovalForSensitiveAction(action, actor, Boolean(args.owner_approved));
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const updated = svc.transition({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      to: 'sent',
      action: 'sent',
      sent_to: args.recipients,
      requireValidation: true,
      reason: args.reason,
      meta: {
        reason: args.reason,
        correlation_id: args.correlation_id,
        idempotency_key: args.idempotency_key,
      },
    });
    return textResult({ success: true, document: updated });
  },
});

registerTool('document-os', {
  name: 'send_for_signature',
  description: 'Request electronic signatures. Typed text alone is not accepted as signature evidence.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    signers: z.array(
      z.object({
        name: z.string(),
        email: z.string().email(),
        role: z.string(),
        order: z.number().optional(),
      })
    ),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      signers: { type: 'array' },
      owner_approved: { type: 'boolean' },
    },
    required: ['tenant_id', 'document_id', 'signers'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const actor = resolveActorFromSession(sessionFromArgs(args));
    requireOwnerApprovalForSensitiveAction('sign', actor, Boolean(args.owner_approved));
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.getDocument(args.document_id);
    if (doc.status === 'approved' || doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'accepted') {
      if (doc.status === 'approved') {
        svc.transition({
          session: sessionFromArgs(args),
          document_id: args.document_id,
          to: 'sent',
          action: 'sent',
          requireValidation: true,
        });
      }
      const current = svc.getDocument(args.document_id);
      if (current.status === 'sent') {
        svc.transition({
          session: sessionFromArgs(args),
          document_id: args.document_id,
          to: 'viewed',
          action: 'viewed',
        });
      }
      const afterView = svc.getDocument(args.document_id);
      if (afterView.status === 'viewed' || afterView.status === 'accepted') {
        svc.transition({
          session: sessionFromArgs(args),
          document_id: args.document_id,
          to: afterView.status === 'viewed' ? 'accepted' : 'awaiting_signature',
          action: afterView.status === 'viewed' ? 'accepted' : 'signature_requested',
        });
      }
    }
    const latest = svc.getDocument(args.document_id);
    if (latest.status !== 'awaiting_signature') {
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'awaiting_signature',
        action: 'signature_requested',
        requireValidation: true,
      });
    }
    const envelope = createSignatureEnvelope({
      document_id: latest.document_id,
      version_id: latest.current_version_id || latest.document_id,
      document_checksum: latest.checksum || '',
      signers: args.signers,
    });
    return textResult({ success: true, envelope: getSignatureStatus(envelope) });
  },
});

registerTool('document-os', {
  name: 'get_signature_status',
  description: 'Get signature envelope status for a document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    envelope: z.record(z.string(), z.unknown()),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      envelope: { type: 'object' },
    },
    required: ['tenant_id', 'envelope'],
  },
  handler: async (args) => {
    return textResult(getSignatureStatus(args.envelope as unknown as Parameters<typeof getSignatureStatus>[0]));
  },
});

registerTool('document-os', {
  name: 'get_document',
  description: 'Retrieve a document record by id (tenant-scoped).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(svc.getDocument(args.document_id));
  },
});

registerTool('document-os', {
  name: 'retrieve_document',
  description: 'Alias of get_document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(svc.getDocument(args.document_id));
  },
});

registerTool('document-os', {
  name: 'list_document_versions',
  description: 'List immutable versions for a document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult({ versions: svc.listVersions(args.document_id) });
  },
});

registerTool('document-os', {
  name: 'compare_document_versions',
  description: 'Compare two document versions and return field-level changes.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    left_version: z.number().int(),
    right_version: z.number().int(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      left_version: { type: 'number' },
      right_version: { type: 'number' },
    },
    required: ['tenant_id', 'document_id', 'left_version', 'right_version'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(svc.compareDocumentVersions(args.document_id, args.left_version, args.right_version));
  },
});

registerTool('document-os', {
  name: 'compare_versions',
  description: 'Alias of compare_document_versions.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    left_version: z.number().int(),
    right_version: z.number().int(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      left_version: { type: 'number' },
      right_version: { type: 'number' },
    },
    required: ['tenant_id', 'document_id', 'left_version', 'right_version'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(svc.compareDocumentVersions(args.document_id, args.left_version, args.right_version));
  },
});

registerTool('document-os', {
  name: 'get_document_timeline',
  description: 'Return the chronological event ledger for a document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult({ timeline: svc.getTimeline(args.document_id) });
  },
});

registerTool('document-os', {
  name: 'search_documents_os',
  description: 'Search Document OS records by number, client, content, status, and related fields.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    query: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      query: { type: 'string' },
    },
    required: ['tenant_id', 'query'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult({ documents: svc.search(args.query) });
  },
});

registerTool('document-os', {
  name: 'void_document',
  description: 'Void a document. Requires owner approval for AI actors on financial docs.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      owner_approved: { type: 'boolean' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const actor = resolveActorFromSession(sessionFromArgs(args));
    requireOwnerApprovalForSensitiveAction('void_financial', actor, Boolean(args.owner_approved));
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const updated = svc.transition({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      to: 'void',
      action: 'voided',
      reason: args.reason,
    });
    return textResult({ success: true, document: updated });
  },
});

registerTool('document-os', {
  name: 'archive_document',
  description: 'Archive a document record.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    user_id: z.string().optional(),
    document_id: z.string().uuid(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      owner_approved: { type: 'boolean' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const actor = resolveActorFromSession(sessionFromArgs(args));
    requireOwnerApprovalForSensitiveAction('delete_archive', actor, Boolean(args.owner_approved));
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const updated = svc.transition({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      to: 'archived',
      action: 'archived',
      reason: args.reason,
    });
    return textResult({ success: true, document: updated });
  },
});

registerTool('document-os', {
  name: 'create_document_version',
  description: 'Explicitly create a new immutable version (same as update_document).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    structured_data: z.record(z.string(), z.unknown()),
    change_summary: z.string(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      structured_data: { type: 'object' },
      change_summary: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'structured_data', 'change_summary'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.updateDocument({
      session: sessionFromArgs(args),
      document_id: args.document_id,
      structured_data: args.structured_data,
      change_summary: args.change_summary,
      meta: {
        expected_current_version: args.expected_current_version,
        reason: args.reason,
        correlation_id: args.correlation_id,
      },
    });
    return textResult({ success: true, document: doc });
  },
});

registerTool('document-os', {
  name: 'submit_for_review',
  description: 'Move a draft document into under_review.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'under_review',
        action: 'submitted_for_review',
        reason: args.reason,
      })
    );
  },
});

registerTool('document-os', {
  name: 'request_changes',
  description: 'Request changes on a document under review.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'reason'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'changes_requested',
        action: 'changes_requested',
        reason: args.reason,
      })
    );
  },
});

registerTool('document-os', {
  name: 'reject_document',
  description: 'Reject a document under review (returns toward draft/void path via declined).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'reason'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const doc = svc.getDocument(args.document_id);
    // contracts use changes_requested; general may use declined from sent — from under_review go changes_requested
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: doc.document_type === 'proposal' ? 'changes_requested' : 'changes_requested',
        action: 'rejected',
        reason: args.reason,
      })
    );
  },
});

registerTool('document-os', {
  name: 'record_document_view',
  description: 'Record that a recipient viewed a sent document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'viewed',
        action: 'viewed',
      })
    );
  },
});

registerTool('document-os', {
  name: 'accept_document',
  description: 'Record client acceptance of a viewed document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    owner_approved: z.boolean().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const actor = resolveActorFromSession(sessionFromArgs(args));
    requireOwnerApprovalForSensitiveAction('accept_terms', actor, Boolean(args.owner_approved));
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'accepted',
        action: 'accepted',
      })
    );
  },
});

registerTool('document-os', {
  name: 'decline_document',
  description: 'Record that a recipient declined a document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'declined',
        action: 'declined',
        reason: args.reason,
      })
    );
  },
});

registerTool('document-os', {
  name: 'amend_document',
  description: 'Amend a signed/accepted document by creating a new draft version referencing the original.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    structured_data: z.record(z.string(), z.unknown()),
    change_summary: z.string(),
    ...writeMeta,
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      structured_data: { type: 'object' },
      change_summary: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'structured_data', 'change_summary'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.amendDocument({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        structured_data: args.structured_data,
        change_summary: args.change_summary,
        meta: { reason: args.reason, correlation_id: args.correlation_id },
      })
    );
  },
});

registerTool('document-os', {
  name: 'supersede_document',
  description: 'Mark a document as superseded.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string().optional(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    // Force status via store — supersede from various states by setting through archived path if needed
    const doc = svc.getDocument(args.document_id);
    void doc;
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'superseded',
        action: 'superseded',
        reason: args.reason,
      })
    );
  },
});

registerTool('document-os', {
  name: 'restore_document',
  description: 'Restore an archived document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult(
      svc.transition({
        session: sessionFromArgs(args),
        document_id: args.document_id,
        to: 'restored',
        action: 'restored',
      })
    );
  },
});

registerTool('document-os', {
  name: 'place_legal_hold',
  description: 'Place a legal hold on a document (blocks edit/delete until released).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'reason'],
  },
  handler: async (args) => {
    const store = storeFor(args.tenant_id);
    const doc = store.documents.get(args.document_id);
    if (!doc || doc.tenant_id !== args.tenant_id) throw new Error('Document not found');
    doc.legal_hold = true;
    store.documents.set(doc.document_id, doc);
    return textResult({ success: true, document_id: doc.document_id, legal_hold: true });
  },
});

registerTool('document-os', {
  name: 'release_legal_hold',
  description: 'Release a legal hold on a document.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
    reason: z.string(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
      reason: { type: 'string' },
    },
    required: ['tenant_id', 'document_id', 'reason'],
  },
  handler: async (args) => {
    const store = storeFor(args.tenant_id);
    const doc = store.documents.get(args.document_id);
    if (!doc || doc.tenant_id !== args.tenant_id) throw new Error('Document not found');
    doc.legal_hold = false;
    store.documents.set(doc.document_id, doc);
    return textResult({ success: true, document_id: doc.document_id, legal_hold: false });
  },
});

registerTool('document-os', {
  name: 'export_document_record',
  description: 'Export a full document record including versions and timeline.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    document_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      document_id: { type: 'string', format: 'uuid' },
    },
    required: ['tenant_id', 'document_id'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    return textResult({
      document: svc.getDocument(args.document_id),
      versions: svc.listVersions(args.document_id),
      timeline: svc.getTimeline(args.document_id),
      brand: {
        legal_business_name: brand.legal_business_name,
        trading_name: brand.trading_name,
      },
    });
  },
});

registerTool('document-os', {
  name: 'show_related_records',
  description: 'Show the related business record chain for a company (e.g. Novus Power).',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    company_name: z.string().min(1),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', format: 'uuid' },
      company_name: { type: 'string' },
    },
    required: ['tenant_id', 'company_name'],
  },
  handler: async (args) => {
    const brand = await loadBrand(args.tenant_id);
    const svc = new DocumentOsService(storeFor(args.tenant_id), brand);
    const docs = svc.search(args.company_name);
    const chain = buildRecordChain({
      company: { type: 'company', id: 'unknown', label: args.company_name },
      quote: docs.find((d) => d.document_type === 'quote')
        ? {
            type: 'quote',
            id: docs.find((d) => d.document_type === 'quote')!.document_id,
            label: docs.find((d) => d.document_type === 'quote')!.title,
            status: docs.find((d) => d.document_type === 'quote')!.status,
          }
        : undefined,
      contract: docs.find((d) => d.document_type === 'contract')
        ? {
            type: 'contract',
            id: docs.find((d) => d.document_type === 'contract')!.document_id,
            label: docs.find((d) => d.document_type === 'contract')!.title,
            status: docs.find((d) => d.document_type === 'contract')!.status,
          }
        : undefined,
      invoices: docs
        .filter((d) => d.document_type === 'invoice')
        .map((d) => ({ type: 'invoice', id: d.document_id, label: d.title, status: d.status })),
      receipts: docs
        .filter((d) => d.document_type === 'receipt')
        .map((d) => ({ type: 'receipt', id: d.document_id, label: d.title, status: d.status })),
    });
    return textResult({
      text: formatRecordChainForAi(args.company_name, chain),
      chain,
      documents: docs,
    });
  },
});

// silence unused import in case tree-shaking
void recordSignature;
