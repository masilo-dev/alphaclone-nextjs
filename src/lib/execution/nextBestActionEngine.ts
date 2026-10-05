/**
 * Deterministic next-best-action engine.
 * Prefer rules over LLM when business state is sufficient.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type NbaObjectType =
  | 'lead'
  | 'deal'
  | 'client'
  | 'quote'
  | 'contract'
  | 'project'
  | 'invoice';

export type NextBestAction = {
  object_type: NbaObjectType;
  object_id: string;
  object_label: string;
  current_state: string;
  last_meaningful_event: string | null;
  outstanding_action: string;
  blocking_condition: string | null;
  recommended_next_action: string;
  reason: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  recommended_capability: string;
  approval_requirement: 'none' | 'tenant_policy' | 'always';
  href: string;
};

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400_000);
}

export async function deriveTenantNextBestActions(
  tenantId: string,
  limit = 40
): Promise<NextBestAction[]> {
  const admin = createSupabaseAdminClient();
  const actions: NextBestAction[] = [];

  const [leads, deals, quotes, contracts, invoices, projects] = await Promise.all([
    admin
      .from('leads')
      .select('id, business_name, stage, outreach_status, updated_at, last_contacted_at, created_at')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '("won","lost","converted")')
      .order('updated_at', { ascending: true })
      .limit(25),
    admin
      .from('deals')
      .select('id, name, stage, updated_at, value')
      .eq('tenant_id', tenantId)
      .not('stage', 'in', '("closed_won","closed_lost","won","lost")')
      .order('updated_at', { ascending: true })
      .limit(20),
    admin
      .from('quotes')
      .select('id, quote_number, status, sent_at, updated_at, client_name')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'viewed'])
      .order('sent_at', { ascending: true })
      .limit(20),
    admin
      .from('contracts')
      .select('id, title, status, updated_at, sent_at')
      .eq('tenant_id', tenantId)
      .in('status', ['sent', 'pending_signature', 'partially_signed'])
      .order('updated_at', { ascending: true })
      .limit(20),
    admin
      .from('business_invoices')
      .select('id, invoice_number, status, due_date, total, updated_at')
      .eq('tenant_id', tenantId)
      .in('status', ['overdue', 'sent', 'viewed', 'partially_paid'])
      .order('due_date', { ascending: true })
      .limit(25),
    admin
      .from('projects')
      .select('id, name, status, current_stage, updated_at, due_date')
      .eq('tenant_id', tenantId)
      .not('status', 'in', '("Completed","Cancelled","completed","cancelled")')
      .order('updated_at', { ascending: true })
      .limit(20),
  ]);

  for (const lead of leads.data || []) {
    const last = lead.last_contacted_at || lead.updated_at || lead.created_at;
    const days = daysSince(last) ?? 99;
    const outreach = String(lead.outreach_status || '').toLowerCase();
    if (outreach === 'pending' || days >= 3) {
      actions.push({
        object_type: 'lead',
        object_id: String(lead.id),
        object_label: String(lead.business_name || 'Lead'),
        current_state: String(lead.stage || 'lead'),
        last_meaningful_event: last ? `Last activity ${days}d ago` : null,
        outstanding_action: 'follow_up',
        blocking_condition: null,
        recommended_next_action: days >= 4 ? 'Send contextual follow-up' : 'Make first contact / outreach',
        reason:
          days >= 4
            ? `No meaningful response in ${days} days — lead is going cold.`
            : 'Lead has not been contacted yet.',
        urgency: days >= 7 ? 'high' : days >= 4 ? 'medium' : 'low',
        recommended_capability: 'send_email',
        approval_requirement: 'tenant_policy',
        href: `/dashboard?module=crm&lead=${lead.id}`,
      });
    }
  }

  for (const deal of deals.data || []) {
    const days = daysSince(deal.updated_at) ?? 0;
    if (days >= 5) {
      actions.push({
        object_type: 'deal',
        object_id: String(deal.id),
        object_label: String(deal.name || 'Deal'),
        current_state: String(deal.stage || 'open'),
        last_meaningful_event: `Updated ${days}d ago`,
        outstanding_action: 'advance_or_follow_up',
        blocking_condition: 'stale_pipeline',
        recommended_next_action: 'Review blockers and schedule next commercial step',
        reason: `Deal idle for ${days} days in stage "${deal.stage}".`,
        urgency: days >= 14 ? 'high' : 'medium',
        recommended_capability: 'get_deals',
        approval_requirement: 'none',
        href: `/dashboard?module=crm&deal=${deal.id}`,
      });
    }
  }

  for (const quote of quotes.data || []) {
    const days = daysSince(quote.sent_at || quote.updated_at) ?? 0;
    if (days >= 2) {
      actions.push({
        object_type: 'quote',
        object_id: String(quote.id),
        object_label: String(quote.quote_number || quote.client_name || 'Quote'),
        current_state: String(quote.status),
        last_meaningful_event: quote.sent_at ? `Sent ${days}d ago` : null,
        outstanding_action: 'quote_follow_up',
        blocking_condition: String(quote.status) === 'viewed' ? 'viewed_no_response' : 'awaiting_response',
        recommended_next_action: 'Send contextual quote follow-up',
        reason:
          String(quote.status) === 'viewed'
            ? 'Quote was viewed but not accepted.'
            : `Quote sent ${days} days ago with no response.`,
        urgency: days >= 7 ? 'high' : 'medium',
        recommended_capability: 'send_quote',
        approval_requirement: 'tenant_policy',
        href: `/dashboard?module=quotes&id=${quote.id}`,
      });
    }
  }

  for (const contract of contracts.data || []) {
    const days = daysSince(contract.sent_at || contract.updated_at) ?? 0;
    actions.push({
      object_type: 'contract',
      object_id: String(contract.id),
      object_label: String(contract.title || 'Contract'),
      current_state: String(contract.status),
      last_meaningful_event: contract.sent_at ? `Sent ${days}d ago` : null,
      outstanding_action: 'signature_reminder',
      blocking_condition: 'unsigned',
      recommended_next_action: 'Send signature reminder',
      reason: `Contract still ${contract.status} after ${days} day(s).`,
      urgency: days >= 5 ? 'high' : 'medium',
      recommended_capability: 'send_contract',
      approval_requirement: 'tenant_policy',
      href: `/dashboard?module=contracts&id=${contract.id}`,
    });
  }

  for (const invoice of invoices.data || []) {
    const overdue = String(invoice.status) === 'overdue';
    const daysPastDue = daysSince(invoice.due_date);
    actions.push({
      object_type: 'invoice',
      object_id: String(invoice.id),
      object_label: String(invoice.invoice_number || 'Invoice'),
      current_state: String(invoice.status),
      last_meaningful_event: invoice.due_date ? `Due ${invoice.due_date}` : null,
      outstanding_action: 'payment_reminder',
      blocking_condition: overdue ? 'overdue' : 'awaiting_payment',
      recommended_next_action: overdue ? 'Send overdue payment reminder' : 'Send payment reminder',
      reason: overdue
        ? `Invoice overdue${daysPastDue != null ? ` by ${daysPastDue}d` : ''}.`
        : 'Invoice outstanding — payment not recorded.',
      urgency: overdue ? 'critical' : 'medium',
      recommended_capability: 'send_invoice',
      approval_requirement: 'tenant_policy',
      href: `/dashboard?module=invoicing&id=${invoice.id}`,
    });
  }

  for (const project of projects.data || []) {
    const days = daysSince(project.updated_at) ?? 0;
    const dueSoon =
      project.due_date && daysSince(project.due_date) != null && (daysSince(project.due_date) as number) <= 0
        ? true
        : Boolean(project.due_date && (daysSince(project.due_date) as number) > -7 && (daysSince(project.due_date) as number) < 0);
    if (days >= 7 || dueSoon) {
      actions.push({
        object_type: 'project',
        object_id: String(project.id),
        object_label: String(project.name || 'Project'),
        current_state: `${project.status}/${project.current_stage}`,
        last_meaningful_event: `Updated ${days}d ago`,
        outstanding_action: 'client_or_owner_update',
        blocking_condition: dueSoon ? 'milestone_approaching' : 'inactivity',
        recommended_next_action: dueSoon
          ? 'Send milestone / delivery update to client'
          : 'Check project inactivity and update stakeholders',
        reason: dueSoon
          ? 'Project due date is approaching.'
          : `No project activity for ${days} days.`,
        urgency: dueSoon ? 'high' : 'medium',
        recommended_capability: 'update_project_status',
        approval_requirement: 'none',
        href: `/dashboard?module=projects&id=${project.id}`,
      });
    }
  }

  const urgencyRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  return actions
    .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency])
    .slice(0, limit);
}

/** Map NBA items into Chase-friendly eligibility hints (no parallel chase product). */
export function nbaToChaseHints(actions: NextBestAction[]): Array<{
  policy_hint: string;
  object_type: string;
  object_id: string;
  stop_when: string[];
}> {
  return actions.map((a) => {
    let policy_hint = 'follow_up';
    const stop_when: string[] = [];
    switch (a.object_type) {
      case 'invoice':
        policy_hint = 'invoice_chaser';
        stop_when.push('invoice_paid', 'invoice_void');
        break;
      case 'contract':
        policy_hint = 'contract_signature';
        stop_when.push('contract_signed', 'deal_lost');
        break;
      case 'quote':
        policy_hint = 'quote_follow_up';
        stop_when.push('quote_accepted', 'quote_rejected', 'deal_lost');
        break;
      case 'lead':
        policy_hint = 'lead_follow_up';
        stop_when.push('reply_received', 'deal_won', 'lead_lost');
        break;
      default:
        policy_hint = 'generic_follow_up';
        stop_when.push('manual_stop');
    }
    return {
      policy_hint,
      object_type: a.object_type,
      object_id: a.object_id,
      stop_when,
    };
  });
}
