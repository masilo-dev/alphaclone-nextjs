import { COMPANY_LEGAL } from '@/lib/seo/siteEntity';
import { SITE_URL } from '@/lib/siteUrl';
import { generateUnsubscribeToken } from '@/lib/email/unsubscribe';

const PLATFORM_NAME = 'Alphaclone Systems';
const PLATFORM_TAGLINE = 'The unified AI business operating system';

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
 * Reusable HTML email footer — table-based, max-width 600px, safe for major email clients.
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
    <td style="padding:24px 20px;background-color:#f8fafc;border-top:1px solid #e2e8f0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;text-align:center;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-bottom:8px;font-size:14px;font-weight:bold;color:#0f172a;">
            ${escapeHtml(PLATFORM_NAME)}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;color:#475569;">
            ${escapeHtml(PLATFORM_TAGLINE)}
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;color:#334155;">
            Sent on behalf of <strong>${safeTenant}</strong>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:12px;">
            <a href="${websiteUrl}" style="color:#2563eb;text-decoration:none;">Visit our website</a>
            &nbsp;|&nbsp;
            <a href="${privacyUrl}" style="color:#2563eb;text-decoration:none;">Privacy Policy</a>
            &nbsp;|&nbsp;
            <a href="${unsubscribeUrl}" style="color:#2563eb;text-decoration:none;">Unsubscribe</a>
          </td>
        </tr>
        <tr>
          <td style="padding-bottom:8px;color:#94a3b8;font-size:11px;">
            ${escapeHtml(COMPANY_LEGAL.legalName)}<br />
            ${addressLine}
          </td>
        </tr>
        <tr>
          <td style="color:#94a3b8;font-size:11px;">
            If you received this email in error, please disregard and delete it.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}
