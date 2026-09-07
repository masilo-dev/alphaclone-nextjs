/**
 * Inbound webhooks must resolve tenant from a trusted mapping (our row, OAuth
 * connection, Stripe customer map) — never from an unverified payload field.
 */
export function resolveVerifiedWebhookTenant(params: {
  mappedTenantId?: string | null;
  claimedTenantId?: string | null;
  provider: string;
}): string {
  const mapped = String(params.mappedTenantId || '').trim();
  if (!mapped) {
    throw new Error(`${params.provider} webhook tenant could not be resolved from a trusted mapping`);
  }
  const claimed = String(params.claimedTenantId || '').trim();
  if (claimed && claimed !== mapped) {
    throw new Error(`${params.provider} webhook tenant mismatch`);
  }
  return mapped;
}
