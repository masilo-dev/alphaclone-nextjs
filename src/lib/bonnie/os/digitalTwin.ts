/**
 * Business Digital Twin — live model of the business for Bonnie to reason over.
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { DigitalTwinSnapshot, RiskLevel } from './types';

function computeHealthScore(params: {
  overdueInvoices: number;
  openTickets: number;
  staleDeals: number;
  openLeads: number;
}): { score: number; riskLevel: RiskLevel; risks: DigitalTwinSnapshot['risks']; opportunities: DigitalTwinSnapshot['opportunities'] } {
  let score = 100;
  const risks: DigitalTwinSnapshot['risks'] = [];
  const opportunities: DigitalTwinSnapshot['opportunities'] = [];

  if (params.overdueInvoices > 0) {
    score -= Math.min(35, params.overdueInvoices * 5);
    risks.push({
      level: params.overdueInvoices >= 5 ? 'high' : 'medium',
      title: `${params.overdueInvoices} overdue invoices`,
      evidence: 'AR aging pressure detected in digital twin',
    });
  }
  if (params.openTickets > 0) {
    score -= Math.min(20, params.openTickets * 2);
    risks.push({
      level: params.openTickets >= 10 ? 'high' : 'medium',
      title: `${params.openTickets} open support tickets`,
    });
  }
  if (params.staleDeals > 0) {
    score -= Math.min(20, params.staleDeals * 3);
    risks.push({
      level: 'medium',
      title: `${params.staleDeals} stale deals need attention`,
    });
  }
  if (params.openLeads > 5) {
    opportunities.push({
      title: `${params.openLeads} open leads available for qualification/outreach`,
      confidence: 0.72,
    });
  }

  score = Math.max(5, Math.min(100, score));
  const riskLevel: RiskLevel =
    score < 40 ? 'critical' : score < 55 ? 'high' : score < 75 ? 'medium' : 'low';

  return { score, riskLevel, risks, opportunities };
}

export async function buildDigitalTwin(tenantId: string): Promise<DigitalTwinSnapshot> {
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const safeCount = async (promise: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    try {
      const res = await promise;
      if (res.error) return 0;
      return res.count || 0;
    } catch {
      return 0;
    }
  };

  const [
    contactCount,
    dealCount,
    invoiceCount,
    leadCount,
    ticketCount,
    overdueCount,
    staleDealCount,
  ] = await Promise.all([
    safeCount(admin.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    safeCount(admin.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    safeCount(admin.from('business_invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    safeCount(admin.from('leads').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)),
    safeCount(admin.from('tickets').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).in('status', ['open', 'pending', 'in_progress'])),
    safeCount(admin.from('business_invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('status', 'overdue')),
    safeCount(admin.from('deals').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).lt('updated_at', staleBefore)),
  ]);

  const entityCounts = {
    contacts: contactCount,
    deals: dealCount,
    invoices: invoiceCount,
    leads: leadCount,
    open_tickets: ticketCount,
    overdue_invoices: overdueCount,
    stale_deals: staleDealCount,
  };

  const { score, riskLevel, risks, opportunities } = computeHealthScore({
    overdueInvoices: entityCounts.overdue_invoices,
    openTickets: entityCounts.open_tickets,
    staleDeals: entityCounts.stale_deals,
    openLeads: entityCounts.leads,
  });

  return {
    kpis: {
      health_score: score,
      contacts: entityCounts.contacts,
      deals: entityCounts.deals,
      invoices: entityCounts.invoices,
      leads: entityCounts.leads,
      open_tickets: entityCounts.open_tickets,
      overdue_invoices: entityCounts.overdue_invoices,
      stale_deals: entityCounts.stale_deals,
    },
    departments: {
      sales: {
        status: entityCounts.stale_deals > 0 ? 'attention' : 'healthy',
        signals: entityCounts.stale_deals > 0 ? [`${entityCounts.stale_deals} stale deals`] : ['Pipeline looks active'],
      },
      finance: {
        status: entityCounts.overdue_invoices > 0 ? 'attention' : 'healthy',
        signals: entityCounts.overdue_invoices > 0
          ? [`${entityCounts.overdue_invoices} overdue invoices`]
          : ['No overdue invoices detected'],
      },
      support: {
        status: entityCounts.open_tickets > 8 ? 'attention' : 'healthy',
        signals: [`${entityCounts.open_tickets} open tickets`],
      },
    },
    risks,
    opportunities,
    entityCounts,
    observedAt: now.toISOString(),
  };
}

export async function persistDigitalTwinSnapshot(
  tenantId: string,
  snapshot: DigitalTwinSnapshot,
  source: 'continuous' | 'event' | 'manual' | 'cognitive' = 'continuous'
): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const health = Number(snapshot.kpis.health_score || 0);
  const riskLevel =
    health < 40 ? 'critical' : health < 55 ? 'high' : health < 75 ? 'medium' : 'low';

  const recommendations = [
    ...snapshot.risks.map((r) => ({ type: 'risk', title: r.title, level: r.level })),
    ...snapshot.opportunities.map((o) => ({
      type: 'opportunity',
      title: o.title,
      confidence: o.confidence,
    })),
  ];

  const { data, error } = await admin
    .from('bonnie_digital_twin_snapshots')
    .insert({
      tenant_id: tenantId,
      snapshot,
      health_score: health,
      risk_level: riskLevel,
      recommendations,
      source,
    })
    .select('id')
    .single();

  if (error) {
    console.warn('[digitalTwin] persist failed:', error.message);
    return null;
  }
  return data?.id || null;
}

export async function refreshDigitalTwin(
  tenantId: string,
  source: 'continuous' | 'event' | 'manual' | 'cognitive' = 'continuous'
) {
  const snapshot = await buildDigitalTwin(tenantId);
  const id = await persistDigitalTwinSnapshot(tenantId, snapshot, source);
  return { id, snapshot };
}

export async function getLatestDigitalTwin(tenantId: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('bonnie_digital_twin_snapshots')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[digitalTwin] getLatest failed:', error.message);
    return null;
  }
  return data;
}
