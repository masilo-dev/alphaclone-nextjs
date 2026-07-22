/**
 * Unified document rendering — HTML templates + jsPDF fallback.
 */

import type { TenantBranding } from '@/lib/tenantBranding';

export type DocumentType =
  | 'invoice'
  | 'quote'
  | 'proposal'
  | 'contract'
  | 'receipt'
  | 'statement'
  | 'credit_note';

export type DocumentThemeId =
  | 'executive'
  | 'modern'
  | 'luxury'
  | 'minimal'
  | 'corporate'
  | 'legal'
  | 'creative';

export interface DocumentTheme {
  id: DocumentThemeId;
  name: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  headerStyle: 'banner' | 'minimal' | 'cover';
  roundedCorners: boolean;
}

export const DOCUMENT_THEME_PRESETS: Record<DocumentThemeId, DocumentTheme> = {
  executive: {
    id: 'executive',
    name: 'Executive',
    primaryColor: '#0f172a',
    accentColor: '#14b8a6',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: false,
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    primaryColor: '#1e293b',
    accentColor: '#2dd4bf',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: true,
  },
  luxury: {
    id: 'luxury',
    name: 'Luxury',
    primaryColor: '#1a1a2e',
    accentColor: '#c9a962',
    fontFamily: 'Georgia, serif',
    headerStyle: 'cover',
    roundedCorners: false,
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    primaryColor: '#334155',
    accentColor: '#64748b',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: true,
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    primaryColor: '#1e3a5f',
    accentColor: '#2563eb',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: false,
  },
  legal: {
    id: 'legal',
    name: 'Legal',
    primaryColor: '#1c1917',
    accentColor: '#78716c',
    fontFamily: 'Georgia, serif',
    headerStyle: 'minimal',
    roundedCorners: false,
  },
  creative: {
    id: 'creative',
    name: 'Creative',
    primaryColor: '#312e81',
    accentColor: '#a855f7',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'cover',
    roundedCorners: true,
  },
};

