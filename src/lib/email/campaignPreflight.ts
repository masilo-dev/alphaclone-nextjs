import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveEmailRoute, type EmailRoutingMode, type ResolvedEmailRoute } from '@/lib/email/resolveEmailRoute';

export type CampaignPreflightResult = {
  ok: boolean;
  code?: string;
  recommendation?: string;
  campaign: Record<string, unknown> | null;
  recipientCounts: Record<string, number>;
  route?: ResolvedEmailRoute;
};

const TERMINAL = new Set(['sent', 'delivered', 'opened', 'clicked', 'failed', 'suppressed', 'skipped', 'bounced', 'unsubscribed']);

/** Shared campaign diagnose/send preflight. Durable campaign_recipients rows are authoritative. */
export async function preflightCampaignDelivery(input: {
  tenantId: string;
  campaignId: string;
  mode?: EmailRoutingMode;
}): Promise<CampaignPreflightResult> {
  const admin = createSupabaseAdminClient();
  const { data: campaign, error } = await admin.from('email_campaigns').select('*')
    .eq('tenant_id', input.tenantId).eq('id', input.campaignId).maybeSingle();
  if (error || !campaign) return { ok: false, code: 'CAMPAIGN_NOT_FOUND', recommendation: 'Select a campaign in this workspace.', campaign: null, recipientCounts: {} };
  const { data: rows, error: recipientsError } = await admin.from('campaign_recipients').select('status')
    .eq('tenant_id', input.tenantId).eq('campaign_id', input.campaignId);
  if (recipientsError) return { ok: false, code: 'CAMPAIGN_RECIPIENTS_UNAVAILABLE', recommendation: 'Retry after recipient storage is available.', campaign, recipientCounts: {} };
  const counts: Record<string, number> = {};
  for (const row of rows || []) counts[String(row.status || 'pending')] = (counts[String(row.status || 'pending')] || 0) + 1;
  const durableTotal = (rows || []).length;
  if (!durableTotal) return { ok: false, code: 'CAMPAIGN_NO_DURABLE_RECIPIENTS', recommendation: 'Resolve and save the audience before sending.', campaign, recipientCounts: counts };
  const storedTotal = Number((campaign as any).total_recipients || 0);
  if (storedTotal !== durableTotal) return { ok: false, code: 'CAMPAIGN_RECIPIENT_COUNT_MISMATCH', recommendation: 'Refresh the immutable audience snapshot before sending.', campaign, recipientCounts: counts };
  const counted = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (counted !== durableTotal) return { ok: false, code: 'CAMPAIGN_RECIPIENT_COUNT_MISMATCH', recommendation: 'Repair campaign recipient state before sending.', campaign, recipientCounts: counts };
  const metadata = ((campaign as any).metadata || {}) as Record<string, any>;
  const delivery = (metadata.deliverySettings || {}) as Record<string, any>;
  const selected = Array.isArray(delivery.selectedProviders) ? delivery.selectedProviders.filter(Boolean) : [];
  if (selected.length > 1 && delivery.routingMode === 'explicit') {
    return { ok: false, code: 'EMAIL_PROVIDER_MISMATCH', recommendation: 'Choose one provider for explicit routing or use balanced routing.', campaign, recipientCounts: counts };
  }
  try {
    const route = await resolveEmailRoute({
      tenantId: input.tenantId, purpose: 'marketing', mode: input.mode || delivery.routingMode || (selected.length ? 'explicit' : 'automatic'),
      explicitProvider: selected[0], explicitProviderAccountId: delivery.providerAccountId,
      senderIdentityId: delivery.senderIdentityId, requireCampaignFanOut: true,
    });
    return { ok: true, campaign, recipientCounts: counts, route };
  } catch (routeError: any) {
    return { ok: false, code: routeError?.code || 'EMAIL_PROVIDER_UNAVAILABLE', recommendation: routeError?.message || 'Connect a verified sender and provider.', campaign, recipientCounts: counts };
  }
}
