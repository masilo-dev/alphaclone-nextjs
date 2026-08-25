import { applyPersonalizationTemplate, type PersonalizationVariables } from '@/lib/email/personalizationEngine';
import type { EmailLayoutFamily } from '@/lib/email/emailCommunicationClasses';

const NAVY = '#060d1a';
const NAVY_MID = '#0f172a';
const CYAN = '#2dd4bf';
const CYAN_BRIGHT = '#38bdf8';
const WHITE = '#ffffff';
const SLATE = '#94a3b8';
const SUCCESS = '#10b981';
const WARNING = '#f59e0b';
const CRITICAL = '#ef4444';

const LOGO_URL = process.env.NEXT_PUBLIC_EMAIL_LOGO_URL || 'https://alphaclone.tech/email/as-logo.png';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclone.tech';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!));
}

export interface AlphaCloneLayoutInput {
  layoutFamily: EmailLayoutFamily;
  subject: string;
  preheader?: string;
  headline: string;
  bodyHtml: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  variables?: PersonalizationVariables;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  /** Stat rows for success/digest layouts */
  stats?: Array<{ label: string; value: string }>;
}

function logoBlock(compact: boolean): string {
  const size = compact ? 120 : 180;
  return `<img src="${escapeHtml(LOGO_URL)}" width="${size}" alt="AlphaClone Systems" style="display:block;max-width:${size}px;height:auto;border:0;">`;
}

function buttonHtml(label: string, url: string): string {
  if (!label || !url || url === '#') return '';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
<tr><td align="center" style="border-radius:8px;background:${CYAN_BRIGHT};">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:600;color:${NAVY};text-decoration:none;">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function statsTable(stats: Array<{ label: string; value: string }>): string {
  if (!stats.length) return '';
  const rows = stats.map((s, i) => {
    const border = i < stats.length - 1 ? `border-bottom:1px solid rgba(148,163,184,0.2);` : '';
    return `<tr>
<td style="padding:12px 0;color:${SLATE};font-size:14px;${border}">${escapeHtml(s.label)}</td>
<td align="right" style="padding:12px 0;color:${WHITE};font-weight:600;font-size:14px;${border}">${escapeHtml(s.value)}</td>
</tr>`;
  }).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:rgba(15,23,42,0.6);border-radius:8px;padding:4px 16px;">${rows}</table>`;
}

function footerHtml(unsubscribeUrl?: string, preferencesUrl?: string): string {
  const prefUrl = preferencesUrl || `${APP_URL}/preferences/email`;
  const links = [
    `<a href="${escapeHtml(prefUrl)}" style="color:${SLATE};text-decoration:underline;">Notification Preferences</a>`,
    `<a href="${APP_URL}/help" style="color:${SLATE};text-decoration:underline;">Help</a>`,
    `<a href="${APP_URL}/legal/privacy" style="color:${SLATE};text-decoration:underline;">Privacy</a>`,
  ];
  if (unsubscribeUrl) {
    links.push(`<a href="${escapeHtml(unsubscribeUrl)}" style="color:${SLATE};text-decoration:underline;">Unsubscribe</a>`);
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:24px 32px;background:${NAVY_MID};border-top:1px solid rgba(45,212,191,0.15);font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${SLATE};text-align:center;">
<p style="margin:0 0 6px;font-weight:600;color:${WHITE};">AlphaClone Systems</p>
<p style="margin:0 0 14px;">Your business. Connected and moving.</p>
<p style="margin:0;">${links.join(' &nbsp;•&nbsp; ')}</p>
</td></tr></table>`;
}

function accentColor(family: EmailLayoutFamily): string {
  switch (family) {
    case 'failure': return CRITICAL;
    case 'success': return SUCCESS;
    case 'action_required': return WARNING;
    case 'security': return CYAN;
    default: return CYAN;
  }
}

export function renderAlphaCloneEmailLayout(input: AlphaCloneLayoutInput): { html: string; text: string } {
  const vars = input.variables || {};
  const headline = applyPersonalizationTemplate(input.headline, vars);
  const bodyHtml = applyPersonalizationTemplate(input.bodyHtml, vars);
  const bodyText = input.bodyText
    ? applyPersonalizationTemplate(input.bodyText, vars)
    : bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const ctaLabel = input.ctaLabel ? applyPersonalizationTemplate(input.ctaLabel, vars) : '';
  const ctaUrl = input.ctaUrl ? applyPersonalizationTemplate(input.ctaUrl, vars) : '';
  const preheader = input.preheader ? applyPersonalizationTemplate(input.preheader, vars) : '';
  const accent = accentColor(input.layoutFamily);
  const compact = input.layoutFamily !== 'welcome';
  const headerBg = input.layoutFamily === 'welcome'
    ? `background:linear-gradient(135deg, ${NAVY} 0%, #0c4a6e 50%, ${NAVY_MID} 100%);`
    : `background:${NAVY};border-bottom:3px solid ${accent};`;

  const statusBadge = input.layoutFamily === 'action_required'
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${WARNING};">Action required</p>`
    : input.layoutFamily === 'failure'
      ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${CRITICAL};">Attention needed</p>`
      : input.layoutFamily === 'success'
        ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${SUCCESS};">Completed</p>`
        : '';

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:${NAVY};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${NAVY};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:${NAVY_MID};border-collapse:collapse;border-radius:12px;overflow:hidden;">
<tr><td style="padding:${compact ? '20px 32px' : '32px'};${headerBg}">${logoBlock(compact)}</td></tr>
<tr><td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;color:${WHITE};">
${statusBadge}
<h1 style="margin:0 0 16px;font-size:${compact ? '22px' : '28px'};font-weight:700;line-height:1.3;color:${WHITE};">${escapeHtml(headline)}</h1>
<div style="font-size:16px;line-height:1.65;color:#cbd5e1;">${bodyHtml}</div>
${statsTable(input.stats || [])}
${buttonHtml(ctaLabel, ctaUrl)}
</td></tr>
<tr><td>${footerHtml(input.unsubscribeUrl, input.preferencesUrl)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    headline,
    '',
    bodyText,
    ...(input.stats || []).map((s) => `${s.label}: ${s.value}`),
    ctaLabel && ctaUrl ? `\n${ctaLabel}: ${ctaUrl}` : '',
    '',
    'AlphaClone Systems — Your business. Connected and moving.',
  ].filter(Boolean).join('\n');

  return { html, text };
}
