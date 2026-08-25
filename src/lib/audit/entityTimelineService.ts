import type { SupabaseClient } from '@supabase/supabase-js';
import { formatAttributionLabel, attributionFromMetadata } from '@/lib/audit/sourceAttribution';

export type EntityType = 'lead' | 'client' | 'contact' | 'contract' | 'invoice' | 'project';

export type EntityTimelineItem = {
  id: string;
  timestamp: string;
  category: 'outreach' | 'audit' | 'lead_activity' | 'email' | 'contract' | 'invoice' | 'meeting' | 'project';
  title: string;
  description: string;
  status?: string;
  source_label: string;
  metadata?: Record<string, unknown>;
};

export type EntityContextSummary = {
  identity: Record<string, unknown>;
  outreach_status: string;
  timeline: EntityTimelineItem[];
  needs_attention: string[];
  next_action: string;
  relationships: Record<string, unknown>;
};

function sortTimeline(items: EntityTimelineItem[]): EntityTimelineItem[] {
  return items
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 80);
}

async function fetchAuditTimelineItems(
  admin: SupabaseClient,
  tenantId: string,
  entityId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  const { data: auditRows } = await admin
    .from('audit_logs')
    .select('id, action, created_at, metadata, entity_type')
    .eq('tenant_id', tenantId)
    .eq('entity_id', entityId)
    .order('created_at', { ascending: false })
    .limit(30);

  for (const row of auditRows || []) {
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
  return items;
}

async function fetchOutreachByEmail(
  admin: SupabaseClient,
  tenantId: string,
  email: string,
  leadId?: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  if (!email && !leadId) return items;

  const { data: outreachRows } = await admin
    .from('lead_outreach_log')
    .select('id, status, subject, campaign_name, created_at, sent_at, provider, metadata, error_message, lead_id')
    .eq('tenant_id', tenantId)
    .or(email ? `lead_id.eq.${leadId || '00000000-0000-0000-0000-000000000000'},lead_email.ilike.${email}` : `lead_id.eq.${leadId}`)
    .order('created_at', { ascending: false })
    .limit(50);

  for (const row of outreachRows || []) {
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
        source_type: (meta.source_type as typeof attr.source_type) || 'campaign_worker',
        source_agent: attr.source_agent !== 'Unknown' ? attr.source_agent : 'Outreach Campaign',
      }),
      metadata: { campaign_name: row.campaign_name, provider: row.provider, lead_id: row.lead_id },
    });
  }
  return items;
}

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
  const [outreachItems, auditItems, leadAuditRows] = await Promise.all([
    fetchOutreachByEmail(admin, tenantId, email, leadId),
    fetchAuditTimelineItems(admin, tenantId, leadId),
    admin
      .from('lead_audit_logs')
      .select('id, action, description, created_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  items.push(...outreachItems, ...auditItems);

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

  return sortTimeline(items);
}

export async function buildClientTimeline(
  admin: SupabaseClient,
  tenantId: string,
  clientId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  const { data: client } = await admin
    .from('business_clients')
    .select('id, name, email, created_at, sales_stage')
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();

  if (client) {
    items.push({
      id: `client-created-${client.id}`,
      timestamp: client.created_at,
      category: 'lead_activity',
      title: 'Client record created',
      description: client.sales_stage ? `Stage: ${client.sales_stage}` : 'Added to CRM',
      source_label: 'AlphaClone UI',
    });
  }

  const email = String(client?.email || '').trim().toLowerCase();
  const [outreachItems, auditItems] = await Promise.all([
    fetchOutreachByEmail(admin, tenantId, email),
    fetchAuditTimelineItems(admin, tenantId, clientId),
  ]);
  items.push(...outreachItems, ...auditItems);
  return sortTimeline(items);
}

export async function buildContractTimeline(
  admin: SupabaseClient,
  tenantId: string,
  contractId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  const { data: contract } = await admin
    .from('contracts')
    .select('id, title, status, lifecycle_status, created_at, signed_at, client_signed_at')
    .eq('tenant_id', tenantId)
    .eq('id', contractId)
    .maybeSingle();

  if (contract) {
    items.push({
      id: `contract-created-${contract.id}`,
      timestamp: contract.created_at,
      category: 'contract',
      title: 'Contract created',
      description: contract.title || 'Agreement',
      status: contract.lifecycle_status || contract.status,
      source_label: 'AlphaClone UI',
    });
    if (contract.signed_at || contract.client_signed_at) {
      items.push({
        id: `contract-signed-${contract.id}`,
        timestamp: contract.client_signed_at || contract.signed_at,
        category: 'contract',
        title: 'Contract signed',
        description: contract.title || 'Agreement executed',
        status: contract.status,
        source_label: 'External signing portal',
      });
    }
  }

  const [{ data: sigEvents }, { data: auditTrail }, auditItems] = await Promise.all([
    admin
      .from('contract_signature_events')
      .select('id, event_type, signer_email, occurred_at, provider')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .order('occurred_at', { ascending: false })
      .limit(20),
    admin
      .from('contract_audit_trail')
      .select('id, action, actor_email, created_at')
      .eq('tenant_id', tenantId)
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false })
      .limit(20),
    fetchAuditTimelineItems(admin, tenantId, contractId),
  ]);

  for (const row of sigEvents || []) {
    items.push({
      id: `sig-${row.id}`,
      timestamp: row.occurred_at,
      category: 'contract',
      title: `Signature — ${row.event_type}`,
      description: row.signer_email || 'Signer activity',
      source_label: row.provider || 'Bonnie eSign',
    });
  }
  for (const row of auditTrail || []) {
    items.push({
      id: `contract-audit-${row.id}`,
      timestamp: row.created_at,
      category: 'contract',
      title: row.action?.replace(/_/g, ' ') || 'Contract event',
      description: row.actor_email || '',
      source_label: 'Contract audit trail',
    });
  }
  items.push(...auditItems);
  return sortTimeline(items);
}