export interface RenderDocumentInput {
  type: DocumentType;
  themeId?: DocumentThemeId;
  branding?: TenantBranding;
  title: string;
  documentNumber?: string;
  clientName?: string;
  clientEmail?: string;
  issueDate?: string;
  dueDate?: string;
  lineItems?: Array<{ description: string; quantity: number; rate: number; amount: number }>;
  subtotal?: number;
  tax?: number;
  total?: number;
  notes?: string;
  paymentInstructions?: string;
  sections?: Array<{ heading: string; body: string }>;
  status?: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderDocumentHtml(input: RenderDocumentInput): string {
  const theme = DOCUMENT_THEME_PRESETS[input.themeId || 'executive'];
  const branding = input.branding || { name: 'Your Business' };
  const primary = branding.primaryColor || theme.primaryColor;
  const accent = theme.accentColor;

  const lineItemsHtml =
    input.lineItems && input.lineItems.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:24px 0;">
          <thead><tr style="background:${primary};color:#fff;">
            <th style="padding:12px;text-align:left;">Description</th>
            <th style="padding:12px;text-align:right;">Qty</th>
            <th style="padding:12px;text-align:right;">Rate</th>
            <th style="padding:12px;text-align:right;">Amount</th>
          </tr></thead>
          <tbody>
            ${input.lineItems
              .map(
                (item) => `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px;">${escapeHtml(item.description)}</td>
              <td style="padding:12px;text-align:right;">${item.quantity}</td>
              <td style="padding:12px;text-align:right;">$${item.rate.toFixed(2)}</td>
              <td style="padding:12px;text-align:right;">$${item.amount.toFixed(2)}</td>
            </tr>`
              )
              .join('')}
          </tbody>
        </table>`
      : '';

  const sectionsHtml =
    input.sections
      ?.map(
        (s) => `<section style="margin:24px 0;">
        <h2 style="color:${primary};font-size:18px;margin-bottom:8px;">${escapeHtml(s.heading)}</h2>
        <p style="color:#475569;line-height:1.6;">${escapeHtml(s.body)}</p>
      </section>`
      )
      .join('') || '';

  const headerHtml =
    theme.headerStyle === 'cover'
      ? `<div style="background:linear-gradient(135deg,${primary},${accent});color:#fff;padding:48px 40px;text-align:center;">
          ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" style="max-height:60px;margin-bottom:16px;" />` : ''}
          <h1 style="font-size:32px;margin:0;">${escapeHtml(input.title)}</h1>
          ${input.documentNumber ? `<p style="opacity:0.9;margin-top:8px;">#${escapeHtml(input.documentNumber)}</p>` : ''}
        </div>`
      : `<div style="background:${primary};color:#fff;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" style="max-height:40px;margin-bottom:8px;" />` : `<strong style="font-size:20px;">${escapeHtml(branding.name || 'Your Business')}</strong>`}
          </div>
          <div style="text-align:right;">
            <div style="font-size:24px;font-weight:bold;">${escapeHtml(input.title)}</div>
            ${input.documentNumber ? `<div style="opacity:0.9;">#${escapeHtml(input.documentNumber)}</div>` : ''}
          </div>
        </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)} ${input.documentNumber ? `#${escapeHtml(input.documentNumber)}` : ''}</title>
  <style>
    body { font-family: ${theme.fontFamily}; margin: 0; padding: 0; color: #1e293b; background: #fff; }
    .content { padding: 40px; max-width: 800px; margin: 0 auto; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .total-box { background: ${accent}15; border: 2px solid ${accent}; border-radius: ${theme.roundedCorners ? '12px' : '0'}; padding: 24px; text-align: right; margin-top: 24px; }
    .total-amount { font-size: 36px; font-weight: bold; color: ${primary}; }
    .status-ribbon { display: inline-block; padding: 4px 12px; border-radius: 999px; background: ${accent}; color: #fff; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="content">
    <div class="meta">
      <div>
        <strong>Prepared for</strong><br/>
        ${escapeHtml(input.clientName || 'Client')}<br/>
        ${input.clientEmail ? escapeHtml(input.clientEmail) : ''}
      </div>
      <div style="text-align:right;">
        ${input.status ? `<span class="status-ribbon">${escapeHtml(input.status)}</span><br/><br/>` : ''}
        ${input.issueDate ? `<strong>Date:</strong> ${escapeHtml(input.issueDate)}<br/>` : ''}
        ${input.dueDate ? `<strong>Due:</strong> ${escapeHtml(input.dueDate)}<br/>` : ''}
      </div>
    </div>
    ${sectionsHtml}
    ${lineItemsHtml}
    ${
      input.total != null
        ? `<div class="total-box">
            <div style="color:#64748b;font-size:14px;">Total due</div>
            <div class="total-amount">$${input.total.toFixed(2)}</div>
            ${input.subtotal != null ? `<div style="color:#64748b;font-size:12px;margin-top:8px;">Subtotal: $${input.subtotal.toFixed(2)}${input.tax != null ? ` · Tax: $${input.tax.toFixed(2)}` : ''}</div>` : ''}
          </div>`
        : ''
    }
    ${input.notes ? `<div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;"><strong>Notes</strong><p style="margin:8px 0 0;">${escapeHtml(input.notes)}</p></div>` : ''}
    ${input.paymentInstructions ? `<div style="margin-top:16px;"><strong>Payment details</strong><p style="margin:8px 0 0;">${escapeHtml(input.paymentInstructions)}</p></div>` : ''}
    <div class="footer">
      ${escapeHtml(branding.name || 'Your Business')}
      ${branding.supportEmail ? ` · ${escapeHtml(branding.supportEmail)}` : ''}
    </div>
  </div>
</body>
</html>`;
}

/** Prefetch logo URL to base64 for jsPDF embedding. */
export async function prefetchLogoBase64(logoUrl: string): Promise<string | null> {
  if (!logoUrl || !logoUrl.startsWith('http')) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}
