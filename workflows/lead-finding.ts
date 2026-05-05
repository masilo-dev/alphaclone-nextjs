import { workflow, step, start } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { leadNurtureWorkflow } from './lead-nurture';

/**
 * Lead Finding Workflow
 * Scrapes, enriches, scores, and injects leads into CRM.
 */
export const leadFindingWorkflow = workflow(async ({ query, location, tenantId }: { query: string; location: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Scrape Leads
  const rawLeads = await step('scrape-leads', async () => {
    // Logic to call scraping services
    console.log(`Scraping leads for ${query} in ${location}`);
    return [{ name: 'Lead A', email: 'a@example.com' }, { name: 'Lead B', email: 'b@example.com' }];
  });

  // 2. Enrich Leads
  const enrichedLeads = await step('enrich-leads', async () => {
    return rawLeads.map(l => ({ ...l, industry: 'Tech', company: 'Example Inc' }));
  });

  // 3. Score Leads with AI
  const scoredLeads = await step('score-leads', async () => {
    return enrichedLeads.map(l => ({ ...l, score: Math.floor(Math.random() * 100) }));
  });

  // 4. Bulk Add to CRM
  const savedLeads = await step('bulk-add-crm', async () => {
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
  });

  // 5. Notify Founder
  await step('notify-founder', async () => {
    console.log(`Found ${savedLeads.length} new leads for tenant ${tenantId}`);
  });

  // 6. Start Nurture for high scorers
  for (const lead of savedLeads) {
    if (lead.metadata?.score > 50) {
      await start(leadNurtureWorkflow, { leadId: lead.id, tenantId });
    }
  }
});
