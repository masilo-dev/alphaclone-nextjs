import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

/** Shared read model for Bonnie, dashboards, MCP, CRM and outreach planners.
 * It deliberately returns recommendations only; it never sends communication. */
export async function getTopLeadOpportunities(db: SupabaseClient, workspaceId: string, limit = 20) {
  const { data, error } = await db.rpc('get_top_lead_opportunities', {
    p_workspace_id: workspaceId,
    p_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) throw error;
  return data || [];
}
