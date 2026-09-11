import { COMPANY_LEGAL, formatLegalAddress } from '@/lib/seo/siteEntity';
import { escapeHtml } from '@/lib/email/escapeHtml';
import { buildSafeEmailBodyHtmlServer } from '@/lib/email/sanitizeEmailHtmlServer';
import { buildEmailContentHtml, buildEmailContentText, type EmailContentInput } from '@/lib/email/emailContentBuilder';
import {
  EMAIL_BRAND_HOME_URL,
  EMAIL_DESIGN,
  resolveEmailLogoUrl,
  getLegalUrls,
} from '@/lib/email/emailConfig';

export type EmailTemplateType =
  | 'transactional'
  | 'account_verification'
  | 'welcome'
  | 'system_notification'
  | 'marketing_campaign'
  | 'outreach'
  | 'booking_reminder'
  | 'invoice'
  | 'proposal'
  | 'contract'
  | 'digest'
  | 'personal'
  | 'internal_test';

export type EmailFooterType = 'transactional' | 'marketing' | 'outreach' | 'minimal';

export interface RenderEmailCta {
  label: string;
  url: string;
}

export interface RenderEmailInput {
  type: EmailTemplateType;
  subject: string;
  preheader?: string;
  recipientName?: string;
  heading?: string;
  greeting?: string;
  /** Plain text or sanitized HTML fragment for the body */
  content: string;
  /** When true, content is treated as trusted HTML (still sanitized) */
  contentIsHtml?: boolean;
  cta?: RenderEmailCta;
  infoPanelHtml?: string;
  signatureHtml?: string;
  signatureText?: string;
  footerType?: EmailFooterType;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  reasonText?: string;
  tenantName?: string;
  logoUrl?: string;
}

function mapTemplateToFooter(type: EmailTemplateType, override?: EmailFooterType): EmailFooterType {
  if (override) return override;
  switch (type) {
    case 'marketing_campaign':
    case 'digest':
      return 'marketing';
    case 'outreach':
      return 'outreach';
    case 'personal':
    case 'internal_test':
      return 'minimal';
    case 'transactional':
    case 'account_verification':
    case 'invoice':
    case 'proposal':
    case 'contract':
    case 'booking_reminder':
      return 'transactional';
    default:
      return 'transactional';
  }
}

function defaultReason(type: EmailTemplateType, tenantName?: string): string {
  const tenant = tenantName || 'AlphaClone Systems';
  switch (type) {
    case 'marketing_campaign':
      return `you opted in to receive updates from ${tenant}.`;
    case 'outreach':
      return `${tenant} is following up on a business conversation with you.`;
    case 'account_verification':
    case 'welcome':
      return `you created or manage an account with ${tenant}.`;
    case 'invoice':
    case 'proposal':
    case 'contract':
      return `you have an active business record with ${tenant}.`;
    case 'booking_reminder':
      return `you have a scheduled appointment with ${tenant}.`;
    case 'internal_test':
      return 'this is an internal delivery test from AlphaClone Systems.';
    default:
      return `you have an active relationship with ${tenant}.`;
  }
}

function renderEmailHeader(logoUrl: string): string {
  const w = EMAIL_DESIGN.logoDisplayWidth;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:28px 32px 20px 32px;background:${EMAIL_DESIGN.cardBackground};border-bottom:1px solid ${EMAIL_DESIGN.border};">
  <a href="${escapeHtml(EMAIL_BRAND_HOME_URL)}" target="_blank" style="text-decoration:none;display:inline-block;">
    <img
      src="${escapeHtml(logoUrl)}"
      width="${w}"
      alt="AlphaClone Systems"
      border="0"
      style="display:block;width:${w}px;max-width:${w}px;height:auto;margin:0 auto 10px auto;border:0;outline:none;text-decoration:none;"
    />
    <span style="display:block;font-family:${EMAIL_DESIGN.fontStack};font-size:15px;font-weight:700;letter-spacing:0.04em;color:${EMAIL_DESIGN.textPrimary};text-align:center;">AlphaClone Systems</span>
  </a>
</td></tr></table>`;
}

function renderEmailFooter(input: {
  footerType: EmailFooterType;
  reasonText: string;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
}): { html: string; text: string } {
  const legal = getLegalUrls();
  const prefUrl = input.preferencesUrl || legal.preferences;

  const link = (href: string, label: string) =>
    `<a href="${escapeHtml(href)}" style="color:${EMAIL_DESIGN.textMuted};text-decoration:underline;">${escapeHtml(label)}</a>`;

  const links: string[] = [
    link(legal.privacy, 'Privacy Policy'),
    link(legal.terms, 'Terms'),
  ];

  if (input.footerType === 'marketing' || input.footerType === 'outreach') {
    links.push(link(prefUrl, 'Manage Preferences'));
    links.push(link(legal.privacyRequest, 'Privacy Request'));
    if (input.unsubscribeUrl) {
      links.push(link(input.unsubscribeUrl, 'Unsubscribe'));
    }
  } else if (input.footerType === 'transactional') {
    links.push(link(legal.privacyRequest, 'Privacy Request'));
  }

  links.push(link(legal.website, 'Website'));

  const linkRow = links.join(' &nbsp;&bull;&nbsp; ');
  const address = formatLegalAddress();

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td align="center" style="padding:28px 24px 32px 24px;background:${EMAIL_DESIGN.footerBackground};border-top:1px solid ${EMAIL_DESIGN.border};font-family:${EMAIL_DESIGN.fontStack};font-size:12px;line-height:1.7;color:${EMAIL_DESIGN.textMuted};text-align:center;">
  <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:${EMAIL_DESIGN.textSecondary};text-align:center;">${escapeHtml(input.reasonText)}</p>
  <p style="margin:0 0 14px;text-align:center;">${linkRow}</p>
  <p style="margin:0 0 6px;font-weight:600;color:${EMAIL_DESIGN.textPrimary};text-align:center;">${escapeHtml(COMPANY_LEGAL.legalName)}</p>
  <p style="margin:0 0 12px;text-align:center;">${escapeHtml(address)}</p>
  <p style="margin:0;font-size:11px;color:${EMAIL_DESIGN.textMuted};text-align:center;">If you received this email in error, please disregard and delete it.</p>
</td></tr></table>`;

  const text = [
    input.reasonText,
    '',
    ...links.map((l) => l.replace(/<[^>]+>/g, '')),
    '',
    COMPANY_LEGAL.legalName,
    address,
  ].join('\n');

  return { html, text };
}

