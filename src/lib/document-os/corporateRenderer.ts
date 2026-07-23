/**
 * Professional corporate HTML renderer for the Document OS.
 * Suitable for email, desktop, mobile, and print. No invoice total box on agreements.
 */

import type {
  ContractClause,
  DocumentBrandProfile,
  DocumentType,
  InvoiceStructuredData,
} from './types';
import { brandDisplayName, brandSenderBlock } from './brandProfile';
import { designSystemCss } from './designSystem';
import { escapeHtml, renderLogoHtml } from './logoHandling';

export interface CorporateRenderInput {
  documentType: DocumentType;
  brand: DocumentBrandProfile;
  title: string;
  documentNumber: string;
  version: number;
  status: string;
  clientName?: string;
  clientEmail?: string;
  clientAddress?: string;
  issueDate?: string;
  dueDate?: string;
  expiresAt?: string;
  currency?: string;
  confidentialityLabel?: string;
  referenceNumber?: string;
  clauses?: ContractClause[];
  sections?: Array<{ heading: string; body: string }>;
  invoice?: InvoiceStructuredData;
  notes?: string;
  approvalHistory?: Array<{ actor: string; decision: string; at: string }>;
  signatureBlocks?: Array<{ role: string; name: string; email?: string; signed?: boolean }>;
  showSignatures?: boolean;
  qrCodeDataUrl?: string;
  metadata?: {
    documentId?: string;
    author?: string;
    subject?: string;
  };
}

