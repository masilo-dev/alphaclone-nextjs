import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppUrls, buildValidatedPublicUrl } from '@/lib/urls';

export function buildPublicInvoiceUrl(
  invoiceId: string,
  publicToken: string,
  _origin?: string
): string {
  // Always use validated production URLs — ignore localhost/dev origins for customer links.
  return buildValidatedPublicUrl(
    `/invoice/${invoiceId}?token=${encodeURIComponent(publicToken)}`
  );
}

/** Ensure invoice is public and has a stable client payment token. Returns the token. */
export async function ensureInvoicePublicToken(
  admin: SupabaseClient,
  invoiceId: string,
  tenantId: string
): Promise<string> {
  const { data: invoice, error } = await admin
    .from('business_invoices')
    .select('id, metadata, is_public')
    .eq('id', invoiceId)
    .eq('tenant_id', tenantId)
    .single();

  if (error || !invoice) {
    throw new Error('Invoice not found');
  }

  const metadata = (invoice.metadata || {}) as Record<string, unknown>;
  const existing = String(metadata.public_token || '').trim();
  const publicToken = existing || crypto.randomUUID();

  if (!existing || !invoice.is_public) {
    await admin
      .from('business_invoices')
      .update({
        is_public: true,
        metadata: { ...metadata, public_token: publicToken },
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);
  }

  return publicToken;
}

export async function getPublicInvoicePaymentUrl(
  admin: SupabaseClient,
  invoiceId: string,
  tenantId: string,
  origin?: string
): Promise<string> {
  const token = await ensureInvoicePublicToken(admin, invoiceId, tenantId);
  return buildPublicInvoiceUrl(invoiceId, token, origin);
}

export { AppUrls };
