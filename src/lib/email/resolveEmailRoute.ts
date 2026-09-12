import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import {
  capabilitiesFor,
  resolveSendRoute,
  toUnifiedEmailProvider,
  type ConnectedEmailAccount,
  type EmailPurpose,
  type SenderIdentity,
  type UnifiedEmailProvider,
  UnifiedEmailDomainError,
} from '@/lib/email/unifiedEmailDomain';

export type EmailRoutingMode = 'explicit' | 'automatic' | 'balanced';

export type ResolvedEmailRoute = {
  provider: UnifiedEmailProvider;
  providerAccountId: string;
  senderIdentityId: string;
  senderEmail: string;
  capabilities: ReturnType<typeof capabilitiesFor>;
  remainingQuota: number | null;
  routingReason: string;
  requestedProvider: UnifiedEmailProvider | null;
};

function asPurpose(value: string): EmailPurpose {
  const known: EmailPurpose[] = ['personal', 'crm', 'transactional', 'marketing', 'invoice', 'contract', 'project', 'calendar', 'automation'];
  if (!known.includes(value as EmailPurpose)) throw new UnifiedEmailDomainError('PURPOSE_NOT_ALLOWED', `Unsupported email purpose: ${value}`);
  return value as EmailPurpose;
}

function quotaRemaining(settings: Record<string, unknown>, sentToday: number): number | null {
  const limit = Number(settings.daily_send_limit ?? settings.dailyLimit ?? 0);
  return Number.isFinite(limit) && limit > 0 ? Math.max(0, limit - sentToday) : null;
}

/**
 * Tenant-scoped routing control plane. It deliberately resolves database IDs,
 * not credentials; adapters retrieve encrypted credentials only at execution.
 */
export async function resolveEmailRoute(input: {
  tenantId: string;
  purpose: string;
  senderIdentityId?: string;
  explicitProvider?: string;
  explicitProviderAccountId?: string;
  mode?: EmailRoutingMode;
  requireCampaignFanOut?: boolean;
}): Promise<ResolvedEmailRoute> {
  const admin = createSupabaseAdminClient();
  const purpose = asPurpose(input.purpose);
  const mode = input.mode || (input.explicitProvider || input.explicitProviderAccountId ? 'explicit' : 'automatic');
  const requestedProvider = input.explicitProvider ? toUnifiedEmailProvider(input.explicitProvider) : null;

  const [{ data: accounts, error: accountsError }, { data: identities, error: identitiesError }, { data: defaults, error: defaultsError }] = await Promise.all([
    admin.from('email_provider_accounts').select('id, provider, connection_status, allowed_purposes, capabilities, settings, last_successful_send_at')
      .eq('tenant_id', input.tenantId).is('deleted_at', null),
    admin.from('email_sender_identities').select('id, provider_account_id, email_address, verification_status, can_send_as, allowed_purposes, is_default')
      .eq('tenant_id', input.tenantId).eq('is_active', true),
    admin.from('email_default_rules').select('purpose, provider_account_id, sender_identity_id, priority')
      .eq('tenant_id', input.tenantId),
  ]);
  if (accountsError || identitiesError || defaultsError) {
    throw new Error(`EMAIL_ROUTE_LOOKUP_FAILED: ${accountsError?.message || identitiesError?.message || defaultsError?.message}`);
  }

  const connectedAccounts: ConnectedEmailAccount[] = (accounts || []).map((row: any) => ({
    id: String(row.id), provider: toUnifiedEmailProvider(row.provider), connectionStatus: row.connection_status,
    allowedPurposes: Array.isArray(row.allowed_purposes) ? row.allowed_purposes : [], capabilities: row.capabilities || {},
  }));
  const senderIdentities: SenderIdentity[] = (identities || []).map((row: any) => ({
    id: String(row.id), providerAccountId: String(row.provider_account_id), emailAddress: String(row.email_address),
    verificationStatus: row.verification_status, canSendAs: Boolean(row.can_send_as),
    allowedPurposes: Array.isArray(row.allowed_purposes) ? row.allowed_purposes : [],
  }));
  const defaultRules = (defaults || []).map((row: any) => ({
    purpose: row.purpose as EmailPurpose, providerAccountId: String(row.provider_account_id),
    senderIdentityId: String(row.sender_identity_id), priority: Number(row.priority || 0),
  }));

  if (requestedProvider && mode === 'explicit') {
    const explicit = connectedAccounts.find((account) => account.provider === requestedProvider && (!input.explicitProviderAccountId || account.id === input.explicitProviderAccountId));
    if (!explicit) throw new UnifiedEmailDomainError('EMAIL_PROVIDER_UNAVAILABLE', `${requestedProvider} is not connected for this tenant`);
  }

  const eligible = connectedAccounts.filter((account) => {
    const caps = capabilitiesFor(account);
    return account.connectionStatus === 'connected' && account.allowedPurposes.includes(purpose) && caps.canSend &&
      (!input.requireCampaignFanOut || (caps.canSendMarketing && (caps.canSendBulk || caps.canFanOutBulk)));
  });
  const candidates = mode === 'balanced'
    ? [...eligible].sort((a, b) => Number((b as any).settings?.reputation_score || 0) - Number((a as any).settings?.reputation_score || 0))
    : eligible;

  let routeError: unknown;
  for (const account of candidates) {
    if (requestedProvider && account.provider !== requestedProvider) continue;
    try {
      const route = resolveSendRoute({
        purpose, accounts: [account], identities: senderIdentities, defaults: defaultRules,
        explicitAccountId: input.explicitProviderAccountId || account.id,
        explicitIdentityId: input.senderIdentityId,
        expectedProvider: requestedProvider || undefined,
        requireCampaignFanOut: input.requireCampaignFanOut,
      });
      const accountRow = (accounts || []).find((row: any) => String(row.id) === account.id) as any;
      const remaining = quotaRemaining(accountRow?.settings || {}, 0);
      if (remaining === 0) continue;
      return {
        provider: account.provider, providerAccountId: account.id, senderIdentityId: route.identity.id,
        senderEmail: route.identity.emailAddress, capabilities: capabilitiesFor(account), remainingQuota: remaining,
        requestedProvider, routingReason: mode === 'balanced' ? 'balanced_account_policy' : requestedProvider ? 'explicit_provider_request' : 'tenant_default_or_automatic',
      };
    } catch (error) { routeError = error; }
  }
  if (routeError instanceof UnifiedEmailDomainError) throw routeError;
  throw new UnifiedEmailDomainError('EMAIL_PROVIDER_UNAVAILABLE', 'No connected sender/provider route satisfies this delivery request');
}