function money(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function isAgreement(type: DocumentType): boolean {
  return ['contract', 'msa', 'sla', 'sow', 'nda', 'employment_agreement'].includes(type);
}

export function renderCorporateDocumentHtml(input: CorporateRenderInput): string {
  const brand = input.brand;
  const displayName = brandDisplayName(brand);
  const showInvoiceTotals = Boolean(input.invoice) && !isAgreement(input.documentType);

  const clausesHtml = (input.clauses || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(
      (c) => `<section class="doc-section" id="clause-${escapeHtml(c.clause_id)}">
        <h2>${escapeHtml(c.title)} <span class="doc-meta">(${escapeHtml(c.clause_key)} · v${escapeHtml(c.version)})</span></h2>
        <div>${escapeHtml(c.body).replace(/\n/g, '<br/>')}</div>
      </section>`
    )
    .join('');

  const sectionsHtml = (input.sections || [])
    .map(
      (s) => `<section class="doc-section">
        <h2>${escapeHtml(s.heading)}</h2>
        <div>${escapeHtml(s.body).replace(/\n/g, '<br/>')}</div>
      </section>`
    )
    .join('');

  let lineItemsHtml = '';
  let paymentSummaryHtml = '';
  if (showInvoiceTotals && input.invoice) {
    const inv = input.invoice;
    lineItemsHtml = `<table class="doc-table">
      <thead><tr>
        <th>Description</th><th style="text-align:right;">Qty</th>
        <th style="text-align:right;">Unit</th><th style="text-align:right;">Amount</th>
      </tr></thead>
      <tbody>
        ${inv.line_items
          .map(
            (li) => `<tr>
          <td>${escapeHtml(li.description)}</td>
          <td style="text-align:right;">${li.quantity}</td>
          <td style="text-align:right;">${money(li.unit_price, inv.currency)}</td>
          <td style="text-align:right;">${money(li.amount, inv.currency)}</td>
        </tr>`
          )
          .join('')}
      </tbody>
    </table>`;

    const isPaid = inv.payment_status === 'paid' && inv.balance_due === 0;
    paymentSummaryHtml = `<div class="doc-payment-summary">
      <div class="doc-meta">Payment summary</div>
      <div>Subtotal: ${money(inv.subtotal, inv.currency)}</div>
      ${inv.discount ? `<div>Discount: −${money(inv.discount, inv.currency)}</div>` : ''}
      ${inv.tax ? `<div>Tax: ${money(inv.tax, inv.currency)}</div>` : ''}
      <div style="font-weight:600;margin-top:6px;">Total: ${money(inv.total, inv.currency)}</div>
      <div>Amount paid: ${money(inv.amount_paid, inv.currency)}</div>
      <div style="font-weight:600;">Balance due: ${isPaid ? money(0, inv.currency) : money(inv.balance_due, inv.currency)}</div>
      ${isPaid ? `<div style="margin-top:8px;"><span class="doc-status">Paid</span></div>` : ''}
      ${
        isPaid && inv.payment_transactions?.length
          ? `<div style="margin-top:10px;font-size:9pt;">
              ${inv.payment_transactions
                .filter((t) => t.verified)
                .map(
                  (t) =>
                    `<div>Payment ${escapeHtml(t.reference)} · ${escapeHtml(t.method)} · ${money(t.amount, t.currency)} · ${escapeHtml(t.paid_at)}${t.provider ? ` · ${escapeHtml(t.provider)}` : ''}</div>`
                )
                .join('')}
            </div>`
          : ''
      }
    </div>`;
  }

  const signaturesHtml =
    input.showSignatures && input.signatureBlocks?.length
      ? `<div class="doc-signature-block">
          <h2>Signatures</h2>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
            ${input.signatureBlocks
              .map(
                (s) => `<div style="border-top:1px solid var(--doc-border);padding-top:10px;margin-top:28px;">
                <div class="doc-meta">${escapeHtml(s.role)}</div>
                <div style="min-height:36px;margin:8px 0;">${s.signed ? `<em>Signed electronically</em>` : ''}</div>
                <div>${escapeHtml(s.name)}</div>
                ${s.email ? `<div class="doc-meta">${escapeHtml(s.email)}</div>` : ''}
              </div>`
              )
              .join('')}
          </div>
        </div>`
      : '';

  const approvalHtml =
    input.approvalHistory?.length
      ? `<section class="doc-section">
          <h2>Approval history</h2>
          <table class="doc-table"><thead><tr><th>Actor</th><th>Decision</th><th>When</th></tr></thead>
          <tbody>
            ${input.approvalHistory
              .map(
                (a) =>
                  `<tr><td>${escapeHtml(a.actor)}</td><td>${escapeHtml(a.decision)}</td><td>${escapeHtml(a.at)}</td></tr>`
              )
              .join('')}
          </tbody></table>
        </section>`
      : '';

  const sender = escapeHtml(brandSenderBlock(brand)).replace(/\n/g, '<br/>');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)} ${escapeHtml(input.documentNumber)}</title>
  <meta name="author" content="${escapeHtml(input.metadata?.author || displayName)}" />
  <meta name="subject" content="${escapeHtml(input.metadata?.subject || input.title)}" />
  <meta name="document-id" content="${escapeHtml(input.metadata?.documentId || '')}" />
  <meta name="document-version" content="${input.version}" />
  <style>${designSystemCss(brand)}</style>
</head>
<body>
  <header class="doc-header">
    <div>
      ${renderLogoHtml(brand)}
      <div class="doc-meta" style="margin-top:8px;">${sender}</div>
    </div>
    <div style="text-align:right;">
      <h1 style="margin:0;">${escapeHtml(input.title)}</h1>
      <div class="doc-meta">
        ${escapeHtml(input.documentNumber)} · v${input.version}<br/>
        ${input.referenceNumber ? `Ref: ${escapeHtml(input.referenceNumber)}<br/>` : ''}
        <span class="doc-status">${escapeHtml(input.status)}</span>
        ${input.confidentialityLabel ? `<div class="doc-confidential" style="margin-top:6px;">${escapeHtml(input.confidentialityLabel)}</div>` : ''}
      </div>
    </div>
  </header>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
    <div>
      <div class="doc-meta">Prepared for</div>
      <div><strong>${escapeHtml(input.clientName || 'Client')}</strong></div>
      ${input.clientEmail ? `<div>${escapeHtml(input.clientEmail)}</div>` : ''}
      ${input.clientAddress ? `<div class="doc-meta">${escapeHtml(input.clientAddress)}</div>` : ''}
    </div>
    <div style="text-align:right;" class="doc-meta">
      ${input.issueDate ? `<div>Issue date: ${escapeHtml(input.issueDate)}</div>` : ''}
      ${input.dueDate ? `<div>Due date: ${escapeHtml(input.dueDate)}</div>` : ''}
      ${input.expiresAt ? `<div>Expires: ${escapeHtml(input.expiresAt)}</div>` : ''}
      ${input.currency ? `<div>Currency: ${escapeHtml(input.currency)}</div>` : ''}
    </div>
  </div>

  ${clausesHtml}
  ${sectionsHtml}
  ${lineItemsHtml}
  ${paymentSummaryHtml}
  ${input.notes ? `<section class="doc-section"><h2>Notes</h2><p>${escapeHtml(input.notes)}</p></section>` : ''}
  ${approvalHtml}
  ${signaturesHtml}
  ${
    input.qrCodeDataUrl
      ? `<div style="margin-top:16px;"><img class="doc-qr" src="${escapeHtml(input.qrCodeDataUrl)}" alt="Verification QR" /></div>`
      : ''
  }

  <footer class="doc-footer">
    ${escapeHtml(brand.legal_footer || `${displayName}${brand.registration_number ? ` · Reg. ${brand.registration_number}` : ''}${brand.tax_vat_number ? ` · Tax ${brand.tax_vat_number}` : ''}`)}
    <div class="doc-meta" style="margin-top:4px;">Document ID ${escapeHtml(input.metadata?.documentId || '')} · Version ${input.version}</div>
  </footer>
</body>
</html>`;
}

/** PDF metadata for title, author, subject, document ID, version. */
export function buildPdfMetadata(input: CorporateRenderInput) {
  return {
    title: `${input.title} ${input.documentNumber}`.trim(),
    author: input.metadata?.author || brandDisplayName(input.brand),
    subject: input.metadata?.subject || input.title,
    keywords: [
      input.documentType,
      input.documentNumber,
      `version:${input.version}`,
      input.metadata?.documentId ? `id:${input.metadata.documentId}` : '',
    ]
      .filter(Boolean)
      .join(', '),
  };
}
