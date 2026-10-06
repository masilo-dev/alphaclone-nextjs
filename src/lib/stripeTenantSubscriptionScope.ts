/** Tenant customer subscriptions have their own connected-account ownership boundary. */
export type TenantCustomerSubscriptionMapping = {
  tenantId: string;
  clientId: string;
  stripeAccountId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId: string;
};

/** Use before any future tenant customer subscription read, change or refund. */
export function tenantSubscriptionRequestOptions(mapping: TenantCustomerSubscriptionMapping, ownership: {
  tenantId: string; stripeAccountId: string;
}) {
  if (!mapping.stripeAccountId || mapping.tenantId !== ownership.tenantId || mapping.stripeAccountId !== ownership.stripeAccountId) {
    throw new Error('Tenant customer subscription ownership mismatch');
  }
  return { stripeAccount: mapping.stripeAccountId };
}
