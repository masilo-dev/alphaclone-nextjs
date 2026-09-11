import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { resolveTenantRole } from '@/lib/mcp/connector/permissions';
import { hasTool } from '@/lib/mcp/tool-registry';
import { resolveAllConnectedEmailProviders } from '@/lib/email/providerIntegrationResolver';

export type McpReadinessAction = 'all' | 'social_post' | 'email_send' | 'media_upload';

/** Canonical source of truth for tenant-scoped MCP write readiness. */
export async function resolveMcpActionReadiness(input: {
  tenantId: string;
  userId: string;
  action?: McpReadinessAction;
}) {
  const { tenantId, userId } = input;
  const supabase = createSupabaseAdminClient();
  const role = await resolveTenantRole(tenantId, userId);
  const canSocial = role.permissions.includes('social:publish');
  const canWriteSocial = role.permissions.includes('social:write');
  const canEmail = role.permissions.includes('sales:write') || role.permissions.includes('marketing:write');

  const [identitiesRes, senderRes, connectedProviders] = await Promise.all([
    supabase
      .from('social_identities')
      .select('identity_id, provider, identity_type, display_name, can_publish, can_upload_media, is_active')
      .eq('tenant_id', tenantId)
      .eq('is_active', true),
    supabase
      .from('email_sender_addresses')
      .select('id, provider, email_address, display_name, is_default, is_verified')
      .eq('tenant_id', tenantId),
    resolveAllConnectedEmailProviders({ tenantId, preferredUserId: userId }),
  ]);

  const queryFailures = [identitiesRes.error, senderRes.error]
    .filter(Boolean)
    .map((error) => error?.message || 'Readiness query failed');
  const identities = identitiesRes.data || [];
  const publishableIdentities = identities.filter((identity) => identity.can_publish);
  const uploadableIdentities = identities.filter((identity) => identity.can_upload_media);
  const identityCandidates = publishableIdentities.map((identity) => ({
    identity_id: identity.identity_id,
    provider: identity.provider,
    identity_type: identity.identity_type,
    display_name: identity.display_name,
    can_publish: identity.can_publish,
    can_upload_media: identity.can_upload_media,
  }));
  const identitiesByProvider = publishableIdentities.reduce<
    Record<string, typeof identityCandidates>
  >((acc, identity) => {
    const key = String(identity.provider || 'unknown');
    if (!acc[key]) acc[key] = [];
    acc[key].push({
      identity_id: identity.identity_id,
      provider: identity.provider,
      identity_type: identity.identity_type,
      display_name: identity.display_name,
      can_publish: identity.can_publish,
      can_upload_media: identity.can_upload_media,
    });
    return acc;
  }, {});
  const ambiguousProviders = Object.entries(identitiesByProvider)
    .filter(([, list]) => list.length > 1)
    .map(([provider]) => provider);
  const requiresIdentitySelection = ambiguousProviders.length > 0;
  const emailIntegrations = connectedProviders.map((provider) => ({
    provider: provider.provider,
    from_email: provider.fromEmail || null,
  }));
  const verifiedSenders = (senderRes.data || []).filter((sender) => sender.is_verified !== false);
  const tools = {
    upload_social_media: hasTool('upload_social_media'),
    publish_social_post: hasTool('publish_social_post'),
    get_social_identities: hasTool('get_social_identities'),
    send_email: hasTool('send_email'),
  };

  const socialMissing: string[] = [];
  if (queryFailures.length) socialMissing.push('Readiness state could not be verified');
  if (!tools.publish_social_post || !tools.get_social_identities) socialMissing.push('MCP social tools are not registered');
  if (!canSocial) socialMissing.push('Workspace role lacks social:publish permission');
  if (!publishableIdentities.length) socialMissing.push('No active publishable Facebook/LinkedIn identity is connected');

  const mediaMissing: string[] = [];
  if (queryFailures.length) mediaMissing.push('Readiness state could not be verified');
  if (!tools.upload_social_media) mediaMissing.push('upload_social_media is not registered');
  if (!canWriteSocial) mediaMissing.push('Workspace role lacks social:write permission');
  if (identities.length > 0 && !uploadableIdentities.length) mediaMissing.push('Connected social identities do not advertise media upload capability');

  const emailMissing: string[] = [];
  if (queryFailures.length) emailMissing.push('Readiness state could not be verified');
  if (!tools.send_email) emailMissing.push('send_email is not registered');
  if (!canEmail) emailMissing.push('Workspace role lacks sales:write or marketing:write permission');
  if (!emailIntegrations.length) emailMissing.push('No active email provider integration is connected');
  const hasSenderIdentity =
    verifiedSenders.length > 0 ||
    connectedProviders.some((provider) => Boolean(provider.fromEmail));
  if (!hasSenderIdentity) emailMissing.push('No verified/default sender address is configured');

  return {
    requested_action: input.action || 'all',
    workspace: { tenant_id: tenantId, user_id: userId, role: role.role },
    verified_at: new Date().toISOString(),
    verification_errors: queryFailures,
    tools,
    social_post: {
      executable: socialMissing.length === 0 && !requiresIdentitySelection,
      missing: socialMissing,
      requires_identity_selection: requiresIdentitySelection,
      ambiguous_providers: ambiguousProviders,
      identity_candidates: identityCandidates,
      recommended_tool: requiresIdentitySelection ? 'connected_accounts' : 'publish_social_post',
      auto_defaults:
        'When only one Facebook/LinkedIn identity exists, the server auto-selects it for publish_social_post.',
      setup_hint:
        requiresIdentitySelection
          ? 'Multiple publish destinations are connected — call connected_accounts or get_social_identities, then publish_social_post with identity_id (internal UUID) or identity_type.'
          : socialMissing.length > 0
            ? 'Connect Facebook or LinkedIn under Dashboard → Integrations, then call connected_accounts.'
            : 'Ready — call publish_social_post with caption/content (identity auto-selected when unambiguous).',
      identities: identityCandidates,
    },
    media_upload: {
      executable: mediaMissing.length === 0,
      missing: mediaMissing,
      accepted_sources: ['file', 'base64', 'source_url'],
      accepted_media_types: ['image', 'video', 'document'],
    },
    email_send: {
      executable: emailMissing.length === 0,
      missing: emailMissing,
      recommended_tool: 'send_email',
      auto_defaults:
        'Server auto-selects the connected email provider and generates idempotency_key when omitted.',
      setup_hint:
        emailMissing.length > 0
          ? 'Connect Zoho, Brevo, Outlook, or Gmail under Dashboard → Integrations, verify a sender address when required, then retry.'
          : 'Ready — call send_email with subject, to or recipient_name, and text/body.',
      providers: emailIntegrations.map((integration) => ({
        provider: integration.provider,
        from_email: integration.from_email,
      })),
      sender_addresses: verifiedSenders.map((sender) => ({
        sender_id: sender.id,
        provider: sender.provider,
        email_address: sender.email_address,
        display_name: sender.display_name,
        is_default: sender.is_default,
      })),
    },
  };
}
