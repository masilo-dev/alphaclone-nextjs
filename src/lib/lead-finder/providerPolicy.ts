import type { SupabaseClient } from '@supabase/supabase-js';

export async function loadLeadProviderPolicy(db: SupabaseClient, workspaceId: string) {
  const { data, error } = await db.from('lead_provider_settings').select('free_only,providers,auto_accept_enabled,auto_accept_threshold')
    .eq('workspace_id', workspaceId).maybeSingle();
  // Missing configuration cannot authorize a charge.
  return {
    freeOnly: error ? true : data?.free_only !== false,
    providers: (error ? {} : data?.providers || {}) as Record<string, boolean>,
    autoAccept: !error && data?.auto_accept_enabled === true,
    threshold: Math.max(0, Math.min(100, Number(data?.auto_accept_threshold ?? 72))),
  };
}

export function paidProviderAllowed(policy: { freeOnly: boolean; providers: Record<string, boolean> }, provider: string, credential?: string) {
  return !policy.freeOnly && policy.providers[provider] === true && Boolean(credential?.trim());
}
