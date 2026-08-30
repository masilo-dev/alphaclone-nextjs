import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type EmailIntegrationDefaults = {
  provider?: 'zoho' | 'gmail' | 'brevo' | 'sendgrid' | 'resend' | 'outlook' | 'smtp';
  senderEmail?: string;
  integrationId?: string;
};

export type SocialPublishDefaults = {
  identity_id?: string;
  platform?: 'facebook' | 'linkedin';
  identity_type?: 'facebook_page' | 'linkedin_person' | 'linkedin_organization';
  facebook_page_id?: string;
  linkedin_organization_id?: string;
  linkedin_member_id?: string;
};

/** Pick the tenant's default outbound email provider when the model omits one. */
export async function resolveEmailIntegrationDefaults(
  tenantId: string
): Promise<EmailIntegrationDefaults> {
  const supabase = createSupabaseAdminClient();
  const [integrationsRes, sendersRes] = await Promise.all([
    supabase
      .from('integrations')
      .select('id, provider, type, status, is_active')
      .eq('tenant_id', tenantId)
      .in('provider', ['zoho', 'gmail', 'brevo', 'sendgrid', 'resend', 'outlook', 'smtp']),
    supabase
      .from('email_sender_addresses')
      .select('id, provider, email_address, display_name, is_default, is_verified')
      .eq('tenant_id', tenantId),
  ]);

  const integrations = (integrationsRes.data || []).filter(
    (row) => row.is_active !== false && String(row.status || 'connected') !== 'disconnected'
  );
  const senders = (sendersRes.data || []).filter((row) => row.is_verified !== false);
  const defaultSender =
    senders.find((row) => row.is_default) || senders[0] || null;
  const integration =
    (defaultSender
      ? integrations.find(
          (row) =>
            String(row.provider || row.type || '').toLowerCase() ===
            String(defaultSender.provider || '').toLowerCase()
        )
      : null) ||
    integrations[0] ||
    null;

  const provider = String(
    integration?.provider || integration?.type || defaultSender?.provider || ''
  ).toLowerCase();

  const normalizedProvider = [
    'zoho',
    'gmail',
    'brevo',
    'sendgrid',
    'resend',
    'outlook',
    'smtp',
  ].includes(provider)
    ? (provider as EmailIntegrationDefaults['provider'])
    : undefined;

  return {
    provider: normalizedProvider,
    senderEmail: defaultSender?.email_address || undefined,
    integrationId: integration?.id || undefined,
  };
}

/** When exactly one publishable identity exists, use it automatically. */
export async function resolveSocialPublishDefaults(
  tenantId: string,
  platformHint?: string
): Promise<SocialPublishDefaults> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('social_identities')
    .select(
      'identity_id, provider, identity_type, display_name, can_publish, is_active, metadata'
    )
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  const publishable = (data || []).filter((row) => row.can_publish);
  const platform = String(platformHint || '').toLowerCase();
  const filtered = platform
    ? publishable.filter((row) => String(row.provider || '').toLowerCase() === platform)
    : publishable;

  const candidates = filtered.length ? filtered : publishable;
  if (candidates.length !== 1) {
    return {};
  }

  const identity = candidates[0];
  const provider = String(identity.provider || 'facebook').toLowerCase();
  const identityType = String(identity.identity_type || '');
  const meta = (identity.metadata || {}) as Record<string, unknown>;

  return {
    identity_id: identity.identity_id,
    platform: provider === 'linkedin' ? 'linkedin' : 'facebook',
    identity_type:
      identityType === 'linkedin_organization' ||
      identityType === 'linkedin_person' ||
      identityType === 'facebook_page'
        ? identityType
        : provider === 'linkedin'
          ? meta.organization_id
            ? 'linkedin_organization'
            : 'linkedin_person'
          : 'facebook_page',
    facebook_page_id:
      provider === 'facebook'
        ? String(meta.page_id || identity.identity_id || '')
        : undefined,
    linkedin_organization_id:
      provider === 'linkedin' && (identityType === 'linkedin_organization' || meta.organization_id)
        ? String(meta.organization_id || identity.identity_id || '')
        : undefined,
    linkedin_member_id:
      provider === 'linkedin' && identityType === 'linkedin_person'
        ? String(meta.member_id || identity.identity_id || '')
        : undefined,
  };
}
