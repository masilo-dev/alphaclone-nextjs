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
  | 'creative'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'ruby'
  | 'mint'
  | 'midnight'
  | 'coral'
  | 'indigo'
  | 'gold'
  | 'rose'
  | 'arctic'
  | 'ember'
  | 'sage'
  | 'violet'
  | 'graphite'
  | 'lagoon';

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
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    primaryColor: '#0c4a6e',
    accentColor: '#38bdf8',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: true,
  },
  forest: {
    id: 'forest',
    name: 'Forest',
    primaryColor: '#14532d',
    accentColor: '#4ade80',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: true,
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset',
    primaryColor: '#7c2d12',
    accentColor: '#fb923c',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'cover',
    roundedCorners: true,
  },
  ruby: {
    id: 'ruby',
    name: 'Ruby',
    primaryColor: '#881337',
    accentColor: '#fb7185',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: false,
  },
  mint: {
    id: 'mint',
    name: 'Mint',
    primaryColor: '#134e4a',
    accentColor: '#5eead4',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: true,
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    primaryColor: '#020617',
    accentColor: '#818cf8',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'cover',
    roundedCorners: false,
  },
  coral: {
    id: 'coral',
    name: 'Coral',
    primaryColor: '#9a3412',
    accentColor: '#fdba74',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: true,
  },
  indigo: {
    id: 'indigo',
    name: 'Indigo',
    primaryColor: '#312e81',
    accentColor: '#6366f1',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: true,
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    primaryColor: '#422006',
    accentColor: '#fbbf24',
    fontFamily: 'Georgia, serif',
    headerStyle: 'cover',
    roundedCorners: false,
  },
  rose: {
    id: 'rose',
    name: 'Rose',
    primaryColor: '#4c0519',
    accentColor: '#f472b6',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
    roundedCorners: true,
  },
  arctic: {
    id: 'arctic',
    name: 'Arctic',
    primaryColor: '#0f172a',
    accentColor: '#e2e8f0',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: true,
  },
  ember: {
    id: 'ember',
    name: 'Ember',
    primaryColor: '#7f1d1d',
    accentColor: '#f97316',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'cover',
    roundedCorners: true,
  },
  sage: {
    id: 'sage',
    name: 'Sage',
    primaryColor: '#365314',
    accentColor: '#a3e635',
    fontFamily: 'Georgia, serif',
    headerStyle: 'banner',
    roundedCorners: false,
  },
  violet: {
    id: 'violet',
    name: 'Violet',
    primaryColor: '#4c1d95',
    accentColor: '#c084fc',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'cover',
    roundedCorners: true,
  },
  graphite: {
    id: 'graphite',
    name: 'Graphite',
    primaryColor: '#18181b',
    accentColor: '#a1a1aa',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'minimal',
    roundedCorners: false,
  },
  lagoon: {
    id: 'lagoon',
    name: 'Lagoon',
    primaryColor: '#155e75',
    accentColor: '#22d3ee',
    fontFamily: 'Inter, system-ui, sans-serif',
    headerStyle: 'banner',
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
      ?.map((s) => {
        const bodyLooksHtml = /<[a-z][\s\S]*>/i.test(s.body);
        const bodyHtml = bodyLooksHtml
          ? s.body
          : escapeHtml(s.body)
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              .split(/\n{2,}/)
              .map(
                (para) =>
                  `<p style="margin:0 0 12px;text-align:justify;color:#334155;line-height:1.75;">${para.replace(/\n/g, '<br/>')}</p>`
              )
              .join('');
        return `<section style="margin:28px 0;">
        <h2 style="color:${primary};font-size:16px;letter-spacing:0.04em;text-transform:uppercase;border-bottom:2px solid ${accent};padding-bottom:8px;margin:0 0 14px;">${escapeHtml(s.heading)}</h2>
        <div style="color:#334155;line-height:1.75;">${bodyHtml}</div>
      </section>`;
      })
      .join('') || '';

  const isAgreement = ['contract'].includes(input.type);
  const showTotalBox = input.total != null && !isAgreement;

  const headerHtml =
    theme.headerStyle === 'cover' && !isAgreement
      ? `<div style="background:${primary};color:#fff;padding:48px 40px;text-align:center;">
          ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.name || '')}" style="max-height:60px;max-width:200px;width:auto;height:auto;object-fit:contain;margin-bottom:16px;" />` : `<strong style="font-size:20px;">${escapeHtml(branding.name || 'Unconfigured Business')}</strong>`}
          <h1 style="font-size:28px;margin:0;">${escapeHtml(input.title)}</h1>
          ${input.documentNumber ? `<p style="opacity:0.9;margin-top:8px;">#${escapeHtml(input.documentNumber)}</p>` : ''}
        </div>`
      : `<div style="background:${primary};color:#fff;padding:24px 40px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.name || '')}" style="max-height:40px;max-width:180px;width:auto;height:auto;object-fit:contain;margin-bottom:8px;" />` : `<strong style="font-size:20px;">${escapeHtml(branding.name || 'Unconfigured Business')}</strong>`}
          </div>
          <div style="text-align:right;">
            <div style="font-size:22px;font-weight:bold;">${escapeHtml(input.title)}</div>
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
    @page { size: A4; margin: 18mm 16mm; }
    @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8.5pt; color: #64748b; } }
    body { font-family: ${theme.fontFamily}; margin: 0; padding: 0; color: #1e293b; background: #fff; }
    .content { padding: 40px; max-width: 800px; margin: 0 auto; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .total-box { background: #f8fafc; border: 1px solid ${accent}; border-radius: 0; padding: 20px; text-align: right; margin-top: 24px; }
    .total-amount { font-size: 28px; font-weight: bold; color: ${primary}; }
    .status-ribbon { display: inline-block; padding: 4px 12px; border-radius: 2px; border: 1px solid ${accent}; color: ${primary}; font-size: 12px; font-weight: 600; text-transform: uppercase; }
    .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
    h2 { page-break-after: avoid; }
    .signature-block { page-break-inside: avoid; }
    table thead { display: table-header-group; }
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
    ${isAgreement ? '' : lineItemsHtml}
    ${
      showTotalBox
        ? `<div class="total-box">
            <div style="color:#64748b;font-size:14px;">Total due</div>
            <div class="total-amount">$${input.total!.toFixed(2)}</div>
            ${input.subtotal != null ? `<div style="color:#64748b;font-size:12px;margin-top:8px;">Subtotal: $${input.subtotal.toFixed(2)}${input.tax != null ? ` · Tax: $${input.tax.toFixed(2)}` : ''}</div>` : ''}
          </div>`
        : ''
    }
    ${input.notes ? `<div style="margin-top:32px;padding:16px;border:1px solid #e2e8f0;"><strong>Notes</strong><p style="margin:8px 0 0;">${escapeHtml(input.notes)}</p></div>` : ''}
    ${input.paymentInstructions && !isAgreement ? `<div style="margin-top:16px;"><strong>Payment details</strong><p style="margin:8px 0 0;">${escapeHtml(input.paymentInstructions)}</p></div>` : ''}
    <div class="footer">
      ${escapeHtml(branding.name || 'Unconfigured Business')}
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
