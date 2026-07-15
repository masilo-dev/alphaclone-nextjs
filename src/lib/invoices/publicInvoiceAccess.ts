import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppUrls } from '@/lib/urls';

export function buildPublicInvoiceUrl(
  invoiceId: string,
  publicToken: string,
  origin?: string
): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com').replace(/\/+$/, '').replace(/^https:\/\/www\./, 'https://');
  return `${base}/invoice/${invoiceId}?token=${encodeURIComponent(publicToken)}`;
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
