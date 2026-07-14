import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';

export type LeadFinderSystemHealth = {
  leadSearch: 'in-process' | 'external';
  foursquare: 'configured' | 'missing';
  osm: 'available';
  deepseek: 'configured' | 'missing';
  aiProviders: 'available' | 'degraded';
};

export type LeadFinderStats = {
  leads: {
    total: number;
    withEmail: number;
    withPhone: number;
    byGrade: Record<string, number>;
    byStatus: Record<string, number>;
  };
  campaigns: {
    total: number;
    active: number;
  };
  pipeline: {
    discovered: number;
    enriched: number;
    crmSynced: number;
    contacted: number;
  };
  sources: Record<string, number>;
  recentRuns: Array<{
    id: string;
    campaignId: string;
    status: string;
    progress: number;
    currentStep: string;
    sourceCount: number;
    enrichedCount: number;
    createdCount: number;
    runAt: string;
  }>;
  system: LeadFinderSystemHealth;
};

function countByField<T extends Record<string, unknown>>(
  rows: T[],
  field: keyof T
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = String(row[field] ?? 'unknown');
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export async function getLeadFinderStats(tenantId: string): Promise<LeadFinderStats> {
  const supabase = createSupabaseAdminClient();

  const [
    leadsRes,
    campaignsRes,
    runsRes,
  ] = await Promise.all([
    supabase
      .from('scraper_leads')
      .select('grade, status, email, phone, source, crm_lead_id')
      .eq('tenant_id', tenantId),
    supabase
      .from('scraper_campaigns')
      .select('id, status')
      .eq('tenant_id', tenantId),
    supabase
      .from('lead_campaign_runs')
      .select('id, campaign_id, status, progress, current_step, source_count, enriched_count, created_count, run_at')
      .eq('tenant_id', tenantId)
      .order('run_at', { ascending: false })
      .limit(8),
  ]);

  const leads = (leadsRes.data ?? []) as Array<{
    grade?: string | null;
    status?: string | null;
    email?: string | null;
    phone?: string | null;
    source?: string | null;
    crm_lead_id?: string | null;
  }>;
  const campaigns = (campaignsRes.data ?? []) as Array<{ id: string; status: string }>;
  const runs = (runsRes.data ?? []) as Array<{
    id: string;
    campaign_id: string;
    status: string;
    progress?: number | null;
    current_step?: string | null;
    source_count?: number | null;
    enriched_count?: number | null;
    created_count?: number | null;
    run_at: string;
  }>;

  const withEmail = leads.filter((l) => Boolean(l.email?.trim())).length;
  const withPhone = leads.filter((l) => Boolean(l.phone?.trim())).length;
  const crmSynced = leads.filter((l) => Boolean(l.crm_lead_id)).length;
  const contacted = leads.filter((l) => l.status === 'contacted').length;
  const enriched = leads.filter((l) =>
    ['qualified', 'synced', 'contacted', 'converted'].includes(String(l.status))
  ).length;

  const aiConfigured = Boolean(ENV.DEEPSEEK_API_KEY);

  return {
    leads: {
      total: leads.length,
      withEmail,
      withPhone,
      byGrade: countByField(leads, 'grade'),
      byStatus: countByField(leads, 'status'),
    },
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === 'active').length,
    },
    pipeline: {
      discovered: leads.length,
      enriched,
      crmSynced,
      contacted,
    },
    sources: countByField(leads, 'source'),
    recentRuns: runs.map((r) => ({
      id: r.id,
      campaignId: r.campaign_id,
      status: r.status,
      progress: r.progress ?? 0,
      currentStep: r.current_step ?? 'init',
      sourceCount: r.source_count ?? 0,
      enrichedCount: r.enriched_count ?? 0,
      createdCount: r.created_count ?? 0,
      runAt: r.run_at,
    })),
    system: {
      leadSearch: 'in-process',
      foursquare: process.env.FOURSQUARE_API_KEY ? 'configured' : 'missing',
      osm: 'available',
      deepseek: ENV.DEEPSEEK_API_KEY ? 'configured' : 'missing',
      aiProviders: aiConfigured ? 'available' : 'degraded',
    },
  };
}
