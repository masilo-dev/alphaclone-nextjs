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
  legal_name?: string | null;
  business_settings?: unknown;
  business_address?: string | null;
  logo_url?: string | null;
  brand_color_primary?: string | null;
  settings?: unknown;
};

export function tenantBrandingFromRecord(tenant: TenantLike | null | undefined) {
  const base = extractTenantBranding(tenant);
  return {
    ...base,
    logoUrl: base.logoUrl,
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
    total: Number(quote.total_amount ?? subtotal),
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
  const subtotal = Number(invoice.subtotal ?? lineItems.reduce((s, r) => s + r.amount, 0));
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
    total: Number(invoice.total ?? subtotal + tax),
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
  if (looksLikeHtml) return [{ heading: 'Agreement', body: raw }];
  const source = raw;
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
  // Preserve all legacy clauses and embedded evidence; normalization is presentation-only.
  const sections = parseContractContentToSections(content);
  const paymentAmount = Number(contract.payment_amount ?? meta.payment_amount ?? 0);

  const signers: NonNullable<RenderDocumentInput['signers']> = [];
  const explicitParties = (contract.contract_parties || contract.parties || meta.parties || meta.signers) as Array<Record<string, unknown>> | undefined;

  const providerSigned = Boolean(contract.admin_signature || contract.admin_signed_at);
  const providerSigner: NonNullable<RenderDocumentInput['signers']>[number] = {
      role: 'Service Provider',
      name: String(meta.provider_signatory_name || tenantBrandingFromRecord(tenant).legalName || tenantBrandingFromRecord(tenant).name),
      title: String(meta.provider_signatory_title || 'Authorized Representative'),
      email: String(meta.provider_email || ''),
      signed: providerSigned,
      signatureUrl: contract.admin_signature ? String(contract.admin_signature) : undefined,
      date: contract.admin_signed_at ? new Date(String(contract.admin_signed_at)).toISOString() : undefined,
  };

  if (Array.isArray(explicitParties) && explicitParties.length > 0) {
    for (const party of explicitParties) {
      const partySnapshot = (party.party_snapshot || {}) as Record<string, unknown>;
      const rawRole = String(party.signer_role || party.role || 'Signatory');
      const name = String(partySnapshot.name || party.name || party.signer_name || 'Authorized Signatory');
      const email = String(partySnapshot.email || party.email || party.signer_email || '');
      const title = String(partySnapshot.title || party.title || party.signer_title || '');
      const roleGroup = /client/i.test(rawRole) ? /client/i : /provider|admin|owner/i.test(rawRole) ? /provider|admin|owner/i : /$a/;
      const uniqueRole = explicitParties.filter(p => roleGroup.test(String(p.signer_role || p.role || ''))).length === 1;
      const roleDate = /client/i.test(rawRole) ? contract.client_signed_at : /provider|admin|owner/i.test(rawRole) ? contract.admin_signed_at : undefined;
      const roleEvidence = /client/i.test(rawRole) ? contract.client_signature : /provider|admin|owner/i.test(rawRole) ? contract.admin_signature : undefined;
      const signed = party.signature_status === 'signed' || Boolean(uniqueRole && roleDate && roleEvidence);
      const signatureUrl = party.signature_url
        ? String(party.signature_url)
        : signed && uniqueRole
          ? String(/client/i.test(rawRole) ? (contract.client_signature || '') : /provider|admin|owner/i.test(rawRole) ? (contract.admin_signature || '') : '')
          : undefined;
      const signedAt = party.signed_at || (uniqueRole ? roleDate : undefined);
      const date = signedAt ? new Date(String(signedAt)).toISOString() : undefined;

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
    if (providerSigned && !explicitParties.some(p => /provider|admin|owner|supplier/i.test(String(p.signer_role || p.role || '')))) {
      signers.push(providerSigner);
    }
  } else {
    signers.push(providerSigner);

    const clientSigned = Boolean(contract.client_signature || contract.client_signed_at);
    signers.push({
      role: 'Client',
      name: client?.name || String(meta.client_signatory_name || meta.client_name || contract.client_name || 'Client Signatory'),
      title: String(meta.client_signatory_title || 'Authorized Signatory'),
      email: client?.email || String(meta.client_email || contract.client_email || ''),
      signed: clientSigned,
      signatureUrl: contract.client_signature ? String(contract.client_signature) : undefined,
      date: contract.client_signed_at ? new Date(String(contract.client_signed_at)).toISOString() : undefined,
    });
  }

  const contentHash = String(meta.content_hash || meta.contentHash || '');
  const tamperSeal = String(meta.tamper_seal || meta.tamperSeal || '');
  const signingTimes = [contract.client_signed_at, contract.admin_signed_at, meta.signed_at]
    .filter(Boolean).map(value => Date.parse(String(value))).filter(Number.isFinite);
  const completedAt = signers.length > 0 && signers.every(s => s.signed) && signingTimes.length
    ? new Date(Math.max(...signingTimes)).toISOString()
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
