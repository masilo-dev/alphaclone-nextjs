import {
  DOCUMENT_THEME_PRESETS,
  type DocumentThemeId,
  type RenderDocumentInput,
  renderDocumentHtml,
} from '@/lib/documents/renderDocument';
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
    currency: String(quote.currency || meta.currency || 'EUR'),
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
    currency: String(invoice.currency || meta.currency || 'EUR'),
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

/** Split markdown/plain contract content into themed document sections. */
export function parseContractContentToSections(
  content: string
): Array<{ heading: string; body: string }> {
  const raw = String(content || '').trim();
  if (!raw) return [{ heading: 'Agreement', body: '' }];

  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(raw);
  const textOnly = looksLikeHtml ? raw.replace(/<[^>]+>/g, '\n') : raw;
  const hasMarkdownHeadings = /^#{1,3}\s+.+/m.test(textOnly);

  if (looksLikeHtml && !hasMarkdownHeadings) {
    return [{ heading: 'Agreement', body: raw }];
  }

  const source = looksLikeHtml ? textOnly : raw;
  const normalized = source.replace(/\r\n/g, '\n').trim();
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const matches = [...normalized.matchAll(headingRegex)];

  if (matches.length === 0) {
    return [{ heading: 'Agreement', body: normalized }];
  }

  const sections: Array<{ heading: string; body: string }> = [];
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const heading = String(match[2] || 'Section').trim();
    const start = (match.index || 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index || normalized.length : normalized.length;
    const body = normalized.slice(start, end).trim();
    sections.push({ heading, body: body || '—' });
  }

  // Include any preamble before the first heading
  const firstIdx = matches[0]?.index || 0;
  if (firstIdx > 0) {
    const preamble = normalized.slice(0, firstIdx).trim();
    if (preamble) {
      sections.unshift({ heading: 'Introduction', body: preamble });
    }
  }

  return sections.length > 0 ? sections : [{ heading: 'Agreement', body: normalized }];
}

export function buildContractDocumentInput(
  contract: Record<string, unknown>,
  tenant: TenantLike | null | undefined,
  client?: { name?: string; email?: string }
): RenderDocumentInput {
  const meta = (contract.metadata || {}) as Record<string, unknown>;
  const content = String(contract.content || contract.original_content || '');
  const sections = parseContractContentToSections(content);
  const paymentAmount = Number(contract.payment_amount ?? meta.payment_amount ?? 0);

  const signers: NonNullable<RenderDocumentInput['signers']> = [];
  const explicitParties = (contract.contract_parties || contract.parties || meta.parties || meta.signers) as Array<Record<string, unknown>> | undefined;

  if (Array.isArray(explicitParties) && explicitParties.length > 0) {
    for (const party of explicitParties) {
      const partySnapshot = (party.party_snapshot || {}) as Record<string, unknown>;
      const rawRole = String(party.signer_role || party.role || 'Signatory');
      const name = String(partySnapshot.name || party.name || party.signer_name || 'Authorized Signatory');
      const email = String(partySnapshot.email || party.email || party.signer_email || '');
      const title = String(partySnapshot.title || party.title || party.signer_title || '');
      const signed = party.signature_status === 'signed' || Boolean(party.signed);
      const signatureUrl = party.signature_url
        ? String(party.signature_url)
        : signed
          ? String(contract.client_signature || contract.admin_signature || '')
          : undefined;
      const date = party.signed_at ? new Date(String(party.signed_at)).toLocaleDateString() : undefined;

      signers.push({
        role: rawRole.charAt(0).toUpperCase() + rawRole.slice(1).replace(/_/g, ' '),
        name,
        email,
        title,
        signed,
        signatureUrl,
        date,
      });
    }
  } else {
    const providerSigned = Boolean(contract.admin_signature || contract.admin_signed_at);
    signers.push({
      role: 'Service Provider',
      name: String(meta.provider_signatory_name || tenant?.name || 'Service Provider'),
      title: String(meta.provider_signatory_title || 'Authorized Representative'),
      email: String(meta.provider_email || ''),
      signed: providerSigned,
      signatureUrl: contract.admin_signature ? String(contract.admin_signature) : undefined,
      date: contract.admin_signed_at ? new Date(String(contract.admin_signed_at)).toLocaleDateString() : undefined,
    });

    const clientSigned = Boolean(contract.client_signature || contract.client_signed_at);
    signers.push({
      role: 'Client',
      name: client?.name || String(meta.client_signatory_name || meta.client_name || contract.client_name || 'Client Signatory'),
      title: String(meta.client_signatory_title || 'Authorized Signatory'),
      email: client?.email || String(meta.client_email || contract.client_email || ''),
      signed: clientSigned,
      signatureUrl: contract.client_signature ? String(contract.client_signature) : undefined,
      date: contract.client_signed_at ? new Date(String(contract.client_signed_at)).toLocaleDateString() : undefined,
    });
  }

  const contentHash = String(meta.content_hash || meta.contentHash || '');
  const tamperSeal = String(meta.tamper_seal || meta.tamperSeal || '');
  const completedAt = contract.client_signed_at || contract.admin_signed_at || meta.signed_at
    ? new Date(String(contract.client_signed_at || contract.admin_signed_at || meta.signed_at)).toLocaleString()
    : undefined;

  const auditCertificate =
    contentHash || tamperSeal || (signers.some((s) => s.signed) && completedAt)
      ? {
          documentHash: contentHash || undefined,
          tamperSeal: tamperSeal || undefined,
          completedAt,
        }
      : undefined;

  return {
    type: 'contract',
    themeId: resolveDocumentThemeId(meta),
    branding: tenantBrandingFromRecord(tenant),
    title: String(contract.title || 'Service Agreement'),
    documentNumber: contract.id ? String(contract.id).slice(0, 8).toUpperCase() : undefined,
    clientName:
      client?.name ||
      String(meta.client_name || contract.client_name || 'Client'),
    clientEmail: client?.email || String(meta.client_email || contract.client_email || ''),
    currency: String(contract.currency || meta.currency || 'EUR'),
    issueDate: contract.created_at
      ? new Date(String(contract.created_at)).toLocaleDateString()
      : new Date().toLocaleDateString(),
    dueDate: contract.payment_due_date
      ? new Date(String(contract.payment_due_date)).toLocaleDateString()
      : undefined,
    sections,
    total: paymentAmount > 0 ? paymentAmount : undefined,
    notes: meta.notes ? String(meta.notes) : undefined,
    status: contract.status ? String(contract.status) : undefined,
    signers,
    auditCertificate,
  };
}

export function renderThemedDocumentHtml(
  input: RenderDocumentInput
): string {
  return renderDocumentHtml(input);
}
