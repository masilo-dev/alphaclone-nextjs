// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import { evaluateBusinessAIState, summarizeBusinessAIState } from '@/services/mcp/businessAIState';

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function money(rows: any[], field = 'total_amount'): number {
  return rows.reduce((sum, row) => sum + Number(row?.[field] || row?.total || row?.value || 0), 0);
}

function isOpenStatus(status: unknown): boolean {
  const value = String(status || '').toLowerCase();
  return !['paid', 'completed', 'done', 'closed_won', 'closed_lost', 'cancelled', 'void', 'lost'].includes(value);
}

function sortByPriority(items: any[]) {
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  return items.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
}

async function collectOperatingSignals(tenantId: string, lookbackDays = 30) {
  const supabase = createSupabaseAdminClient();
  const since = isoDaysAgo(lookbackDays);

  const [invoiceRes, quoteRes, dealRes, taskRes, leadRes, submissionRes, sessionRes] = await Promise.all([
    supabase
      .from('business_invoices')
      .select('id, invoice_number, status, total_amount, due_date, created_at, client_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('quotes')
      .select('id, quote_number, name, status, total_amount, valid_until, sent_at, created_at, deal_id, contact_id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('deals')
      .select('id, name, stage, value, created_at, updated_at, contact_id, company_id, metadata')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(100),
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, created_at, related_to_project')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('leads')
      .select('id, business_name, name, email, status, source, created_at, value')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('form_submissions')
      .select('id, status, submitter_name, submitter_email, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('mcp_sessions')
      .select('tool_name, success, duration_ms, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300),
  ]);

  const invoices = invoiceRes.data || [];
  const quotes = quoteRes.data || [];
  const deals = dealRes.data || [];
  const tasks = taskRes.data || [];
  const leads = leadRes.data || [];
  const submissions = submissionRes.data || [];
  const sessions = sessionRes.data || [];
  const now = Date.now();

  return {
    invoices,
    quotes,
    deals,
    tasks,
    leads,
    submissions,
    sessions,
    overdue_invoices: invoices.filter((invoice) => {
      const due = invoice.due_date ? new Date(invoice.due_date).getTime() : 0;
      return String(invoice.status).toLowerCase() === 'overdue' || (due && due < now && String(invoice.status).toLowerCase() !== 'paid');
    }),
    draft_invoices: invoices.filter((invoice) => String(invoice.status).toLowerCase() === 'draft'),
    sent_invoices: invoices.filter((invoice) => String(invoice.status).toLowerCase() === 'sent'),
    stale_quotes: quotes.filter((quote) => {
      const status = String(quote.status || '').toLowerCase();
      const sent = quote.sent_at ? new Date(quote.sent_at).getTime() : new Date(quote.created_at || 0).getTime();
      return ['sent', 'viewed', 'draft'].includes(status) && sent && now - sent > 7 * 24 * 60 * 60 * 1000;
    }),
    active_deals: deals.filter((deal) => isOpenStatus(deal.stage)),
    open_tasks: tasks.filter((task) => isOpenStatus(task.status)),
    warm_leads: leads.filter((lead) => isOpenStatus(lead.status)),
  };
}

registerTool('platform-advantage', {
  name: 'owner_autopilot_queue',
  description:
    'Rank the next best actions for a solo owner or small team by cash impact, time saved, risk, approval requirement, and recommended MCP tool.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    lookback_days: z.number().int().min(1).max(90).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      lookback_days: { type: 'number', description: 'Lookback window in days (default 30)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) => {
    const signals = await collectOperatingSignals(args.tenant_id, args.lookback_days || 30);
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);
    const queue = sortByPriority([
      signals.overdue_invoices.length && {
        priority: 'critical',
        lane: 'cash',
        title: 'Recover overdue invoice cash',
        reason: `${signals.overdue_invoices.length} overdue invoice(s) worth $${money(signals.overdue_invoices).toLocaleString()}`,
        approval_required: true,
        recommended_tool: 'revenue_recovery_agent',
      },
      signals.draft_invoices.length && {
        priority: 'high',
        lane: 'cash',
        title: 'Review draft invoices',
        reason: `${signals.draft_invoices.length} invoice(s) are drafted but not sent`,
        approval_required: true,
        recommended_tool: 'revenue_recovery_agent',
      },
      signals.stale_quotes.length && {
        priority: 'high',
        lane: 'growth',
        title: 'Revive stale quotes',
        reason: `${signals.stale_quotes.length} quote(s) need a follow-up or decision`,
        approval_required: false,
        recommended_tool: 'deal_to_cash_flow',
      },
      signals.warm_leads.length && {
        priority: 'medium',
        lane: 'sales',
        title: 'Triage warm leads',
        reason: `${signals.warm_leads.length} recent lead(s) can be turned into replies or bookings`,
        approval_required: false,
        recommended_tool: 'client_pulse',
      },
      signals.open_tasks.length && {
        priority: 'medium',
        lane: 'delivery',
        title: 'Compress open work',
        reason: `${signals.open_tasks.length} open task(s) can be grouped into an owner focus list`,
        approval_required: false,
        recommended_tool: 'solo_owner_operator_brief',
      },
    ].filter(Boolean));

    const readiness = evaluateBusinessAIState(state, {
      task: 'Run owner autopilot queue',
      task_category: 'operations',
      requires_financial_action: signals.overdue_invoices.length > 0 || signals.draft_invoices.length > 0,
      requires_customer_facing_action: signals.warm_leads.length > 0 || signals.stale_quotes.length > 0,
      requires_external_action: queue.some((item) => item.approval_required),
    });

    return { content: [{ type: 'text', text: JSON.stringify({ queue: queue.slice(0, 10), readiness }, null, 2) }] };
  },
});

registerTool('platform-advantage', {
  name: 'revenue_recovery_agent',
  description:
    'Find recoverable revenue from overdue invoices, draft invoices, stale quotes, and dormant deals. Returns owner-approval actions instead of sending automatically.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    lookback_days: z.number().int().min(1).max(180).optional().default(60),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      lookback_days: { type: 'number', description: 'Lookback window in days (default 60)' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) => {
    const signals = await collectOperatingSignals(args.tenant_id, args.lookback_days || 60);
    const recoverable = money(signals.overdue_invoices) + money(signals.draft_invoices) + money(signals.stale_quotes);
    const actions = [
      ...signals.overdue_invoices.slice(0, 10).map((invoice) => ({
        type: 'invoice_follow_up',
        approval_required: true,
        id: invoice.id,
        label: invoice.invoice_number || invoice.id,
        amount: Number(invoice.total_amount || 0),
        draft_message: 'Friendly payment reminder with invoice link and clear next step.',
      })),
      ...signals.draft_invoices.slice(0, 10).map((invoice) => ({
        type: 'send_draft_invoice',
        approval_required: true,
        id: invoice.id,
        label: invoice.invoice_number || invoice.id,
        amount: Number(invoice.total_amount || 0),
        draft_message: 'Review invoice details, then send through the configured provider.',
      })),
      ...signals.stale_quotes.slice(0, 10).map((quote) => ({
        type: 'quote_follow_up',
        approval_required: false,
        id: quote.id,
        label: quote.quote_number || quote.name || quote.id,
        amount: Number(quote.total_amount || 0),
        draft_message: 'Short quote follow-up asking whether they want to proceed, adjust scope, or book a call.',
      })),
    ];

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          recoverable_amount_estimate: recoverable,
          overdue_invoice_amount: money(signals.overdue_invoices),
          draft_invoice_amount: money(signals.draft_invoices),
          stale_quote_amount: money(signals.stale_quotes),
          actions,
          guardrail: 'This tool drafts recovery actions. Sending, charging, or changing financial records should require owner approval.',
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'business_memory_graph',
  description:
    'Build a compact memory graph of clients, deals, invoices, leads, and recent agent activity so AI co-workers can reason with business context.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(5).max(100).optional().default(50),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      limit: { type: 'number', description: 'Max nodes per type' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const limit = args.limit || 50;
    const [contactsRes, companiesRes, dealsRes, invoicesRes, sessionsRes] = await Promise.all([
      supabase.from('contacts').select('id, name, email, company_id, created_at').eq('tenant_id', args.tenant_id).limit(limit),
      supabase.from('companies').select('id, name, website, created_at').eq('tenant_id', args.tenant_id).limit(limit),
      supabase.from('deals').select('id, name, stage, value, contact_id, company_id, updated_at').eq('tenant_id', args.tenant_id).limit(limit),
      supabase.from('business_invoices').select('id, invoice_number, status, total_amount, client_id, created_at').eq('tenant_id', args.tenant_id).limit(limit),
      supabase.from('mcp_sessions').select('tool_name, success, created_at').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(limit),
    ]);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          nodes: {
            contacts: contactsRes.data || [],
            companies: companiesRes.data || [],
            deals: dealsRes.data || [],
            invoices: invoicesRes.data || [],
            recent_agent_activity: sessionsRes.data || [],
          },
          edges: {
            deal_to_contact: (dealsRes.data || []).filter((d) => d.contact_id).map((d) => ({ from: d.id, to: d.contact_id })),
            deal_to_company: (dealsRes.data || []).filter((d) => d.company_id).map((d) => ({ from: d.id, to: d.company_id })),
            contact_to_company: (contactsRes.data || []).filter((c) => c.company_id).map((c) => ({ from: c.id, to: c.company_id })),
          },
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'trust_ledger',
  description:
    'Return recent AI/tool decisions and audit evidence from MCP sessions and audit logs. Use before high-risk autonomous action.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    hours: z.number().int().min(1).max(720).optional().default(72),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      hours: { type: 'number', description: 'Lookback window in hours' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const since = new Date(Date.now() - (args.hours || 72) * 60 * 60 * 1000).toISOString();
    const [sessionsRes, auditRes] = await Promise.all([
      supabase.from('mcp_sessions').select('tool_name, success, error_message, duration_ms, metadata, created_at').eq('tenant_id', args.tenant_id).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
      supabase.from('audit_logs').select('*').eq('tenant_id', args.tenant_id).gte('created_at', since).order('created_at', { ascending: false }).limit(100),
    ]);
    const sessions = sessionsRes.data || [];
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          mcp_calls: sessions,
          audit_logs: auditRes.data || [],
          summary: {
            total_mcp_calls: sessions.length,
            failed_mcp_calls: sessions.filter((s) => !s.success).length,
            audit_entries: (auditRes.data || []).length,
          },
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'solo_owner_time_savings_meter',
  description:
    'Estimate owner time saved, money surfaced, and admin work compressed from recent MCP activity and operating signals.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    lookback_days: z.number().int().min(1).max(90).optional().default(30),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      lookback_days: { type: 'number', description: 'Lookback window in days' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const signals = await collectOperatingSignals(args.tenant_id, args.lookback_days || 30);
    const successfulCalls = signals.sessions.filter((s) => s.success).length;
    const estimatedMinutesSaved =
      successfulCalls * 7 +
      signals.open_tasks.length * 4 +
      signals.warm_leads.length * 5 +
      signals.draft_invoices.length * 8 +
      signals.overdue_invoices.length * 10;
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          estimated_hours_saved: Math.round((estimatedMinutesSaved / 60) * 10) / 10,
          successful_agent_calls: successfulCalls,
          recoverable_cash_seen: money(signals.overdue_invoices) + money(signals.draft_invoices),
          admin_items_compressed: signals.open_tasks.length + signals.warm_leads.length + signals.submissions.length,
          caveat: 'This is an operational estimate based on task classes and MCP activity, not a payroll-grade measurement.',
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'deal_to_cash_flow',
  description:
    'Map the path from active deals to quotes, contracts, invoices, and cash so owners can see where revenue is stuck.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [dealsRes, quotesRes, contractsRes, invoicesRes] = await Promise.all([
      supabase.from('deals').select('id, name, stage, value, updated_at').eq('tenant_id', args.tenant_id).order('updated_at', { ascending: false }).limit(100),
      supabase.from('quotes').select('id, quote_number, name, status, total_amount, deal_id, created_at').eq('tenant_id', args.tenant_id).limit(100),
      supabase.from('contracts').select('id, title, status, deal_id, created_at').eq('tenant_id', args.tenant_id).limit(100),
      supabase.from('business_invoices').select('id, invoice_number, status, total_amount, created_at').eq('tenant_id', args.tenant_id).limit(100),
    ]);
    const deals = dealsRes.data || [];
    const rows = deals.map((deal) => {
      const quotes = (quotesRes.data || []).filter((quote) => quote.deal_id === deal.id);
      const contracts = (contractsRes.data || []).filter((contract) => contract.deal_id === deal.id);
      return {
        deal,
        quotes,
        contracts,
        cash_stage:
          quotes.some((q) => ['accepted', 'converted'].includes(String(q.status).toLowerCase())) ? 'ready_for_invoice' :
          quotes.length ? 'quote_pending' :
          contracts.length ? 'contract_pending' :
          'needs_next_step',
      };
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          flow: rows,
          invoice_summary: {
            paid: money((invoicesRes.data || []).filter((i) => String(i.status).toLowerCase() === 'paid')),
            open: money((invoicesRes.data || []).filter((i) => isOpenStatus(i.status))),
          },
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'ai_business_readiness_score',
  description:
    'Score whether the workspace is ready for more automation using business AI state, tool reliability, data signals, and audit posture.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
    },
    required: ['tenant_id'],
  },
  handler: async (args, context) => {
    const signals = await collectOperatingSignals(args.tenant_id, 30);
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);
    const successRate = signals.sessions.length
      ? Math.round((signals.sessions.filter((s) => s.success).length / signals.sessions.length) * 100)
      : 100;
    const evaluation = evaluateBusinessAIState(state, {
      task: 'Increase automation level for the business',
      task_category: 'strategy',
      requires_external_action: true,
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          readiness_score: Math.round((evaluation.readiness_score * 0.75) + (successRate * 0.25)),
          business_ai_state: summarizeBusinessAIState(state),
          tool_success_rate_percent: successRate,
          data_signals: {
            invoices: signals.invoices.length,
            deals: signals.deals.length,
            leads: signals.leads.length,
            tasks: signals.tasks.length,
          },
          recommendation:
            successRate < 80
              ? 'Improve tool reliability before increasing autonomy.'
              : evaluation.recommended_mode === 'autonomous'
                ? 'Ready for limited low-risk autonomous workflows.'
                : 'Use act-with-approval for external, financial, and customer-facing work.',
        }, null, 2),
      }],
    };
  },
});

