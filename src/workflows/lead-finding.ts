import { start } from 'workflow/api';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { leadNurtureWorkflow } from './lead-nurture';

/**
 * Lead Finding Workflow
 * Scrapes, enriches, scores, and injects leads into CRM.
 */
export async function leadFindingWorkflow({ query, location, tenantId }: { query: string; location: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Scrape Leads
  const rawLeads = await scrapeLeads(query, location);

  // 2. Enrich Leads
  const enrichedLeads = await enrichLeads(rawLeads);

  // 3. Score Leads with AI
  const scoredLeads = await scoreLeads(enrichedLeads);

  // 4. Bulk Add to CRM
  const savedLeads = await bulkAddCRM(scoredLeads, tenantId);

  // 5. Notify Founder
  await notifyFounder(savedLeads.length, tenantId);

  // 6. Start Nurture for high scorers
  for (const lead of savedLeads) {
    if (lead.metadata?.score > 50) {
      await start(leadNurtureWorkflow, [{ leadId: lead.id, tenantId }]);
    }
  }
}

async function scrapeLeads(query: string, location: string) {
  "use step";
  console.log(`Scraping leads for ${query} in ${location}`);
  return [{ name: 'Lead A', email: 'a@example.com' }, { name: 'Lead B', email: 'b@example.com' }];
}

async function enrichLeads(rawLeads: any[]) {
  "use step";
  return rawLeads.map(l => ({ ...l, industry: 'Tech', company: 'Example Inc' }));
}

async function scoreLeads(enrichedLeads: any[]) {
  "use step";
  return enrichedLeads.map(l => ({ ...l, score: Math.floor(Math.random() * 100) }));
}

async function bulkAddCRM(scoredLeads: any[], tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: leads } = await supabase.from('leads').insert(
    scoredLeads.map(l => ({
      tenant_id: tenantId,
      business_name: l.name,
      email: l.email,
      industry: l.industry,
      metadata: { score: l.score, company: l.company },
      status: 'new'
    }))
  ).select();
  return leads || [];
}

async function notifyFounder(count: number, tenantId: string) {
  "use step";
  console.log(`Found ${count} new leads for tenant ${tenantId}`);
}
