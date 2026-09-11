// @ts-nocheck
/**
 * Gap handlers — Contracts, Strategy, Document Intelligence, Calendar
 */
import { z } from 'zod';
import { registerTool } from '@/lib/mcp/tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const tid = z.string().describe('AlphaClone Workspace ID');

// ── Contracts & Approvals ─────────────────────────────────────────────
registerTool('gap-contracts', {
  name: 'get_contract_approvals',
  description: 'Fetch approval workflow state and audit trail for a contract.',
  inputSchema: z.object({ tenant_id: tid, contract_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, contract_id: { type: 'string' } }, required: ['contract_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from('contract_approvals').select('*').eq('contract_id', args.contract_id).eq('tenant_id', args.tenant_id);
    return { content: [{ type: 'text', text: JSON.stringify({ contract_id: args.contract_id, approvals: data || [] }, null, 2) }] };
  },
});

registerTool('gap-contracts', {
  name: 'get_contract_versions',
  description: 'List version history and revisions for a contract.',
  inputSchema: z.object({ tenant_id: tid, contract_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, contract_id: { type: 'string' } }, required: ['contract_id'] },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from('contract_versions').select('*').eq('contract_id', args.contract_id).order('version_number', { ascending: false });
    return { content: [{ type: 'text', text: JSON.stringify({ contract_id: args.contract_id, versions: data || [] }, null, 2) }] };
  },
});

registerTool('gap-contracts', {
  name: 'analyze_document_intelligence',
  description: 'Run automated AI intelligence extraction on a document or contract.',
  inputSchema: z.object({ tenant_id: tid, document_id: z.string() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' }, document_id: { type: 'string' } }, required: ['document_id'] },
  handler: async (args) => {
    return { content: [{ type: 'text', text: JSON.stringify({ document_id: args.document_id, status: 'unavailable', reason: 'Document intelligence extraction is not connected. Open the document in Documents to review it.' }, null, 2) }] };
  },
});

// ── Strategic Intelligence & Momentum ──────────────────────────────────
registerTool('gap-strategy', {
  name: 'execute_strategic_intelligence',
  description: 'Execute strategic intelligence analysis across leads, pipeline, and market positioning.',
  inputSchema: z.object({ tenant_id: tid, focus_area: z.string().optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' } } },
  handler: async (args) => {
    return { content: [{ type: 'text', text: JSON.stringify({ tenant_id: args.tenant_id, status: 'unavailable', reason: 'Strategic intelligence is not computed from live tenant data yet. Use Analytics and Executive view instead.' }, null, 2) }] };
  },
});

registerTool('gap-strategy', {
  name: 'get_momentum_score',
  description: 'Calculate real-time business momentum and operational throughput score.',
  inputSchema: z.object({ tenant_id: tid }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' } } },
  handler: async (args) => {
    return { content: [{ type: 'text', text: JSON.stringify({ tenant_id: args.tenant_id, status: 'unavailable', reason: 'Momentum score is not computed from live tenant metrics yet.' }, null, 2) }] };
  },
});

// ── Calendly / Calendar ──────────────────────────────────────────────
registerTool('gap-calendar', {
  name: 'get_calendly_status',
  description: 'Check status of Calendly OAuth connection and active event types.',
  inputSchema: z.object({ tenant_id: tid }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string' } } },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase.from('integrations').select('status, metadata').eq('tenant_id', args.tenant_id).eq('provider', 'calendly').single();
    if (!data) return { content: [{ type: 'text', text: JSON.stringify({ status: 'requires_oauth', message: 'Calendly integration not connected.' }) }] };
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
});
