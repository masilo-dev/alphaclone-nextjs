/**
 * Standardized Outgoing Email Layout for AlphaClone Systems
 *
 * Requirements:
 * - Center the email container, while keeping paragraphs left-aligned for easy reading.
 * - Email-safe presentation table with width:100% and maximum content width around 600px.
 * - Balanced outer spacing and 24–32px internal padding on desktop; 16px on mobile.
 * - Readable system fonts, ~16px body text, 1.6 line height, and consistent paragraph spacing.
 * - Restrained header (tenant logo/name) without oversized banners or heavy artificial cards.
 * - Full client support: Gmail, Outlook (MSO tables), Zoho Mail, Apple Mail, iOS/Android.
 * - Dark mode compatibility via CSS variables / media query.
 */

export interface StandardEmailLayoutOptions {
  subject?: string;
  preheader?: string;
  tenantName?: string;
  logoUrl?: string;
  headerHtml?: string;
  footerHtml?: string;
  isCompact?: boolean;
}

export const EMAIL_SYSTEM_FONTS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/**
 * Detects whether an HTML string already contains a top-level email presentation layout.
 */
export function hasEmailLayoutContainer(html: string): boolean {
  const text = String(html || '').trim();
  if (!text) return false;
  if (/<!doctype\s+html/i.test(text) && (/class="[^"]*email-container/i.test(text) || /role="presentation"/i.test(text))) {
    return true;
  }
  if (/<table[^>]*class="[^"]*email-container/i.test(text)) {
    return true;
  }
  if (/<table[^>]*role="presentation"[^>]*style="[^"]*max-width:\s*(?:600|620)px/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * Wraps content in a bulletproof, centered email presentation table.
 */
export function wrapInStandardEmailLayout(
  contentHtml: string,
  options?: StandardEmailLayoutOptions
): string {
  const subject = options?.subject ? escapeHtml(options.subject) : '';
  const preheader = options?.preheader ? escapeHtml(options.preheader) : '';
  const tenantName = options?.tenantName ? escapeHtml(options.tenantName) : '';
  const isCompact = Boolean(options?.isCompact);

  // Restrained, lightweight header
  let headerBlock = '';
  if (options?.headerHtml) {
    headerBlock = options.headerHtml;
  } else if (options?.logoUrl) {
    headerBlock = `
      <tr>
        <td class="email-header-cell" align="left" style="padding: 24px 32px 16px 32px; border-bottom: 1px solid #e2e8f0;">
          <img src="${escapeHtml(options.logoUrl)}" alt="${tenantName || 'Logo'}" height="32" style="display: block; height: 32px; max-height: 36px; max-width: 160px; width: auto; border: 0; outline: none; text-decoration: none;" />
        </td>
      </tr>
    `;
  } else if (tenantName && !isCompact) {
    headerBlock = `
      <tr>
        <td class="email-header-cell" align="left" style="padding: 24px 32px 16px 32px; border-bottom: 1px solid #e2e8f0;">
          <span class="email-text-primary" style="font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 16px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;">${tenantName}</span>
        </td>
      </tr>
    `;
  }

  // Footer block
  const footerBlock = options?.footerHtml
    ? `
      <tr>
        <td class="email-footer-cell" align="left" style="padding: 20px 32px 28px 32px; border-top: 1px solid #e2e8f0; font-family: ${EMAIL_SYSTEM_FONTS}; font-size: 13px; line-height: 1.6; color: #64748b;">
          ${options.footerHtml}
        </td>
      </tr>
    `
    : '';

  const preheaderBlock = preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;color:#f8fafc;">${preheader}</div>`
    : '';

  const cardStyle = isCompact
    ? 'max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border:0;border-collapse:separate;text-align:left;'
    : 'max-width:600px;width:100%;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;border-collapse:separate;overflow:hidden;text-align:left;';

  const outerBg = isCompact ? '#ffffff' : '#f8fafc';
  const outerPadding = isCompact ? '16px 12px' : '24px 12px';
  const contentPadding = isCompact ? '20px 24px' : '28px 32px';

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  ${subject ? `<title>${subject}</title>` : ''}
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    table, td { border-collapse: collapse; }
    body, table, td, p, a, li, h1, h2, h3 { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
  <style type="text/css">
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table, td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    .email-container {
      width: 100% !important;
      max-width: 600px !important;
    }
    @media only screen and (max-width: 620px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .email-outer-cell {
        padding: 12px 8px !important;
      }
      .email-content-cell {
        padding: 20px 16px !important;
      }
      .email-header-cell {
        padding: 16px 16px 12px 16px !important;
      }
      .email-footer-cell {
        padding: 16px 16px 20px 16px !important;
      }
      .email-btn {
        display: block !important;
        width: 100% !important;
        text-align: center !important;
        box-sizing: border-box !important;
      }
    }
    @media (prefers-color-scheme: dark) {
      .email-body-bg {
        background-color: #0b0f17 !important;
      }
      .email-card-bg {
        background-color: #111827 !important;
        border-color: #1f2937 !important;
      }
      .email-text-primary {
        color: #f1f5f9 !important;
      }
      .email-text-secondary {
        color: #cbd5e1 !important;
      }
      .email-text-muted {
        color: #94a3b8 !important;
      }
      .email-card-subtle {
        background-color: #1e293b !important;
        border-color: #334155 !important;
      }
    }
  </style>
</head>
<body class="email-body-bg" style="margin:0;padding:0;width:100%;background-color:${outerBg};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  ${preheaderBlock}
  <!-- Outer presentation table: 100% width, centered -->
  <table role="presentation" width="100%" align="center" cellpadding="0" cellspacing="0" border="0" class="email-body-bg" style="width:100%;margin:0;padding:0;background-color:${outerBg};border-collapse:collapse;">
    <tr>
      <td class="email-outer-cell" align="center" valign="top" style="padding:${outerPadding};vertical-align:top;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" align="center">
          <tr>
            <td>
        <![endif]-->
        <!-- Inner reading container: max 600px width, margin 0 auto, left-aligned content -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-container email-card-bg" style="${cardStyle}">
          ${headerBlock}
          <tr>
            <td class="email-content-cell email-text-primary" align="left" style="padding:${contentPadding};font-family:${EMAIL_SYSTEM_FONTS};font-size:16px;line-height:1.6;color:#1e293b;text-align:left;word-break:break-word;overflow-wrap:break-word;">
              ${contentHtml}
            </td>
          </tr>
          ${footerBlock}
        </table>
        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
