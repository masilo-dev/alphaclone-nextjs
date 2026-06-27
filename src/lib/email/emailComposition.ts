import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';

const DEFAULT_SYSTEM_FOOTER_LINES: string[] = [
  `${COMPANY_LEGAL.legalName} — a Wyoming registered company`,
  formatLegalAddress(),
  'alphaclonesystems.com',
  'Unsubscribe: {{{unsubscribe_url}}}',
  'Privacy: https://alphaclonesystems.com/privacy-policy',
  'Terms: https://alphaclonesystems.com/terms-of-service',
  'If you received this email in error, please disregard and delete it.',
];

// Fallback unsubscribe page (used when no signed per-recipient link is available).
const FALLBACK_UNSUBSCRIBE_URL = 'https://alphaclonesystems.com/unsubscribe';

const HTML_FOOTER_STYLE = [
  'margin-top:24px',
  'padding-top:16px',
  'border-top:1px solid #e2e8f0',
  'font-family:Arial,Helvetica,sans-serif',
  'font-size:12px',
  'line-height:1.6',
  'color:#64748b',
  'text-align:center',
].join(';');

export function normalizeEmailSubject(subject: string): string {
  return String(subject || '').trim().replace(/\s+/g, ' ');
}

export function getSystemFooter(): string {
  const envFooter = String(process.env.SYSTEM_EMAIL_FOOTER || '').trim();
  if (envFooter.length > 0) {
    return envFooter;
  }
  return DEFAULT_SYSTEM_FOOTER_LINES.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlFooter(lines: string[]): string {
  const escapedLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '';

    const urlMatch = trimmed.match(/^(.*?):\s*(https?:\/\/\S+)$/i);
    if (urlMatch) {
      const label = escapeHtml(urlMatch[1]);
      const url = escapeHtml(urlMatch[2]);
      return `<div><span>${label}:</span> <a href="${url}" style="color:#475569;text-decoration:none;">${url}</a></div>`;
    }

    return `<div>${escapeHtml(trimmed)}</div>`;
  }).join('');

  return `<div style="${HTML_FOOTER_STYLE}">${escapedLines}</div>`;
}

export interface FooterContext {
  /** A fully-built, signed unsubscribe URL (preferred). */
  unsubscribeUrl?: string;
}

/**
 * Replace the {{{unsubscribe_url}}} placeholder with a real link.
 * Falls back to a generic unsubscribe page (with the recipient email when known)
 * so the footer never ships a broken placeholder to a real inbox.
 */
function resolveUnsubscribePlaceholder(footer: string, ctx?: FooterContext): string {
  if (!footer.includes('{{{unsubscribe_url}}}')) return footer;
  const url = ctx?.unsubscribeUrl && ctx.unsubscribeUrl.trim().length > 0
    ? ctx.unsubscribeUrl.trim()
    : FALLBACK_UNSUBSCRIBE_URL;
  return footer.split('{{{unsubscribe_url}}}').join(url);
}

export function ensureFooter(content: string, ctx?: FooterContext): string {
  const body = String(content || '').trim();
  let footer = getSystemFooter().trim();
  if (!footer) return body;
  footer = resolveUnsubscribePlaceholder(footer, ctx);
  if (!body) return footer;
  if (body.includes(footer)) return body;

  if (/<[a-z][\s\S]*>/i.test(body)) {
    return `${body}${buildHtmlFooter(footer.split('\n'))}`;
  }

  return `${body}\n\n${footer}`;
}
