/**
 * Persisted business knowledge graph for Bonnie's world model.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { KnowledgeEdgeInput, KnowledgeNodeInput } from './types';

async function upsertNode(tenantId: string, node: KnowledgeNodeInput): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('bonnie_knowledge_nodes')
    .upsert(
      {
        tenant_id: tenantId,
        entity_type: node.entityType,
        entity_id: String(node.entityId),
        label: node.label || `${node.entityType}:${node.entityId}`,
        properties: node.properties || {},
        confidence: node.confidence ?? 0.8,
        last_observed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,entity_type,entity_id' }
    )
    .select('id')
    .single();

  if (error) {
    console.warn('[knowledgeGraph] upsertNode failed:', error.message);
    return null;
  }
  return data?.id || null;
}

export async function upsertKnowledgeNodes(
  tenantId: string,
  nodes: KnowledgeNodeInput[]
): Promise<number> {
  let ok = 0;
  for (const node of nodes) {
    const id = await upsertNode(tenantId, node);
    if (id) ok += 1;
  }
  return ok;
}

export async function upsertKnowledgeEdges(
  tenantId: string,
  edges: KnowledgeEdgeInput[]
): Promise<number> {
  const admin = createSupabaseAdminClient();
  let ok = 0;

  for (const edge of edges) {
    const fromId = await upsertNode(tenantId, {
      entityType: edge.fromEntityType,
      entityId: edge.fromEntityId,
      label: `${edge.fromEntityType}:${edge.fromEntityId}`,
    });
    const toId = await upsertNode(tenantId, {
      entityType: edge.toEntityType,
      entityId: edge.toEntityId,
      label: `${edge.toEntityType}:${edge.toEntityId}`,
    });
    if (!fromId || !toId) continue;

    const { error } = await admin.from('bonnie_knowledge_edges').upsert(
      {
        tenant_id: tenantId,
        from_node_id: fromId,
        to_node_id: toId,
        relation: edge.relation,
        properties: edge.properties || {},
        confidence: edge.confidence ?? 0.75,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,from_node_id,to_node_id,relation' }
    );
    if (!error) ok += 1;
    else console.warn('[knowledgeGraph] upsertEdge failed:', error.message);
  }

  return ok;
}

export async function syncBusinessKnowledgeGraph(
  tenantId: string,
  limit = 50
): Promise<{ nodes: number; edges: number; ephemeral: Record<string, unknown> }> {
  const admin = createSupabaseAdminClient();
  const [contactsRes, companiesRes, dealsRes, invoicesRes, leadsRes] = await Promise.all([
    admin.from('contacts').select('id, first_name, last_name, full_name, email, company_id').eq('tenant_id', tenantId).limit(limit),
    admin.from('companies').select('id, name, website').eq('tenant_id', tenantId).limit(limit),
    admin.from('deals').select('id, name, stage, value, contact_id, company_id').eq('tenant_id', tenantId).limit(limit),
    admin.from('business_invoices').select('id, invoice_number, status, total_amount, client_id').eq('tenant_id', tenantId).limit(limit),
    admin.from('leads').select('id, name, email, company, status, score').eq('tenant_id', tenantId).limit(limit),
  ]);

  type ContactRow = { id: string; first_name?: string | null; last_name?: string | null; full_name?: string | null; email?: string | null; company_id?: string | null };
  type CompanyRow = { id: string; name?: string | null; website?: string | null };
  type DealRow = { id: string; name?: string | null; stage?: string | null; value?: number | null; contact_id?: string | null; company_id?: string | null };
  type InvoiceRow = { id: string; invoice_number?: string | null; status?: string | null; total_amount?: number | null; client_id?: string | null };
  type LeadRow = { id: string; name?: string | null; email?: string | null; company?: string | null; status?: string | null; score?: number | null };

  const contacts = (contactsRes.data || []) as ContactRow[];
  const companies = (companiesRes.data || []) as CompanyRow[];
  const deals = (dealsRes.data || []) as DealRow[];
  const invoices = (invoicesRes.data || []) as InvoiceRow[];
  const leads = (leadsRes.data || []) as LeadRow[];

  const nodes: KnowledgeNodeInput[] = [
    ...contacts.map((c) => ({
      entityType: 'contact',
      entityId: c.id,
      label: c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || c.email || c.id,
      properties: { email: c.email, company_id: c.company_id },
    })),
    ...companies.map((c) => ({
      entityType: 'company',
      entityId: c.id,
      label: c.name || c.id,
      properties: { website: c.website },
    })),
    ...deals.map((d) => ({
      entityType: 'deal',
      entityId: d.id,
      label: d.name || d.id,
      properties: { stage: d.stage, value: d.value },
    })),
    ...invoices.map((i) => ({
      entityType: 'invoice',
      entityId: i.id,
      label: i.invoice_number || i.id,
      properties: { status: i.status, total_amount: i.total_amount, client_id: i.client_id },
    })),
    ...leads.map((l) => ({
      entityType: 'lead',
      entityId: l.id,
      label: l.name || l.email || l.id,
      properties: { status: l.status, score: l.score, company: l.company },
    })),
  ];

  const edges: KnowledgeEdgeInput[] = [
    ...deals
      .filter((d) => d.contact_id)
      .map((d) => ({
        fromEntityType: 'deal',
        fromEntityId: d.id,
        toEntityType: 'contact',
        toEntityId: String(d.contact_id),
        relation: 'belongs_to',
      })),
    ...deals
      .filter((d) => d.company_id)
      .map((d) => ({
        fromEntityType: 'deal',
        fromEntityId: d.id,
        toEntityType: 'company',
        toEntityId: String(d.company_id),
        relation: 'for_company',
      })),
    ...contacts
      .filter((c) => c.company_id)
      .map((c) => ({
        fromEntityType: 'contact',
        fromEntityId: c.id,
        toEntityType: 'company',
        toEntityId: String(c.company_id),
        relation: 'works_at',
      })),
    ...invoices
      .filter((i) => i.client_id)
      .map((i) => ({
        fromEntityType: 'invoice',
        fromEntityId: i.id,
        toEntityType: 'client',
        toEntityId: String(i.client_id),
        relation: 'billed_to',
      })),
  ];

  const nodeCount = await upsertKnowledgeNodes(tenantId, nodes);
  const edgeCount = await upsertKnowledgeEdges(tenantId, edges);

  return {
    nodes: nodeCount,
    edges: edgeCount,
    ephemeral: {
      nodes: { contacts, companies, deals, invoices, leads },
      edges: {
        deal_to_contact: deals.filter((d) => d.contact_id).map((d) => ({ from: d.id, to: d.contact_id })),
        deal_to_company: deals.filter((d) => d.company_id).map((d) => ({ from: d.id, to: d.company_id })),
        contact_to_company: contacts.filter((c) => c.company_id).map((c) => ({ from: c.id, to: c.company_id })),
      },
    },
  };
}

export async function getKnowledgeGraphSummary(tenantId: string, limit = 40) {
  const admin = createSupabaseAdminClient();
  const [nodesRes, edgesRes] = await Promise.all([
    admin
      .from('bonnie_knowledge_nodes')
      .select('id, entity_type, entity_id, label, properties, confidence, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(limit),
    admin
      .from('bonnie_knowledge_edges')
      .select('id, from_node_id, to_node_id, relation, confidence, updated_at')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(limit),
  ]);

  return {
    nodes: nodesRes.data || [],
    edges: edgesRes.data || [],
    error: nodesRes.error?.message || edgesRes.error?.message || null,
  };
}