function renderInfoPanel(html: string): string {
  if (!html.trim()) return '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;">
<tr><td style="padding:16px 18px;background:#F8FAFC;border:1px solid ${EMAIL_DESIGN.border};border-radius:8px;font-family:${EMAIL_DESIGN.fontStack};font-size:14px;line-height:1.6;color:${EMAIL_DESIGN.textSecondary};">
${html}
</td></tr></table>`;
}

/**
 * Central AlphaClone email renderer — all branded outbound email should pass through here.
 */
export function renderEmail(input: RenderEmailInput): { html: string; text: string } {
  const logoUrl = input.logoUrl || resolveEmailLogoUrl();
  const footerType = mapTemplateToFooter(input.type, input.footerType);
  const reasonText = input.reasonText || defaultReason(input.type, input.tenantName);
  const preheader = input.preheader || input.heading || input.subject;

  const greeting =
    input.greeting ||
    (input.recipientName ? `Hi ${input.recipientName.trim()},` : undefined);

  const bodyHtml = input.contentIsHtml
    ? buildSafeEmailBodyHtmlServer(input.content, input.content)
    : undefined;

  const contentInput: EmailContentInput = {
    headline: input.heading || input.subject,
    greeting,
    body: input.contentIsHtml ? '' : input.content,
    cta: input.cta,
    signatureHtml: input.signatureHtml,
    signatureText: input.signatureText,
  };

  const innerContentHtml = [
    bodyHtml || buildEmailContentHtml(contentInput),
    renderInfoPanel(input.infoPanelHtml || ''),
  ].join('\n');

  const innerContentText = buildEmailContentText({
    ...contentInput,
    body: input.contentIsHtml
      ? input.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : input.content,
  });

  const footer = renderEmailFooter({
    footerType,
    reasonText,
    unsubscribeUrl: input.unsubscribeUrl,
    preferencesUrl: input.preferencesUrl,
  });

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${escapeHtml(input.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${EMAIL_DESIGN.pageBackground};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${EMAIL_DESIGN.pageBackground};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:${EMAIL_DESIGN.pageBackground};">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:${EMAIL_DESIGN.maxWidth}px;margin:0 auto;background:${EMAIL_DESIGN.cardBackground};border:1px solid ${EMAIL_DESIGN.border};border-radius:8px;overflow:hidden;">
<tr><td>
${renderEmailHeader(logoUrl)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="padding:28px 32px 8px 32px;font-family:${EMAIL_DESIGN.fontStack};color:${EMAIL_DESIGN.textPrimary};">
${innerContentHtml}
</td></tr>
</table>
${footer.html}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [innerContentText, '', footer.text].filter(Boolean).join('\n\n');

  return { html, text };
}

/** Map gateway category to template type for renderEmail. */
export function gatewayCategoryToTemplateType(
  category: string,
): EmailTemplateType {
  switch (category) {
    case 'marketing':
      return 'marketing_campaign';
    case 'outreach':
      return 'outreach';
    case 'account_security':
      return 'account_verification';
    case 'invoice_payment':
      return 'invoice';
    case 'contract_document':
      return 'contract';
    case 'booking_calendar':
      return 'booking_reminder';
    case 'internal_notification':
      return 'system_notification';
    default:
      return 'transactional';
  }
}
