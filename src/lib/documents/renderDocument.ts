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
  const primary = branding.primaryBrandColor || branding.primaryColor || theme.primaryColor || '#0f172a';
  const accent = theme.accentColor;

  const lineItemsHtml =
    input.lineItems && input.lineItems.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:24px 0;" class="doc-table">
          <thead><tr style="border-bottom:2px solid #cbd5e1;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;">
            <th style="padding:10px 12px;text-align:left;">Description</th>
            <th style="padding:10px 12px;text-align:right;width:60px;">Qty</th>
            <th style="padding:10px 12px;text-align:right;width:100px;">Rate</th>
            <th style="padding:10px 12px;text-align:right;width:110px;">Amount</th>
          </tr></thead>
          <tbody>
            ${input.lineItems
              .map(
                (item) => `<tr style="border-bottom:1px solid #f1f5f9;page-break-inside:avoid;break-inside:avoid;">
              <td style="padding:12px;font-weight:500;color:#0f172a;">${escapeHtml(item.description)}</td>
              <td style="padding:12px;text-align:right;color:#334155;font-family:monospace;">${item.quantity}</td>
              <td style="padding:12px;text-align:right;color:#334155;font-family:monospace;">$${item.rate.toFixed(2)}</td>
              <td style="padding:12px;text-align:right;font-weight:600;color:#0f172a;font-family:monospace;">$${item.amount.toFixed(2)}</td>
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
        return `<section style="margin:28px 0;page-break-inside:avoid;break-inside:avoid;">
        <h2 style="color:${primary};font-size:15px;letter-spacing:0.04em;text-transform:uppercase;border-bottom:2px solid #e2e8f0;padding-bottom:8px;margin:0 0 14px;">${escapeHtml(s.heading)}</h2>
        <div style="color:#334155;line-height:1.75;">${bodyHtml}</div>
      </section>`;
      })
      .join('') || '';

  const isAgreement = ['contract'].includes(input.type);
  const showTotalBox = input.total != null && !isAgreement;

  const logoOrWordmarkHtml = branding.logoUrl
    ? `<div style="min-height:36px;display:flex;align-items:center;">
        <img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.name || '')}" style="max-height:36px;max-width:160px;width:auto;height:auto;object-fit:contain;object-position:left;" />
       </div>`
    : `<div style="min-height:36px;display:flex;align-items:center;font-size:18px;font-weight:700;letter-spacing:-0.01em;color:${primary};">
        ${escapeHtml(branding.name || 'Unconfigured Business')}
       </div>`;

  const headerHtml = `<div style="border-bottom:1px solid #e2e8f0;padding-bottom:24px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:flex-start;page-break-inside:avoid;break-inside:avoid;">
      <div style="max-width:55%;">
        ${logoOrWordmarkHtml}
        <div style="margin-top:8px;font-size:11px;color:#64748b;line-height:1.5;">
          ${branding.legalName && branding.legalName !== branding.name ? `<div style="font-weight:600;color:#334155;">${escapeHtml(branding.legalName)}</div>` : ''}
          ${branding.businessAddress ? `<div>${escapeHtml(branding.businessAddress).replace(/\n/g, '<br/>')}</div>` : ''}
          ${branding.taxNumber || branding.taxId ? `<div>Tax ID: ${escapeHtml(branding.taxNumber || branding.taxId || '')}</div>` : ''}
          ${branding.businessEmail || branding.supportEmail ? `<div>${escapeHtml(branding.businessEmail || branding.supportEmail || '')}</div>` : ''}
        </div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:26px;font-weight:800;letter-spacing:-0.02em;text-transform:uppercase;color:${primary};line-height:1.1;">${escapeHtml(input.title)}</div>
        ${input.documentNumber ? `<div style="font-family:monospace;font-size:13px;font-weight:600;color:#64748b;margin-top:4px;">#${escapeHtml(input.documentNumber)}</div>` : ''}
        ${input.status ? `<div style="margin-top:8px;"><span class="status-ribbon">${escapeHtml(input.status)}</span></div>` : ''}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.title)} ${input.documentNumber ? `#${escapeHtml(input.documentNumber)}` : ''}</title>
  <style>
    @page { size: A4; margin: 15mm 12mm; }
    @page { @bottom-center { content: "Page " counter(page) " of " counter(pages); font-size: 8pt; color: #64748b; } }
    body { font-family: ${theme.fontFamily}; margin: 0; padding: 0; color: #0f172a; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .content { padding: 32px 40px; max-width: 820px; margin: 0 auto; box-sizing: border-box; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; page-break-inside: avoid; break-inside: avoid; }
    .total-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 18px; text-align: right; margin-top: 24px; page-break-inside: avoid; break-inside: avoid; }
    .total-amount { font-size: 26px; font-weight: 800; color: ${primary}; font-family: monospace; }
    .status-ribbon { display: inline-block; padding: 3px 10px; border-radius: 9999px; border: 1px solid #cbd5e1; color: #334155; font-size: 11px; font-weight: 600; text-transform: uppercase; background: #f8fafc; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; page-break-inside: avoid; break-inside: avoid; }
    h2 { page-break-after: avoid; break-after: avoid; }
    .signature-block { page-break-inside: avoid; break-inside: avoid; }
    table thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    @media print {
      body { background: #fff !important; }
      .content { padding: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="content">
    ${headerHtml}
    <div class="meta">
      <div>
        <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#64748b;letter-spacing:0.05em;margin-bottom:6px;">Billed To / Recipient</div>
        <div style="font-weight:600;font-size:15px;color:#0f172a;">${escapeHtml(input.clientName || 'Client')}</div>
        ${input.clientEmail ? `<div style="font-size:12px;color:#475569;margin-top:2px;">${escapeHtml(input.clientEmail)}</div>` : ''}
      </div>
      <div style="text-align:right;font-size:12px;color:#334155;">
        ${input.issueDate ? `<div style="margin-bottom:4px;"><span style="color:#64748b;">Issue Date:</span> <strong style="color:#0f172a;">${escapeHtml(input.issueDate)}</strong></div>` : ''}
        ${input.dueDate ? `<div><span style="color:#64748b;">Due Date:</span> <strong style="color:#0f172a;">${escapeHtml(input.dueDate)}</strong></div>` : ''}
      </div>
    </div>
    ${sectionsHtml}
    ${isAgreement ? '' : lineItemsHtml}
    ${
      showTotalBox
        ? `<div class="total-box">
            <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">Total Due</div>
            <div class="total-amount">$${input.total!.toFixed(2)}</div>
            ${input.subtotal != null ? `<div style="color:#64748b;font-size:12px;margin-top:6px;">Subtotal: $${input.subtotal.toFixed(2)}${input.tax != null ? ` · Tax: $${input.tax.toFixed(2)}` : ''}</div>` : ''}
          </div>`
        : ''
    }
    ${input.notes ? `<div style="margin-top:28px;padding:14px;border:1px solid #e2e8f0;border-radius:4px;page-break-inside:avoid;break-inside:avoid;"><strong style="font-size:12px;color:#334155;">Notes</strong><p style="margin:6px 0 0;font-size:12px;color:#64748b;line-height:1.6;">${escapeHtml(input.notes)}</p></div>` : ''}
    ${input.paymentInstructions && !isAgreement ? `<div style="margin-top:16px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;page-break-inside:avoid;break-inside:avoid;"><strong style="font-size:12px;color:#334155;">Payment Details</strong><p style="margin:6px 0 0;font-size:12px;color:#475569;line-height:1.6;">${escapeHtml(input.paymentInstructions)}</p></div>` : ''}
    <div class="footer">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          ${escapeHtml(branding.name || 'Unconfigured Business')}
          ${branding.supportEmail || branding.businessEmail ? ` · ${escapeHtml(branding.supportEmail || branding.businessEmail || '')}` : ''}
          ${branding.taxNumber || branding.taxId ? ` · Tax: ${escapeHtml(branding.taxNumber || branding.taxId || '')}` : ''}
        </div>
      </div>
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
