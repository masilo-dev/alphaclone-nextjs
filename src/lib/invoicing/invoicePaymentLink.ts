import crypto from 'crypto';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export type InvoicePaymentLinkResult = {
  payment_link: string | null;
  stripe_connected: boolean;
  public_token?: string;
};

/**
 * When Stripe Connect is active, mark invoice public and set a durable client pay URL.
 * Checkout session is created on-demand when the client opens the link and clicks Pay.
 */
export async function ensureInvoicePaymentLink(options: {
  tenantId: string;
  invoiceId: string;
}): Promise<InvoicePaymentLinkResult> {
  const admin = createSupabaseAdminClient();

  const { data: tenant } = await admin
    .from('tenants')
    .select('stripe_connect_id, stripe_connect_onboarded, name')
    .eq('id', options.tenantId)
    .maybeSingle();

  const stripeConnected = Boolean(
    tenant?.stripe_connect_onboarded && tenant?.stripe_connect_id
  );

  if (!stripeConnected) {
    return { payment_link: null, stripe_connected: false };
  }

  const { data: invoice } = await admin
    .from('business_invoices')
    .select('id, payment_link, metadata, is_public')
    .eq('id', options.invoiceId)
    .eq('tenant_id', options.tenantId)
    .maybeSingle();

  if (!invoice) {
    return { payment_link: null, stripe_connected: true };
  }

  const existingMeta = (invoice.metadata || {}) as Record<string, unknown>;
  const publicToken =
    typeof existingMeta.public_token === 'string' && existingMeta.public_token.trim()
      ? existingMeta.public_token.trim()
      : crypto.randomBytes(24).toString('hex');

  const origin = (process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(
    /\/$/,
    ''
  );
  const paymentLink = `${origin}/invoice/${options.invoiceId}?token=${publicToken}`;

  if (invoice.payment_link === paymentLink && invoice.is_public) {
    return {
      payment_link: paymentLink,
      stripe_connected: true,
      public_token: publicToken,
    };
  }

  await admin
    .from('business_invoices')
    .update({
      payment_link: paymentLink,
      is_public: true,
      metadata: {
        ...existingMeta,
        public_token: publicToken,
        payment_link_enabled: true,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', options.invoiceId)
    .eq('tenant_id', options.tenantId);

  return {
    payment_link: paymentLink,
    stripe_connected: true,
    public_token: publicToken,
  };
}
