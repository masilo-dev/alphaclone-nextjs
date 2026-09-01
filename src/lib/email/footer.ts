import { COMPANY_LEGAL } from '@/lib/seo/siteEntity';
import { SITE_URL } from '@/lib/siteUrl';
import { generateUnsubscribeToken } from '@/lib/email/unsubscribeToken';

const PLATFORM_NAME = 'Alphaclone Systems';
const PLATFORM_TAGLINE = 'Simple. Efficient.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildUnsubscribeHref(tenantId: string, recipientEmail?: string): string {
  if (!recipientEmail?.trim()) {
    return `${SITE_URL}/privacy-policy`;
  }
  const token = generateUnsubscribeToken(recipientEmail, tenantId);
  if (!token) {
    return `${SITE_URL}/privacy-policy`;
  }
  return `${SITE_URL}/api/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * Reusable HTML email footer — locked Alphaclone Systems brand, navy background,
 * table-based, max-width 600px, safe for major email clients.
 */
export function getEmailFooter(
  tenantName: string,
  tenantId: string,
  recipientEmail?: string,
): string {
  const safeTenant = escapeHtml(tenantName || 'Your workspace');
  const unsubscribeUrl = escapeHtml(buildUnsubscribeHref(tenantId, recipientEmail));
  const websiteUrl = escapeHtml(SITE_URL);
  const privacyUrl = escapeHtml(`${SITE_URL}/privacy-policy`);
  const addressLine = escapeHtml(
    `${COMPANY_LEGAL.street}, ${COMPANY_LEGAL.city}, ${COMPANY_LEGAL.region} ${COMPANY_LEGAL.postalCode}, USA`,
  );

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;margin:0 auto;">
  <tr>
    <td style="padding:28px 20px 20px 20px;background-color:#0d1b2a;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#94a3b8;text-align:center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:4px;font-size:13px;font-weight:bold;color:#f0e6d2;letter-spacing:2px;text-transform:uppercase;">
            ${escapeHtml(PLATFORM_NAME)}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;color:#2dd4bf;font-size:11px;letter-spacing:0.5px;">
            ${escapeHtml(PLATFORM_TAGLINE)}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;color:#94a3b8;">
            Sent on behalf of <strong style="color:#cbd5e1;">${safeTenant}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:16px;">
            <a href="https://www.linkedin.com/company/alphaclone-systems" style="color:#64748b;text-decoration:none;font-size:12px;">LinkedIn</a>
            &nbsp;&middot;&nbsp;
            <a href="https://www.facebook.com/100089899181752" style="color:#64748b;text-decoration:none;font-size:12px;">Facebook</a>
            &nbsp;&middot;&nbsp;
            <a href="https://x.com/AlphaCloneSys" style="color:#64748b;text-decoration:none;font-size:12px;">X&nbsp;(Twitter)</a>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;">
            <a href="${websiteUrl}" style="color:#475569;text-decoration:none;">Website</a>
            &nbsp;|&nbsp;
            <a href="${privacyUrl}" style="color:#475569;text-decoration:none;">Privacy Policy</a>
            &nbsp;|&nbsp;
            <a href="${unsubscribeUrl}" style="color:#475569;text-decoration:none;">Unsubscribe</a>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;color:#475569;font-size:11px;">
            ${escapeHtml(COMPANY_LEGAL.legalName)}<br />
            ${addressLine}
          </td>
        </tr>
        <tr>
          <td style="color:#334155;font-size:11px;">
            If you received this email in error, please disregard and delete it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}
