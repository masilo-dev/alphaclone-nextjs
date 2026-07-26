import type {
  BrandIdentity,
  CommunicationPurpose,
  PolicyReference,
  ResolvedCommunicationCompliance,
} from './communicationCompliance';

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]!));

export interface EmailShellInput {
  subject: string;
  preheader?: string;
  contentHtml: string;
  contentText: string;
  brand: BrandIdentity;
  purpose: CommunicationPurpose;
  compliance: ResolvedCommunicationCompliance;
  unsubscribeUrl?: string;
  preferencesUrl?: string;
  dataRequestUrl?: string;
}

function policyLink(policy: PolicyReference | undefined, label: string): string {
  return policy
    ? `<a href="${escapeHtml(policy.publicUrl)}" style="color:#475569;text-decoration:underline;">${label}</a>`
    : '';
}

export function renderComplianceFooter(input: EmailShellInput): { html: string; text: string } {
  const links = [
    policyLink(input.compliance.privacyPolicy, 'Privacy policy'),
    policyLink(input.compliance.termsPolicy, 'Terms'),
    input.preferencesUrl ? `<a href="${escapeHtml(input.preferencesUrl)}" style="color:#475569;text-decoration:underline;">Manage preferences</a>` : '',
    input.compliance.unsubscribeRequired && input.unsubscribeUrl
      ? `<a href="${escapeHtml(input.unsubscribeUrl)}" style="color:#475569;text-decoration:underline;">Unsubscribe</a>`
      : '',
    input.dataRequestUrl ? `<a href="${escapeHtml(input.dataRequestUrl)}" style="color:#475569;text-decoration:underline;">Privacy request</a>` : '',
  ].filter(Boolean);
  const identity = [input.brand.legalCompanyName, input.brand.postalAddress]
    .filter((value): value is string => Boolean(value));
  const reason = `You are receiving this message because ${input.purpose.reasonText}`;
  return {
    html: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td style="padding:24px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
<p style="margin:0 0 10px;">${escapeHtml(reason)}</p>
<p style="margin:0 0 10px;">${links.join(' &nbsp;•&nbsp; ')}</p>
<p style="margin:0;">${identity.map(escapeHtml).join('<br>')}</p>
${input.compliance.tracking.disclosure ? `<p style="margin:10px 0 0;">${escapeHtml(input.compliance.tracking.disclosure)}</p>` : ''}
</td></tr></table>`,
    text: [
      reason,
      ...links.map((link) => link.replace(/<[^>]+>/g, '')),
      ...identity,
      input.compliance.tracking.disclosure || '',
    ].filter(Boolean).join('\n'),
  };
}

export function renderEmailShell(input: EmailShellInput): { html: string; text: string } {
  const footer = renderComplianceFooter(input);
  const color = /^#[0-9a-f]{6}$/i.test(input.brand.primaryColor || '') ? input.brand.primaryColor : '#0f766e';
  const logo = input.brand.logoUrl
    ? `<img src="${escapeHtml(input.brand.logoUrl)}" width="180" alt="${escapeHtml(input.brand.logoAlt || input.brand.tradingName || input.brand.legalCompanyName)}" style="display:block;max-width:180px;width:auto;height:auto;border:0;">`
    : `<strong style="font-size:20px;color:#0f172a;">${escapeHtml(input.brand.tradingName || input.brand.legalCompanyName)}</strong>`;
  return {
    html: `<!doctype html><html lang="${escapeHtml(input.compliance.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;"><div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(input.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:#fff;border-collapse:collapse;">
<tr><td style="padding:24px 32px;border-top:4px solid ${color};">${logo}</td></tr>
<tr><td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1e293b;">${input.contentHtml}</td></tr>
<tr><td>${footer.html}</td></tr></table></td></tr></table></body></html>`,
    text: [input.contentText, '', footer.text].join('\n'),
  };
}
