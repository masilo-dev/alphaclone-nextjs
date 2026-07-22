import 'server-only';

import { htmlToPdfBuffer } from '@/lib/documents/htmlToPdfBuffer';
import {
  buildInvoiceDocumentInput,
  buildQuoteDocumentInput,
} from '@/lib/documents/documentBuilders';
import { renderDocumentHtml } from '@/lib/documents/renderDocument';

type TenantLike = {
  name?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  settings?: unknown;
};

export async function generateThemedInvoicePdfBuffer(
  invoice: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): Promise<Buffer> {
  const html = renderDocumentHtml(buildInvoiceDocumentInput(invoice, items, tenant, client));
  return htmlToPdfBuffer(html);
}

export async function generateThemedQuotePdfBuffer(
  quote: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined
): Promise<Buffer> {
  const html = renderDocumentHtml(buildQuoteDocumentInput(quote, items, tenant));
  return htmlToPdfBuffer(html);
}