export async function buildInvoiceTimeline(
  admin: SupabaseClient,
  tenantId: string,
  invoiceId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  const { data: invoice } = await admin
    .from('business_invoices')
    .select('id, invoice_number, status, lifecycle_status, created_at, paid_at, total, client_id')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();

  if (invoice) {
    items.push({
      id: `invoice-created-${invoice.id}`,
      timestamp: invoice.created_at,
      category: 'invoice',
      title: 'Invoice created',
      description: `#${invoice.invoice_number || invoice.id.slice(0, 8)}`,
      status: invoice.lifecycle_status || invoice.status,
      source_label: 'AlphaClone UI',
    });
    if (invoice.paid_at) {
      items.push({
        id: `invoice-paid-${invoice.id}`,
        timestamp: invoice.paid_at,
        category: 'invoice',
        title: 'Payment received',
        description: `Total: ${invoice.total ?? '—'}`,
        status: 'paid',
        source_label: 'Payment reconciliation',
      });
    }
  }

  const [{ data: lifecycleEvents }, auditItems] = await Promise.all([
    admin
      .from('invoice_lifecycle_events')
      .select('id, from_status, to_status, source, created_at')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: false })
      .limit(20),
    fetchAuditTimelineItems(admin, tenantId, invoiceId),
  ]);

  for (const row of lifecycleEvents || []) {
    items.push({
      id: `inv-lifecycle-${row.id}`,
      timestamp: row.created_at,
      category: 'invoice',
      title: `Status → ${row.to_status}`,
      description: `From ${row.from_status || 'unknown'}`,
      source_label: row.source || 'Lifecycle engine',
    });
  }
  items.push(...auditItems);
  return sortTimeline(items);
}

