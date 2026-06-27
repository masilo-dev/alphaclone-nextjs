/** Delivery providers for 1:1 / transactional email (not bulk Zoho Campaigns). */
export type DeliveryEmailProvider =
  | 'auto'
  | 'zoho'
  | 'microsoft'
  | 'brevo'
  | 'sendgrid'
  | 'resend'
  | 'gmail';

export const DELIVERY_PROVIDER_LABELS: Record<DeliveryEmailProvider, string> = {
  auto: 'Auto (workspace default)',
  zoho: 'Zoho Mail',
  microsoft: 'Microsoft 365',
  brevo: 'Brevo',
  sendgrid: 'SendGrid',
  resend: 'Resend',
  gmail: 'Gmail SMTP',
};

export const NATIVE_CAMPAIGNS_PROVIDER = 'zoho' as const;

export function normalizeDeliveryProvider(value: unknown): DeliveryEmailProvider {
  const v = String(value || 'auto').trim().toLowerCase();
  if (v === 'microsoft365' || v === 'outlook') return 'microsoft';
  if (v === 'system_default') return 'auto';
  if (['auto', 'zoho', 'microsoft', 'brevo', 'sendgrid', 'resend', 'gmail'].includes(v)) {
    return v as DeliveryEmailProvider;
  }
  return 'auto';
}

export function resolveAutoProvider(
  connected: DeliveryEmailProvider[],
  tenantDefault?: string | null
): DeliveryEmailProvider {
  const preferred = normalizeDeliveryProvider(tenantDefault);
  if (preferred !== 'auto' && connected.includes(preferred)) return preferred;
  const order: DeliveryEmailProvider[] = ['zoho', 'microsoft', 'brevo', 'resend', 'sendgrid', 'gmail'];
  for (const p of order) {
    if (connected.includes(p)) return p;
  }
  return 'auto';
}