registerTool('platform-advantage', {
  name: 'client_pulse',
  description:
    'Identify clients or contacts that need attention based on unpaid invoices, open deals, recent intake, and stale activity.',
  inputSchema: z.object({
    tenant_id: z.string().uuid(),
    limit: z.number().int().min(5).max(50).optional().default(20),
  }),
  jsonSchema: {
    type: 'object',
    properties: {
      tenant_id: { type: 'string', description: 'AlphaClone Workspace ID' },
      limit: { type: 'number', description: 'Max pulse items' },
    },
    required: ['tenant_id'],
  },
  handler: async (args) => {
    const supabase = createSupabaseAdminClient();
    const [contactsRes, invoicesRes, dealsRes, formsRes] = await Promise.all([
      supabase.from('contacts').select('id, name, email, company_id, created_at').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('business_invoices').select('id, status, total_amount, client_id, created_at, due_date').eq('tenant_id', args.tenant_id).limit(100),
      supabase.from('deals').select('id, name, stage, value, contact_id, updated_at').eq('tenant_id', args.tenant_id).limit(100),
      supabase.from('form_submissions').select('id, submitter_name, submitter_email, created_at').eq('tenant_id', args.tenant_id).order('created_at', { ascending: false }).limit(50),
    ]);
    const contacts = contactsRes.data || [];
    const pulse = contacts.map((contact) => {
      const invoices = (invoicesRes.data || []).filter((invoice) => invoice.client_id === contact.id && isOpenStatus(invoice.status));
      const deals = (dealsRes.data || []).filter((deal) => deal.contact_id === contact.id && isOpenStatus(deal.stage));
      return {
        contact,
        attention_score: Math.min(100, invoices.length * 35 + deals.length * 25),
        open_invoice_amount: money(invoices),
        open_deals: deals.length,
        next_step:
          invoices.length ? 'Review invoice follow-up' :
          deals.length ? 'Draft deal follow-up' :
          'No urgent client action detected',
      };
    }).filter((item) => item.attention_score > 0);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          pulse: pulse.sort((a, b) => b.attention_score - a.attention_score).slice(0, args.limit || 20),
          recent_intake_without_contact_match: formsRes.data || [],
        }, null, 2),
      }],
    };
  },
});