export async function buildProjectTimeline(
  admin: SupabaseClient,
  tenantId: string,
  projectId: string,
): Promise<EntityTimelineItem[]> {
  const items: EntityTimelineItem[] = [];
  const { data: project } = await admin
    .from('projects')
    .select('id, name, status, created_at, client_id, contract_id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .maybeSingle();

  if (project) {
    items.push({
      id: `project-created-${project.id}`,
      timestamp: project.created_at,
      category: 'project',
      title: 'Project created',
      description: project.name || 'Project',
      status: project.status,
      source_label: 'AlphaClone UI',
    });
  }

  const auditItems = await fetchAuditTimelineItems(admin, tenantId, projectId);
  items.push(...auditItems);
  return sortTimeline(items);
}

export async function buildEntityContextSummary(
  admin: SupabaseClient,
  tenantId: string,
  entityType: EntityType,
  entityId: string,
): Promise<EntityContextSummary> {
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

    const clientId = typeof lead?.client_id === 'string' ? lead.client_id : null;

    const [{ data: contracts }, { data: deals }, { data: lifecycleLinks }] = await Promise.all([
      clientId
        ? admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).eq('client_id', clientId).limit(5)
        : admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).contains('metadata', { lead_id: entityId }).limit(5),
      admin.from('deals').select('id, name, stage, value').eq('tenant_id', tenantId).contains('metadata', { lead_id: entityId }).limit(5),
      admin.from('revenue_lifecycle_links').select('target_type, target_id').eq('tenant_id', tenantId).eq('source_type', 'lead').eq('source_id', entityId).limit(20),
    ]);

    let invoices: Array<Record<string, unknown>> = [];
    if (clientId) {
      const { data } = await admin
        .from('business_invoices')
        .select('id, status, total, invoice_number')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .limit(5);
      invoices = data || [];
    } else {
      const invoiceIds = (lifecycleLinks || [])
        .filter((l) => l.target_type === 'invoice' && l.target_id)
        .map((l) => l.target_id as string);
      if (invoiceIds.length) {
        const { data } = await admin
          .from('business_invoices')
          .select('id, status, total, invoice_number')
          .eq('tenant_id', tenantId)
          .in('id', invoiceIds)
          .limit(5);
        invoices = data || [];
      }
    }

    relationships.contracts = contracts || [];
    relationships.invoices = invoices;
    relationships.deals = deals || [];

    return { identity, outreach_status, timeline, needs_attention, next_action, relationships };
  }

  if (entityType === 'client') {
    const { data: client } = await admin.from('business_clients').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = client || {};
    const timeline = await buildClientTimeline(admin, tenantId, entityId);

    const lastOutreach = timeline.find((t) => t.category === 'outreach');
    outreach_status = lastOutreach ? (lastOutreach.status || 'Sent') : 'Never contacted';
    if (lastOutreach?.status === 'replied') {
      needs_attention.push('Client replied to outreach');
      next_action = 'Follow up on the reply.';
    }

    const [{ data: contracts }, { data: invoices }, { data: projects }] = await Promise.all([
      admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).eq('client_id', entityId).limit(5),
      admin.from('business_invoices').select('id, status, total, invoice_number').eq('tenant_id', tenantId).eq('client_id', entityId).limit(5),
      admin.from('projects').select('id, name, status').eq('tenant_id', tenantId).eq('client_id', entityId).limit(5),
    ]);
    relationships.contracts = contracts || [];
    relationships.invoices = invoices || [];
    relationships.projects = projects || [];

    if (!contracts?.length && client?.sales_stage === 'customer') {
      needs_attention.push('Customer has no linked contracts');
      next_action = 'Create or link a contract for this customer.';
    }

    return { identity, outreach_status, timeline, needs_attention, next_action, relationships };
  }

  if (entityType === 'contact') {
    const { data: contact } = await admin.from('contacts').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = contact || {};
    const email = String(contact?.email || '').trim().toLowerCase();
    const timeline = await fetchOutreachByEmail(admin, tenantId, email);
    const auditItems = await fetchAuditTimelineItems(admin, tenantId, entityId);
    const merged = sortTimeline([...timeline, ...auditItems]);

    outreach_status = timeline[0]?.status || 'Never contacted';
    return { identity, outreach_status, timeline: merged, needs_attention, next_action, relationships };
  }

  if (entityType === 'contract') {
    const { data: contract } = await admin.from('contracts').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = contract || {};
    const timeline = await buildContractTimeline(admin, tenantId, entityId);

    const status = String(contract?.lifecycle_status || contract?.status || '');
    if (['sent', 'viewed'].includes(status)) {
      needs_attention.push('Awaiting signature');
      next_action = 'Send a signature reminder or follow up with the client.';
    } else if (status === 'fully_signed' || status === 'client_signed') {
      next_action = 'Create project and invoice from this signed contract.';
    }

    const [{ data: invoices }, { data: projects }, { data: parties }] = await Promise.all([
      admin.from('business_invoices').select('id, invoice_number, status, total').eq('tenant_id', tenantId).eq('contract_id', entityId).limit(5),
      admin.from('projects').select('id, name, status').eq('tenant_id', tenantId).eq('contract_id', entityId).limit(5),
      admin.from('contract_parties').select('id, signer_role, party_snapshot').eq('tenant_id', tenantId).eq('contract_id', entityId).limit(10),
    ]);
    relationships.invoices = invoices || [];
    relationships.projects = projects || [];
    relationships.parties = parties || [];
    if (contract?.client_id) {
      const { data: client } = await admin.from('business_clients').select('id, name, email').eq('tenant_id', tenantId).eq('id', contract.client_id).maybeSingle();
      relationships.client = client || null;
    }

    return { identity, outreach_status: 'N/A', timeline, needs_attention, next_action, relationships };
  }

  if (entityType === 'invoice') {
    const { data: invoice } = await admin.from('business_invoices').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = invoice || {};
    const timeline = await buildInvoiceTimeline(admin, tenantId, entityId);

    const status = String(invoice?.lifecycle_status || invoice?.status || '');
    if (status === 'overdue') {
      needs_attention.push('Invoice is overdue');
      next_action = 'Send a payment reminder or call the client.';
    } else if (status === 'sent' || status === 'viewed') {
      next_action = 'Monitor payment or send a follow-up.';
    } else if (status === 'paid') {
      next_action = 'Invoice settled — review revenue recognition.';
    }

    const [{ data: links }, clientRow] = await Promise.all([
      admin.from('revenue_lifecycle_links').select('source_type, source_id, target_type, target_id, relationship').eq('tenant_id', tenantId).or(`source_id.eq.${entityId},target_id.eq.${entityId}`).limit(10),
      invoice?.client_id
        ? admin.from('business_clients').select('id, name, email').eq('tenant_id', tenantId).eq('id', invoice.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    relationships.links = links || [];
    relationships.client = clientRow.data || null;
    if (invoice?.contract_id) {
      const { data: contract } = await admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).eq('id', invoice.contract_id).maybeSingle();
      relationships.contract = contract || null;
    }

    return { identity, outreach_status: 'N/A', timeline, needs_attention, next_action, relationships };
  }

  if (entityType === 'project') {
    const { data: project } = await admin.from('projects').select('*').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    identity = project || {};
    const timeline = await buildProjectTimeline(admin, tenantId, entityId);

    if (project?.status === 'at_risk' || project?.health === 'At Risk') {
      needs_attention.push('Project health is at risk');
      next_action = 'Review blockers and update the delivery plan.';
    }

    const [{ data: invoices }, { data: tasks }, clientRow] = await Promise.all([
      admin.from('business_invoices').select('id, invoice_number, status, total').eq('tenant_id', tenantId).eq('project_id', entityId).limit(5),
      admin.from('tasks').select('id, title, status, due_date').eq('tenant_id', tenantId).eq('project_id', entityId).limit(8),
      project?.client_id
        ? admin.from('business_clients').select('id, name').eq('tenant_id', tenantId).eq('id', project.client_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    relationships.invoices = invoices || [];
    relationships.tasks = tasks || [];
    relationships.client = clientRow.data || null;
    if (project?.contract_id) {
      const { data: contract } = await admin.from('contracts').select('id, title, status').eq('tenant_id', tenantId).eq('id', project.contract_id).maybeSingle();
      relationships.contract = contract || null;
    }

    return { identity, outreach_status: 'N/A', timeline, needs_attention, next_action, relationships };
  }

  return { identity, outreach_status, timeline: [], needs_attention, next_action, relationships };
}
