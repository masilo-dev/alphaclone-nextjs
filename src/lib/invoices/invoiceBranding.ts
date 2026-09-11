import { extractTenantBranding } from '@/lib/tenantBranding';

const PDF_SENDER_NAME_MAX = 36;

export interface InvoiceBrandingInput {
  senderName?: string | null;
}

export interface BusinessBrandingSettings {
  trading_name?: string | null;
  business_name?: string | null;
}

export function resolveInvoiceSenderName(
  invoice: InvoiceBrandingInput,
  tenant?: { name?: string | null; legal_name?: string | null; settings?: unknown } | null,
  businessSettings?: BusinessBrandingSettings | null
): string {
  const branding = extractTenantBranding(tenant);
  const candidates = [
    invoice.senderName,
    businessSettings?.trading_name,
    branding.name,
    businessSettings?.business_name,
    tenant?.legal_name,
    tenant?.name,
    'Your Business',
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  const chosen = candidates[0] || 'Your Business';
  if (chosen.length <= PDF_SENDER_NAME_MAX) return chosen;

  const shorter = [businessSettings?.trading_name, branding.name]
    .map((value) => String(value || '').trim())
    .find((value) => value.length > 0 && value.length <= PDF_SENDER_NAME_MAX);

  if (shorter) return shorter;
  return `${chosen.slice(0, PDF_SENDER_NAME_MAX - 1)}…`;
}
