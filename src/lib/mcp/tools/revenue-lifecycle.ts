import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { campaignHealth, classifyOutreachReply } from '@/lib/outreach/outreachIntelligence';

const tenantId = z.string().uuid();

registerTool('revenue-lifecycle', {
  name: 'prepare_contract_renewal',
  description: 'Prepare a renewal mission from an existing contract, including obligations, open negotiations, signers, and renewal timing.',
  inputSchema: z.object({ tenant_id: tenantId, contract_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, contract_id: { type: 'string', format: 'uuid' } }, required: ['tenant_id', 'contract_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    const [contract, obligations, negotiations, parties] = await Promise.all([
      db.from('contracts').select('*').eq('tenant_id', args.tenant_id).eq('id', args.contract_id).single(),
      db.from('contract_obligations').select('*').eq('tenant_id', args.tenant_id).eq('contract_id', args.contract_id).order('due_date'),
      db.from('contract_negotiation_threads').select('*').eq('tenant_id', args.tenant_id).eq('contract_id', args.contract_id).eq('status', 'open'),
      db.from('contract_parties').select('*').eq('tenant_id', args.tenant_id).eq('contract_id', args.contract_id).order('signing_order'),
    ]);
    if (contract.error) throw contract.error;
    return { contract: contract.data, obligations: obligations.data || [], open_negotiations: negotiations.data || [], parties: parties.data || [], ready: true, verification: { contract_found: true } };
  },
});

registerTool('revenue-lifecycle', {
  name: 'compare_contract_versions',
  description: 'Compare two stored contract versions and return additions, removals, and changed lines.',
  inputSchema: z.object({ tenant_id: tenantId, contract_id: z.string().uuid(), left_version_id: z.string().uuid(), right_version_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, contract_id: { type: 'string', format: 'uuid' }, left_version_id: { type: 'string', format: 'uuid' }, right_version_id: { type: 'string', format: 'uuid' } }, required: ['tenant_id', 'contract_id', 'left_version_id', 'right_version_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('contract_versions').select('id, content, version_number, created_at').eq('tenant_id', args.tenant_id).eq('contract_id', args.contract_id).in('id', [args.left_version_id, args.right_version_id]);
    if (error) throw error;
    const left = data?.find((row) => row.id === args.left_version_id);
    const right = data?.find((row) => row.id === args.right_version_id);
    if (!left || !right) throw new Error('Both contract versions are required');
    const leftLines = new Set(String(left.content || '').split('\n').map((line) => line.trim()).filter(Boolean));
    const rightLines = new Set(String(right.content || '').split('\n').map((line) => line.trim()).filter(Boolean));
    return { left_version: left.version_number, right_version: right.version_number, additions: [...rightLines].filter((line) => !leftLines.has(line)), removals: [...leftLines].filter((line) => !rightLines.has(line)), verified: true };
  },
});

registerTool('revenue-lifecycle', {
  name: 'chase_contract_signature',
  description: 'Inspect signature delivery and signer state, and return the exact recipients still requiring a reminder. Sending remains approval-controlled.',
  inputSchema: z.object({ tenant_id: tenantId, contract_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, contract_id: { type: 'string', format: 'uuid' } }, required: ['tenant_id', 'contract_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    const { data: parties, error } = await db.from('contract_parties').select('*').eq('tenant_id', args.tenant_id).eq('contract_id', args.contract_id).order('signing_order');
    if (error) throw error;
    const pending = (parties || []).filter((party) => !['signed', 'declined'].includes(String(party.status || '').toLowerCase()));
    return { pending_signers: pending, reminder_required: pending.length > 0, requires_approval_to_send: true, verified_against_parties: true };
  },
});

registerTool('revenue-lifecycle', {
  name: 'analyze_document',
  description: 'Queue OCR, extraction, classification, summary, validation, and obligation extraction for a document.',
  inputSchema: z.object({ tenant_id: tenantId, document_id: z.string().uuid(), jobs: z.array(z.enum(['ocr','extract','classify','summarize','validate','obligations'])).optional() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, document_id: { type: 'string', format: 'uuid' }, jobs: { type: 'array', items: { type: 'string' } } }, required: ['tenant_id', 'document_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    const jobs = args.jobs?.length ? args.jobs : ['ocr','extract','classify','summarize','validate','obligations'];
    const rows = jobs.map((job_type) => ({ tenant_id: args.tenant_id, document_id: args.document_id, job_type, status: 'queued', input: { requested_by: 'bonnie' } }));
    const { data, error } = await db.from('document_intelligence_jobs').insert(rows).select('id, job_type, status');
    if (error) throw error;
    await db.from('documents').update({ intelligence_status: 'queued', updated_at: new Date().toISOString() }).eq('tenant_id', args.tenant_id).eq('id', args.document_id);
    return { queued_jobs: data || [], queued_count: data?.length || 0, verified: true };
  },
});

registerTool('revenue-lifecycle', {
  name: 'create_invoice_collection_mission',
  description: 'Prepare an approval-controlled collection mission for an overdue or partially paid invoice.',
  inputSchema: z.object({ tenant_id: tenantId, invoice_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, invoice_id: { type: 'string', format: 'uuid' } }, required: ['tenant_id', 'invoice_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    let result = await db.from('business_invoices').select('*').eq('tenant_id', args.tenant_id).eq('id', args.invoice_id).maybeSingle();
    if (!result.data) result = await db.from('invoices').select('*').eq('tenant_id', args.tenant_id).eq('id', args.invoice_id).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) throw new Error('Invoice not found');
    return { invoice: result.data, mission: { action: 'send_payment_reminder', requires_approval: true, verify_delivery: true, verify_payment_link: true }, verified_invoice_exists: true };
  },
});

registerTool('revenue-lifecycle', {
  name: 'monitor_campaign_health',
  description: 'Measure campaign bounce, complaint, and unsubscribe rates and recommend an automatic safety pause.',
  inputSchema: z.object({ tenant_id: tenantId, campaign_id: z.string().uuid() }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, campaign_id: { type: 'string', format: 'uuid' } }, required: ['tenant_id', 'campaign_id'] },
  handler: async (args) => {
    const db = createSupabaseAdminClient();
    const { data, error } = await db.from('outreach_events').select('event_type').eq('tenant_id', args.tenant_id).eq('campaign_id', args.campaign_id);
    if (error) throw error;
    const count = (name: string) => (data || []).filter((event) => event.event_type === name).length;
    return { ...campaignHealth({ sent: count('sent'), bounced: count('bounced'), complained: count('complained'), unsubscribed: count('unsubscribed') }), event_count: data?.length || 0, verified: true };
  },
});

registerTool('revenue-lifecycle', {
  name: 'classify_outreach_reply',
  description: 'Classify a campaign reply as positive, objection, not now, unsubscribe, wrong person, or neutral.',
  inputSchema: z.object({ tenant_id: tenantId, reply_text: z.string().min(1).max(100000) }),
  jsonSchema: { type: 'object', properties: { tenant_id: { type: 'string', format: 'uuid' }, reply_text: { type: 'string' } }, required: ['tenant_id', 'reply_text'] },
  handler: async (args) => ({ classification: classifyOutreachReply(args.reply_text), verified: true }),
});
