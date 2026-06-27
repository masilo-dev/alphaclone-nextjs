// @ts-nocheck
import { z } from 'zod';
import { registerTool } from '../tool-registry';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { mcpStore } from '@/services/mcp/mcpStore';
import { evaluateBusinessAIState, summarizeBusinessAIState } from '@/services/mcp/businessAIState';

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function dateAhead(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

registerTool('solo-owner', {
  name: 'solo_owner_operator_brief',
  description:
    'Future-facing operating brief for solo business owners. Summarizes cash pressure, client follow-ups, admin load, and the next best actions that save owner time.',
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
    const supabase = createSupabaseAdminClient();
    const since = daysAgo(args.lookback_days || 30);
    const nextWeek = dateAhead(7);
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);

    const [
      invoiceRes,
      leadRes,
      dealRes,
      taskRes,
      campaignRes,
      formRes,
    ] = await Promise.all([
      supabase
        .from('business_invoices')
        .select('id, invoice_number, status, total_amount, due_date, created_at, client_id')
        .eq('tenant_id', args.tenant_id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('leads')
        .select('id, business_name, email, status, stage, source, created_at, value')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('deals')
        .select('id, name, stage, value, created_at, updated_at')
        .eq('tenant_id', args.tenant_id)
        .order('updated_at', { ascending: false })
        .limit(50),
      supabase
        .from('tasks')
        .select('id, title, status, due_date, priority, created_at')
        .eq('tenant_id', args.tenant_id)
        .or(`due_date.is.null,due_date.lte.${nextWeek}`)
        .order('due_date', { ascending: true })
        .limit(50),
      supabase
        .from('email_campaigns')
        .select('id, name, status, total_recipients, total_sent, total_opened, total_clicked, created_at')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('form_submissions')
        .select('id, status, submitter_name, submitter_email, created_at')
        .eq('tenant_id', args.tenant_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const invoices = invoiceRes.data || [];
    const openInvoices = invoices.filter((invoice) => ['sent', 'overdue'].includes(String(invoice.status)));
    const draftInvoices = invoices.filter((invoice) => String(invoice.status) === 'draft');
    const overdueInvoices = invoices.filter((invoice) => {
      const dueTime = invoice.due_date ? new Date(invoice.due_date).getTime() : 0;
      return String(invoice.status) === 'overdue' || (dueTime > 0 && dueTime < Date.now() && String(invoice.status) !== 'paid');
    });
    const outstandingAmount = openInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const overdueAmount = overdueInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount || 0), 0);
    const leads = leadRes.data || [];
    const warmLeads = leads.filter((lead) => !['converted', 'lost'].includes(String(lead.status || '').toLowerCase()));
    const deals = dealRes.data || [];
    const activeDeals = deals.filter((deal) => !['closed_won', 'closed_lost'].includes(String(deal.stage || '').toLowerCase()));
    const tasks = taskRes.data || [];
    const openTasks = tasks.filter((task) => !['done', 'completed', 'cancelled'].includes(String(task.status || '').toLowerCase()));
    const submissions = formRes.data || [];

    const actions = [
      overdueInvoices.length
        ? {
            priority: 'high',
            lane: 'cash',
            action: `Follow up on ${overdueInvoices.length} overdue invoice(s).`,
            expected_value: `$${overdueAmount.toLocaleString()} potential cash recovery`,
            approval_required: true,
          }
        : null,
      draftInvoices.length
        ? {
            priority: 'high',
            lane: 'cash',
            action: `Review and send ${draftInvoices.length} draft invoice(s).`,
            expected_value: 'Faster billing without owner context switching',
            approval_required: true,
          }
        : null,
      warmLeads.length
        ? {
            priority: 'medium',
            lane: 'growth',
            action: `Qualify ${Math.min(warmLeads.length, 5)} newest warm lead(s) and draft replies.`,
            expected_value: 'More booked work from existing intake',
            approval_required: false,
          }
        : null,
      submissions.length
        ? {
            priority: 'medium',
            lane: 'intake',
            action: `Triage ${submissions.length} recent form submission(s).`,
            expected_value: 'Shorter response time and better lead conversion',
            approval_required: false,
          }
        : null,
      openTasks.length
        ? {
            priority: 'medium',
            lane: 'delivery',
            action: `Compress ${openTasks.length} open task(s) into a same-day owner focus list.`,
            expected_value: 'Less admin switching and clearer delivery rhythm',
            approval_required: false,
          }
        : null,
    ].filter(Boolean);

    const readiness = evaluateBusinessAIState(state, {
      task: 'Run solo-owner operating brief and recommend next best business actions',
      task_category: 'operations',
      requires_financial_action: overdueInvoices.length > 0 || draftInvoices.length > 0,
      requires_customer_facing_action: warmLeads.length > 0 || submissions.length > 0,
      requires_external_action: actions.some((item) => item.approval_required),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          owner_profile: summarizeBusinessAIState(state).owner_profile,
          headline: overdueInvoices.length
            ? 'Cash recovery should be the first owner-protection move.'
            : warmLeads.length
              ? 'Lead follow-up is the strongest near-term owner value add.'
              : 'The workspace is ready for admin compression and delivery focus.',
          metrics: {
            outstanding_amount: outstandingAmount,
            overdue_amount: overdueAmount,
            draft_invoices: draftInvoices.length,
            recent_leads: leads.length,
            warm_leads: warmLeads.length,
            active_deals: activeDeals.length,
            open_tasks_due_soon: openTasks.length,
            recent_form_submissions: submissions.length,
            recent_campaigns: (campaignRes.data || []).length,
          },
          next_best_actions: actions.slice(0, 5),
          automation_candidates: [
            'auto-draft invoice follow-ups with owner approval',
            'turn new form submissions into lead replies and booking prompts',
            'compress open tasks into a daily owner focus queue',
            'detect stale deals and generate follow-up drafts',
          ],
          readiness,
        }, null, 2),
      }],
    };
  },
});

registerTool('solo-owner', {
  name: 'solo_owner_value_map',
  description:
    'Map where AlphaClone creates the most leverage for a one-person business: time saved, cash recovered, leads converted, and decisions made faster.',
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
    const state = await mcpStore.getBusinessAIState(context.tenantId, context.userId);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          owner_profile: summarizeBusinessAIState(state).owner_profile,
          value_map: [
            {
              leverage: 'time',
              promise: 'Give the owner back focused work blocks by collapsing admin, follow-ups, and status checks into agent-ready queues.',
              mcp_tools: ['solo_owner_operator_brief', 'get_business_ai_state', 'evaluate_business_ai_readiness'],
            },
            {
              leverage: 'cash',
              promise: 'Find draft, sent, and overdue invoices before the owner has to remember them.',
              mcp_tools: ['accounting_snapshot', 'get_finance_snapshot', 'solo_owner_operator_brief'],
            },
            {
              leverage: 'growth',
              promise: 'Convert intake, leads, and campaigns into next actions instead of letting opportunities sit in separate modules.',
              mcp_tools: ['campaign_brief', 'campaign_diagnose', 'solo_owner_operator_brief'],
            },
            {
              leverage: 'trust',
              promise: 'Keep high-risk work under approval while letting research, drafting, and triage move quickly.',
              mcp_tools: ['evaluate_business_ai_readiness', 'update_business_ai_state'],
            },
          ],
          five_year_positioning:
            'AlphaClone should feel like the solo owner hired an operations lead, finance clerk, intake coordinator, and analyst, but with one governed MCP connection instead of four more apps.',
        }, null, 2),
      }],
    };
  },
});
