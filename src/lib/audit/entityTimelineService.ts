import type { SupabaseClient } from '@supabase/supabase-js';
import { formatAttributionLabel, attributionFromMetadata } from '@/lib/audit/sourceAttribution';

export type EntityTimelineItem = {
  id: string;
  timestamp: string;
  category: 'outreach' | 'audit' | 'lead_activity' | 'email' | 'contract' | 'invoice' | 'meeting';
  title: string;
  description: string;
  status?: string;
  source_label: string;
  metadata?: Record<string, unknown>;
};

export async function buildLeadTimeline(
  admin: SupabaseClient,
  tenantId: string,
  leadId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];

  const { data: lead } = await admin
    .from('leads')
    .select('id, email, business_name, contact_name, created_at, source, stage')
    .eq('tenant_id', tenantId)
    .eq('id', leadId)
    .maybeSingle();

  if (lead) {
    items.push({
      id: `lead-created-${lead.id}`,
      timestamp: lead.created_at,
      category: 'lead_activity',
      title: 'Lead created',
      description: `Added to CRM${lead.source ? ` · Source: ${lead.source}` : ''}`,
      source_label: lead.source?.includes('mcp') ? 'ChatGPT via AlphaClone MCP' : (lead.source || 'Source unavailable'),
    });
  }

  const email = String(lead?.email || '').trim().toLowerCase();

  const [outreachRows, auditRows, leadAuditRows] = await Promise.all([
    admin
      .from('lead_outreach_log')
      .select('id, status, subject, campaign_name, created_at, sent_at, provider, metadata, error_message')
      .eq('tenant_id', tenantId)
      .or(email ? `lead_id.eq.${leadId},lead_email.ilike.${email}` : `lead_id.eq.${leadId}`)
      .order('created_at', { ascending: false })
      .limit(50),
    admin
      .from('audit_logs')
      .select('id, action, created_at, metadata, entity_type')
      .eq('tenant_id', tenantId)
      .eq('entity_id', leadId)
      .order('created_at', { ascending: false })
      .limit(30),
    admin
      .from('lead_audit_logs')
      .select('id, action, description, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  for (const row of outreachRows.data || []) {
    const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {};
    const attr = attributionFromMetadata(meta);
    items.push({
      id: `outreach-${row.id}`,
      timestamp: row.sent_at || row.created_at,
      category: 'outreach',
      title: row.status === 'replied' ? 'Reply received' : `Outreach — ${row.status || 'sent'}`,
      description: row.subject || row.campaign_name || 'Outreach email',
      status: row.status || undefined,
      source_label: formatAttributionLabel({
        ...attr,
        source_type: meta.source_type as typeof attr.source_type || 'campaign_worker',
        source_agent: attr.source_agent !== 'Unknown' ? attr.source_agent : 'Outreach Campaign',
      }),
      metadata: { campaign_name: row.campaign_name, provider: row.provider },
    });
  }

  for (const row of auditRows.data || []) {
    const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata as Record<string, unknown> : {};
    if (meta.is_business_activity) {
      items.push({
        id: `audit-${row.id}`,
        timestamp: row.created_at,
        category: 'audit',
        title: String(meta.event || row.action),
        description: String(meta.result || meta.business_context || row.action),
        source_label: formatAttributionLabel(attributionFromMetadata(meta.technical_details as Record<string, unknown>)),
        metadata: meta,
      });
    }
  }

  for (const row of leadAuditRows.data || []) {
    items.push({
      id: `lead-audit-${row.id}`,
      timestamp: row.created_at,
      category: 'lead_activity',
      title: row.action || 'Lead updated',
      description: row.description || '',
      source_label: formatAttributionLabel(attributionFromMetadata(row.metadata as Record<string, unknown>)),
    });
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return items.slice(0, 80);
}

export async function buildEntityContextSummary(
  admin: SupabaseClient,
  tenantId: string,
  entityType: 'lead' | 'client' | 'contact',
  entityId: string,
): Promise<{
  identity: Record<string, unknown>;
  outreach_status: string;
  timeline: EntityTimelineItem[];
  needs_attention: string[];
  next_action: string;
  relationships: Record<string, unknown>;
}> {
  const needs_attention: string[] = [];
  let identity: Record<string, unknown> = {};
  let next_action = 'Review this record and plan the next step.';
  let outreach_status = 'Never contacted';
  const relationships: Record<string, unknown> = {};

  if (entityType === 'lead') {
    const { data: lead } = await admin.from('leads').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = lead || {};
    const timeline = await buildLeadTimeline(admin, tenantId, entityId);

    const lastOutreach = timeline.find((t) => t.category === 'outreach');
    if (lastOutreach) {
      outreach_status = lastOutreach.status || 'Sent';
      if (lastOutreach.status === 'replied') {
        needs_attention.push('Prospect replied — follow up required');
        next_action = 'Review the reply and send a follow-up or create a proposal.';
      } else if (lastOutreach.status === 'bounced' || lastOutreach.status === 'failed') {
        needs_attention.push('Last outreach delivery failed');
        next_action = 'Verify email address or choose another channel.';
      }
    } else {
      needs_attention.push('Lead has not been contacted');
      next_action = 'Send outreach or schedule a call.';
    }

    if (lead?.stage === 'qualified' && !timeline.some((t) => t.title.includes('Proposal'))) {
      next_action = 'Create a proposal for this qualified lead.';
    }

    const [{ data: contracts }, { data: invoices }] = await Promise.all([
      admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).eq('client_id', entityId).limit(5),
      admin.from('business_invoices').select('id, status, total, invoice_number').eq('tenant_id', tenantId).limit(5),
    ]);
    relationships.contracts = contracts || [];
    relationships.invoices = invoices || [];

    return { identity, outreach_status, timeline, needs_attention, next_action, relationships };
  }

  return {
    identity,
    outreach_status,
    timeline: [],
    needs_attention,
    next_action,
    relationships,
  };
}
