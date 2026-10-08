import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';
import { renderEmail, type EmailTemplateType } from '@/lib/email/renderEmail';

const DEFAULT_SYSTEM_FOOTER_LINES: string[] = [
  `${COMPANY_LEGAL.legalName} — a Wyoming registered company`,
  formatLegalAddress(),
  'alphaclonesystems.com',
  'Unsubscribe: {{{unsubscribe_url}}}',
  'Privacy: https://alphaclonesystems.com/privacy-policy',
  'Terms: https://alphaclonesystems.com/terms-of-service',
  'If you received this email in error, please disregard and delete it.',
];

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

const COMPLIANCE_CORE_MARKERS = [
  'Privacy Policy',
  '/privacy-policy',
  'Privacy Request',
  'Manage Preferences',
  'If you received this email in error',
];

const COMPLIANCE_UNSUBSCRIBE_MARKERS = [
  'Unsubscribe',
  '/unsubscribe',
  '{{{unsubscribe_url}}}',
];

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
  unsubscribeUrl?: string;
}

function resolveUnsubscribePlaceholder(footer: string, ctx?: FooterContext): string {
  if (!footer.includes('{{{unsubscribe_url}}}')) return footer;
  const url = ctx?.unsubscribeUrl && ctx.unsubscribeUrl.trim().length > 0
    ? ctx.unsubscribeUrl.trim()
    : FALLBACK_UNSUBSCRIBE_URL;
  return footer.split('{{{unsubscribe_url}}}').join(url);
}

/** Detect branded/compliance footers so we never append twice. */
export function hasEmailComplianceFooter(content: string): boolean {
  const text = String(content || '');
  if (!text.trim()) return false;

  // Explicit structural footer containers
  if (/<table[^>]+role=["']presentation["'][^>]*>[\s\S]*(?:href=["'][^"']*(?:\/privacy-policy|\/unsubscribe)|Privacy Policy|Unsubscribe)/i.test(text)) return true;
  if (/<div[^>]+border-top:\s*1px\s+solid/i.test(text) && (text.includes('/privacy-policy') || text.includes('/unsubscribe') || (text.includes('Privacy Policy') && text.includes('Unsubscribe')))) return true;
  if (/background-color:#0d1b2a/i.test(text) && text.includes('Alphaclone Systems')) return true;

  // Explicit link anchors to both privacy policy and unsubscribe
  if (/<a[^>]+href=["'][^"']*\/privacy-policy/i.test(text) && /<a[^>]+href=["'][^"']*(?:\/unsubscribe|\/api\/unsubscribe|\{\{\{unsubscribe_url\}\}\})/i.test(text)) return true;

  // Plain text footer markers (must be structured footer prefixes, not casual body mentions)
  const hasUnsubPrefix = /(?:Unsubscribe|unsubscribe):\s*(?:https?:\/\/|\{\{\{)/i.test(text) || text.includes('{{{unsubscribe_url}}}');
  const hasPrivacyPrefix = /(?:Privacy(?:\s+Policy)?):\s*https?:\/\//i.test(text);
  if (hasUnsubPrefix && hasPrivacyPrefix) return true;

  return false;
}

/** True when HTML is a full buildEmail() document (already has footer row). */
export function isFullEmailDocument(html: string): boolean {
  const body = String(html || '');
  return /<!DOCTYPE\s+html/i.test(body) && hasEmailComplianceFooter(body);
}

/**
 * Insert HTML block before the compliance footer (attachments, document links, signatures).
 */
export function insertBeforeEmailFooter(html: string, blockHtml: string): string {
  const body = String(html || '').trim();
  const block = String(blockHtml || '').trim();
  if (!body || !block) return body || block;

  const isHtml = /<[a-z][\s\S]*>/i.test(body);

  if (isHtml && isFullEmailDocument(body)) {
    const footerRowMatch = body.match(/<tr>\s*<td[^>]*>\s*<table[^>]+role=["']presentation["']/i);
    if (footerRowMatch?.index != null) {
      const insertAt = footerRowMatch.index;
      const attachmentRow = `<tr><td style="padding:16px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">${block}</td></tr>`;
      return `${body.slice(0, insertAt)}${attachmentRow}${body.slice(insertAt)}`;
    }
  }

  if (isHtml && hasEmailComplianceFooter(body)) {
    const footerDivMatch = body.match(/<div style="[^"]*border-top:1px solid #e2e8f0/i);
    if (footerDivMatch?.index != null) {
      return `${body.slice(0, footerDivMatch.index)}<div style="margin:16px 0;">${block}</div>${body.slice(footerDivMatch.index)}`;
    }
    return `${body}<div style="margin:16px 0;">${block}</div>`;
  }

  if (!isHtml && hasEmailComplianceFooter(body)) {
    for (const marker of ['Unsubscribe:', 'Privacy:', 'alphaclonesystems.com', COMPANY_LEGAL.legalName]) {
      const idx = body.indexOf(marker);
      if (idx > 0) {
        const before = body.slice(0, idx).trimEnd();
        return `${before}\n\n${block}\n\n${body.slice(idx)}`;
      }
    }
  }

  return isHtml ? `${body}<br><br>${block}` : `${body}\n\n${block}`;
}

export function buildAttachmentNoticeHtml(files: string[]): string {
  if (!files.length) return '';
  const items = files.map((name) => `<li>${escapeHtml(name)}</li>`).join('');
  return `<p style="margin:0 0 8px 0;font-weight:600;color:#0f172a;">Attachments</p><ul style="margin:0;padding-left:20px;color:#334155;">${items}</ul>`;
}

export function ensureFooter(content: string, ctx?: FooterContext): string {
  const body = String(content || '').trim();
  const effectiveUnsubscribeUrl = ctx?.unsubscribeUrl && ctx.unsubscribeUrl.trim().length > 0
    ? ctx.unsubscribeUrl.trim()
    : FALLBACK_UNSUBSCRIBE_URL;

  if (!body) {
    const emptyFooter = getSystemFooter().trim();
    return resolveUnsubscribePlaceholder(emptyFooter, { unsubscribeUrl: effectiveUnsubscribeUrl });
  }

  if (hasEmailComplianceFooter(body) || isFullEmailDocument(body)) {
    return body;
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  if (isHtml) {
    const wrapped = renderEmail({
      type: 'outreach',
      subject: 'Message from AlphaClone Systems',
      content: body,
      contentIsHtml: true,
      footerType: 'outreach',
      unsubscribeUrl: effectiveUnsubscribeUrl,
    });
    return wrapped.html;
  }

  let footer = getSystemFooter().trim();
  if (!footer) return body;
  footer = resolveUnsubscribePlaceholder(footer, { unsubscribeUrl: effectiveUnsubscribeUrl });
  return `${body}\n\n${footer}`;
}
