import type { SupabaseClient } from '@supabase/supabase-js';

export type RecordInvoicePaymentInput = {
  tenantId: string;
  invoiceId: string;
  amount: number;
  idempotencyKey: string;
  source?: string;
  externalReference?: string | null;
  actorUserId?: string | null;
};

export async function recordInvoicePaymentServer(
  admin: SupabaseClient,
  input: RecordInvoicePaymentInput
) {
  const { data, error } = await admin.rpc('record_business_invoice_payment', {
    p_tenant_id: input.tenantId,
    p_invoice_id: input.invoiceId,
    p_amount: input.amount,
    p_idempotency_key: input.idempotencyKey,
    p_source: input.source || 'manual',
    p_external_reference: input.externalReference ?? null,
    p_actor_user_id: input.actorUserId ?? null,
  });

  if (error) throw error;
  const invoice = Array.isArray(data) ? data[0] : data;
  return invoice;
}
