import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { syncSuppressionCleanup } from '@/lib/email/suppression';
import { updatePublicEmailPreferences } from '@/lib/email/emailPreferences';

export async function isUnsubscribed(email: string, tenantId: string): Promise<boolean> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return false;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('email_suppressions')
    .select('id')
    .eq('tenant_id', normalizedTenantId)
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error('[email/unsubscribe] isUnsubscribed lookup failed:', error);
    return false;
  }

  return Boolean(data?.id);
}

export async function addUnsubscribe(
  email: string,
  tenantId: string,
  options?: {
    category?: string;
    source?: string;
    sourceCampaignId?: string;
    tokenId?: string;
    ipAddress?: string;
    userAgent?: string;
    globalMarketing?: boolean;
  },
): Promise<void> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return;

  await syncSuppressionCleanup({
    tenantId: normalizedTenantId,
    email: normalizedEmail,
    reason: 'unsubscribe',
    provider: options?.source || 'unsubscribe_link',
    metadata: {
      category: options?.category || null,
      source_campaign_id: options?.sourceCampaignId || null,
      token_id: options?.tokenId || null,
    },
  });

  await updatePublicEmailPreferences(normalizedTenantId, normalizedEmail, {
    unsubscribe_all_marketing: options?.globalMarketing !== false,
    marketing: false,
    outreach: false,
    newsletter: false,
  });

  try {
    const admin = createSupabaseAdminClient();
    await admin.from('email_unsubscribe_audit').insert({
      tenant_id: normalizedTenantId,
      email: normalizedEmail,
      category: options?.category || null,
      source: options?.source || 'unsubscribe_link',
      source_campaign_id: options?.sourceCampaignId || null,
      token_id: options?.tokenId || null,
      ip_address: options?.ipAddress || null,
      user_agent: options?.userAgent || null,
      status: 'unsubscribed',
    });
  } catch (err) {
    console.error('[email/unsubscribe] audit insert failed:', err);
  }
}

export async function recordResubscribe(
  email: string,
  tenantId: string,
  options?: { category?: string; source?: string },
): Promise<void> {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedTenantId = String(tenantId || '').trim();
  if (!normalizedEmail || !normalizedTenantId) return;

  const admin = createSupabaseAdminClient();
  await admin.from('email_suppressions').delete()
    .eq('tenant_id', normalizedTenantId)
    .eq('email', normalizedEmail)
    .eq('reason', 'unsubscribe');

  await admin.from('outreach_suppressions').delete()
    .eq('tenant_id', normalizedTenantId)
    .eq('channel', 'email')
    .eq('normalized_recipient', normalizedEmail)
    .eq('reason', 'unsubscribe');

  await updatePublicEmailPreferences(normalizedTenantId, normalizedEmail, {
    marketing: true,
    outreach: true,
    newsletter: true,
  });

  await admin.from('email_unsubscribe_audit').insert({
    tenant_id: normalizedTenantId,
    email: normalizedEmail,
    category: options?.category || null,
    source: options?.source || 'preference_center',
    status: 'resubscribed',
  });
}
