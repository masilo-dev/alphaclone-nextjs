import 'server-only';

import { htmlToPdfBuffer } from '@/lib/documents/htmlToPdfBuffer';
import {
  buildContractDocumentInput,
  buildInvoiceDocumentInput,
  buildQuoteDocumentInput,
} from '@/lib/documents/documentBuilders';
import { renderDocumentHtml } from '@/lib/documents/renderDocument';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

type TenantLike = {
  id?: string;
  name?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  settings?: unknown;
};

async function inlineLogoForPdf(logoUrl?: string): Promise<string | undefined> {
  if (!logoUrl) return undefined;
  if (logoUrl.startsWith('data:')) return logoUrl;

  try {
    if (logoUrl.startsWith('/api/storage/')) {
      const match = logoUrl.match(/^\/api\/storage\/([^/]+)\/(.+)$/);
      if (match) {
        const bucket = match[1];
        const filePath = match[2];
        const supabase = createSupabaseAdminClient();
        const { data: blob, error } = await supabase.storage.from(bucket).download(filePath);
        if (!error && blob) {
          const buffer = Buffer.from(await blob.arrayBuffer());
          const ext = filePath.split('.').pop()?.toLowerCase();
          const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : 'image/png';
          return `data:${mime};base64,${buffer.toString('base64')}`;
        }
      }
    } else if (logoUrl.startsWith('http')) {
      const res = await fetch(logoUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get('content-type') || 'image/png';
        return `data:${mime};base64,${buffer.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('[themedDocumentPdf] failed to inline logo:', err);
  }
  return logoUrl;
}

async function resolveTenantWithBusinessSettings(
  tenantLike: TenantLike | null | undefined,
  tenantId?: string
): Promise<TenantLike | null | undefined> {
  const tid = (tenantLike as any)?.id || tenantId;
  if (!tid) return tenantLike;
  try {
    const supabase = createSupabaseAdminClient();
    const { data: bSettings } = await supabase
      .from('business_settings')
      .select('*')
      .eq('tenant_id', tid)
      .maybeSingle();

    if (bSettings) {
      return {
        ...(tenantLike || {}),
        business_settings: bSettings,
        name: (tenantLike as any)?.name || bSettings.business_name || bSettings.trading_name,
        logo_url: (tenantLike as any)?.logo_url || bSettings.logo_url,
        brand_color_primary: (tenantLike as any)?.brand_color_primary || bSettings.brand_color_primary,
      } as any;
    }
  } catch (err) {
    console.warn('[themedDocumentPdf] error querying business_settings:', err);
  }
  return tenantLike;
}

export async function generateThemedInvoicePdfBuffer(
  invoice: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): Promise<Buffer> {
  const resolvedTenant = await resolveTenantWithBusinessSettings(tenant, invoice.tenant_id as string);
  const input = buildInvoiceDocumentInput(invoice, items, resolvedTenant, client);
  if (input.branding?.logoUrl) {
    input.branding.logoUrl = await inlineLogoForPdf(input.branding.logoUrl);
    input.branding.companyLogo = input.branding.logoUrl;
  }
  const html = renderDocumentHtml(input);
  return htmlToPdfBuffer(html);
}

export async function generateThemedQuotePdfBuffer(
  quote: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined
): Promise<Buffer> {
  const resolvedTenant = await resolveTenantWithBusinessSettings(tenant, quote.tenant_id as string);
  const input = buildQuoteDocumentInput(quote, items, resolvedTenant);
  if (input.branding?.logoUrl) {
    input.branding.logoUrl = await inlineLogoForPdf(input.branding.logoUrl);
    input.branding.companyLogo = input.branding.logoUrl;
  }
  const html = renderDocumentHtml(input);
  return htmlToPdfBuffer(html);
}

export async function generateThemedContractPdfBuffer(
  contract: Record<string, unknown>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): Promise<Buffer> {
  const resolvedTenant = await resolveTenantWithBusinessSettings(tenant, contract.tenant_id as string);
  const input = buildContractDocumentInput(contract, resolvedTenant, client);
  if (input.branding?.logoUrl) {
    input.branding.logoUrl = await inlineLogoForPdf(input.branding.logoUrl);
    input.branding.companyLogo = input.branding.logoUrl;
  }
  const html = renderDocumentHtml(input);
  return htmlToPdfBuffer(html);
}
