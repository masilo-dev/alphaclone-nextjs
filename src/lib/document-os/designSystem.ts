/**
 * Corporate document design system — restrained, print-ready, consistent.
 * No decorative gradients, oversized headings, or generic browser-print styling.
 */

import type { DocumentBrandProfile, LogoPlacement, PageSize } from './types';

export const DOCUMENT_DESIGN_TOKENS = {
  margins: {
    A4: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    Letter: { top: '0.7in', right: '0.65in', bottom: '0.7in', left: '0.65in' },
  },
  typography: {
    h1: { size: '18pt', weight: 600, lineHeight: 1.25 },
    h2: { size: '12pt', weight: 600, lineHeight: 1.3 },
    h3: { size: '10.5pt', weight: 600, lineHeight: 1.35 },
    body: { size: '10pt', weight: 400, lineHeight: 1.55 },
    small: { size: '8.5pt', weight: 400, lineHeight: 1.4 },
    meta: { size: '9pt', weight: 400, lineHeight: 1.4 },
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '20px',
    xl: '28px',
    section: '22px',
  },
  logo: {
    maxHeight: '48px',
    maxWidth: '180px',
    clearSpace: '12px',
  },
  table: {
    headerBg: 'transparent',
    borderColor: '#cbd5e1',
    rowBorder: '#e2e8f0',
  },
  statusBadge: {
    fontSize: '8pt',
    padding: '2px 8px',
    borderRadius: '2px',
  },
} as const;

export function pageCssSize(pageSize: PageSize): string {
  return pageSize === 'Letter' ? 'Letter' : 'A4';
}

export function logoAlignment(placement: LogoPlacement): string {
  if (placement === 'center') return 'center';
  if (placement === 'right') return 'flex-end';
  return 'flex-start';
}

export function designSystemCss(brand: DocumentBrandProfile): string {
  const margins = DOCUMENT_DESIGN_TOKENS.margins[brand.page_size];
  return `
    @page {
      size: ${pageCssSize(brand.page_size)};
      margin: ${margins.top} ${margins.right} ${margins.bottom} ${margins.left};
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-family: ${brand.body_font};
        font-size: 8.5pt;
        color: #64748b;
      }
    }
    :root {
      --doc-primary: ${brand.primary_colour};
      --doc-secondary: ${brand.secondary_colour};
      --doc-accent: ${brand.accent_colour};
      --doc-text: #0f172a;
      --doc-muted: #475569;
      --doc-border: #cbd5e1;
      --doc-space-xs: ${DOCUMENT_DESIGN_TOKENS.spacing.xs};
      --doc-space-sm: ${DOCUMENT_DESIGN_TOKENS.spacing.sm};
      --doc-space-md: ${DOCUMENT_DESIGN_TOKENS.spacing.md};
      --doc-space-lg: ${DOCUMENT_DESIGN_TOKENS.spacing.lg};
      --doc-space-section: ${DOCUMENT_DESIGN_TOKENS.spacing.section};
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      color: var(--doc-text);
      background: #fff;
      font-family: ${brand.body_font};
      font-size: ${DOCUMENT_DESIGN_TOKENS.typography.body.size};
      line-height: ${DOCUMENT_DESIGN_TOKENS.typography.body.lineHeight};
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3 {
      font-family: ${brand.heading_font};
      color: var(--doc-primary);
      page-break-after: avoid;
      break-after: avoid-page;
    }
    h1 { font-size: ${DOCUMENT_DESIGN_TOKENS.typography.h1.size}; font-weight: ${DOCUMENT_DESIGN_TOKENS.typography.h1.weight}; margin: 0 0 var(--doc-space-md); }
    h2 { font-size: ${DOCUMENT_DESIGN_TOKENS.typography.h2.size}; font-weight: ${DOCUMENT_DESIGN_TOKENS.typography.h2.weight}; margin: var(--doc-space-section) 0 var(--doc-space-sm); border-bottom: 1px solid var(--doc-border); padding-bottom: 4px; }
    h3 { font-size: ${DOCUMENT_DESIGN_TOKENS.typography.h3.size}; font-weight: ${DOCUMENT_DESIGN_TOKENS.typography.h3.weight}; margin: var(--doc-space-md) 0 var(--doc-space-xs); }
    p { margin: 0 0 var(--doc-space-md); orphans: 3; widows: 3; }
    .doc-section { page-break-inside: avoid; break-inside: avoid-page; margin-bottom: var(--doc-space-section); }
    .doc-signature-block { page-break-inside: avoid; break-inside: avoid-page; margin-top: var(--doc-space-lg); }
    table.doc-table { width: 100%; border-collapse: collapse; margin: var(--doc-space-md) 0; font-size: 9.5pt; }
    table.doc-table thead { display: table-header-group; }
    table.doc-table th {
      text-align: left;
      border-bottom: 1.5px solid var(--doc-primary);
      padding: 6px 8px;
      font-weight: 600;
      color: var(--doc-primary);
    }
    table.doc-table td {
      border-bottom: 1px solid ${DOCUMENT_DESIGN_TOKENS.table.rowBorder};
      padding: 6px 8px;
      vertical-align: top;
    }
    .doc-status {
      display: inline-block;
      font-size: ${DOCUMENT_DESIGN_TOKENS.statusBadge.fontSize};
      padding: ${DOCUMENT_DESIGN_TOKENS.statusBadge.padding};
      border: 1px solid var(--doc-border);
      border-radius: ${DOCUMENT_DESIGN_TOKENS.statusBadge.borderRadius};
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--doc-secondary);
    }
    .doc-meta { font-size: ${DOCUMENT_DESIGN_TOKENS.typography.meta.size}; color: var(--doc-muted); }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--doc-space-lg);
      padding-bottom: var(--doc-space-md);
      border-bottom: 2px solid var(--doc-primary);
      margin-bottom: var(--doc-space-lg);
    }
    .doc-logo-wrap {
      display: flex;
      justify-content: ${logoAlignment(brand.logo_placement)};
      padding: ${DOCUMENT_DESIGN_TOKENS.logo.clearSpace};
      max-width: 50%;
    }
    .doc-logo {
      max-height: ${DOCUMENT_DESIGN_TOKENS.logo.maxHeight};
      max-width: ${DOCUMENT_DESIGN_TOKENS.logo.maxWidth};
      width: auto;
      height: auto;
      object-fit: contain;
      object-position: left center;
    }
    .doc-footer {
      margin-top: var(--doc-space-xl);
      padding-top: var(--doc-space-md);
      border-top: 1px solid var(--doc-border);
      font-size: ${DOCUMENT_DESIGN_TOKENS.typography.small.size};
      color: var(--doc-muted);
    }
    .doc-payment-summary {
      border: 1px solid var(--doc-border);
      padding: var(--doc-space-md);
      margin-top: var(--doc-space-lg);
    }
    .doc-confidential {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--doc-muted);
    }
    .doc-qr { width: 72px; height: 72px; }
  `;
}
