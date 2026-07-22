import {
  DOCUMENT_THEME_PRESETS,
  type DocumentThemeId,
  type RenderDocumentInput,
  renderDocumentHtml,
} from '@/lib/documents/renderDocument';
import { htmlToPdfBuffer } from '@/lib/documents/htmlToPdfBuffer';
import { extractTenantBranding } from '@/lib/tenantBranding';

export function parseInvoiceNotesMetadata(notes: unknown): Record<string, unknown> {
  if (!notes || typeof notes !== 'string') return {};
  try {
    const match = notes.match(/---METADATA---([\s\S]*?)---METADATA---/);
    return match?.[1] ? JSON.parse(match[1]) : {};
  } catch {
    return {};
  }
}

export function mergeInvoiceNotesMetadata(
  notes: string | undefined,
  patch: Record<string, unknown>
): string {
  const merged = { ...parseInvoiceNotesMetadata(notes), ...patch };
  const cleaned = (notes || '').replace(/---METADATA---[\s\S]*?---METADATA---\s*/, '').trim();
  const block = `---METADATA---${JSON.stringify(merged)}---METADATA---`;
  return cleaned ? `${cleaned}\n\n${block}` : block;
}

export function resolveDocumentThemeId(
  metadata?: Record<string, unknown> | null
): DocumentThemeId {
  const raw = metadata?.document_theme ?? metadata?.documentTheme;
  if (typeof raw === 'string' && raw in DOCUMENT_THEME_PRESETS) {
    return raw as DocumentThemeId;
  }
  return 'executive';
}

type TenantLike = {
  name?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  settings?: unknown;
};

export function tenantBrandingFromRecord(tenant: TenantLike | null | undefined) {
  const base = extractTenantBranding(tenant);
  return {
    ...base,
    logoUrl: tenant?.logo_url || base.logoUrl,
    primaryColor: tenant?.brand_color_primary || base.primaryColor,
  };
}

export function buildQuoteDocumentInput(
  quote: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined
): RenderDocumentInput {
  const meta = (quote.metadata || {}) as Record<string, unknown>;
  const lineItems = items.map((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.unit_price || 0);
    const amount = Number(item.line_total || qty * rate);
    return {
      description: String(item.product_name || item.description || 'Item'),
      quantity: qty,
      rate,
      amount,
    };
  });
  const subtotal = lineItems.reduce((sum, row) => sum + row.amount, 0);

  return {
    type: 'quote',
    themeId: resolveDocumentThemeId(meta),
    branding: tenantBrandingFromRecord(tenant),
    title: 'Quote',
    documentNumber: String(quote.quote_number || ''),
    clientName: String(quote.name || 'Client'),
    clientEmail: String(meta.client_email || ''),
    issueDate: quote.created_at
      ? new Date(String(quote.created_at)).toLocaleDateString()
      : undefined,
    dueDate: quote.valid_until ? new Date(String(quote.valid_until)).toLocaleDateString() : undefined,
    lineItems,
    subtotal,
    total: Number(quote.total_amount || subtotal),
    notes: quote.notes ? String(quote.notes) : undefined,
    status: quote.status ? String(quote.status) : undefined,
  };
}

export function buildInvoiceDocumentInput(
  invoice: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): RenderDocumentInput {
  const meta = {
    ...parseInvoiceNotesMetadata(invoice.notes),
    ...((invoice.metadata || {}) as Record<string, unknown>),
  };
  const lineItems = items.map((item) => {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate ?? item.unit_price ?? 0);
    const amount = Number(item.amount ?? item.line_total ?? qty * rate);
    return {
      description: String(item.description || 'Item'),
      quantity: qty,
      rate,
      amount,
    };
  });
  const subtotal = Number(invoice.subtotal || lineItems.reduce((s, r) => s + r.amount, 0));
  const tax = Number(invoice.tax ?? invoice.tax_amount ?? 0);

  return {
    type: 'invoice',
    themeId: resolveDocumentThemeId(meta),
    branding: tenantBrandingFromRecord(tenant),
    title: 'Invoice',
    documentNumber: String(invoice.invoice_number || ''),
    clientName: client?.name || String(invoice.client_name || 'Client'),
    clientEmail: client?.email,
    issueDate: invoice.issue_date
      ? new Date(String(invoice.issue_date)).toLocaleDateString()
      : invoice.created_at
        ? new Date(String(invoice.created_at)).toLocaleDateString()
        : undefined,
    dueDate: invoice.due_date ? new Date(String(invoice.due_date)).toLocaleDateString() : undefined,
    lineItems,
    subtotal,
    tax,
    total: Number(invoice.total || subtotal + tax),
    notes: invoice.notes ? String(invoice.notes) : undefined,
    status: invoice.status ? String(invoice.status) : undefined,
  };
}

export function renderThemedDocumentHtml(
  input: RenderDocumentInput
): string {
  return renderDocumentHtml(input);
}

export async function generateThemedInvoicePdfBuffer(
  invoice: Record<string, unknown>,
  items: Array<Record<string, unknown>>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): Promise<Buffer> {
  const html = renderDocumentHtml(buildInvoiceDocumentInput(invoice, items, tenant, client));
  return htmlToPdfBuffer(html);
}
