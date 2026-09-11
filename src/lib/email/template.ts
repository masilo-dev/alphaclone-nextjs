import { getEmailFooter } from '@/lib/email/footer';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribe';

export interface BuildEmailParams {
  subject: string;
  bodyHtml: string;
  tenantName: string;
  tenantId: string;
  recipientEmail: string;
  clientName?: string;
  clientCalendlyLink?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds a complete HTML email with Alphaclone branding, body content, and compliance footer.
 * Inline CSS only — no external stylesheets.
 */
export function buildEmail({
  subject,
  bodyHtml,
  tenantName,
  tenantId,
  recipientEmail,
  clientName,
  clientCalendlyLink,
}: BuildEmailParams): string {
  const safeSubject = escapeHtml(subject);
  const footer = getEmailFooter(tenantName, tenantId, recipientEmail);
  const listUnsubscribeUrl = buildUnsubscribeUrl(recipientEmail, tenantId);

  let processedBody = bodyHtml;
  if (clientName) {
    processedBody = processedBody.replace(/{{client_name}}/g, clientName);
  }
  if (clientCalendlyLink) {
    processedBody = processedBody.replace(/{{client_calendly_link}}/g, clientCalendlyLink);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${safeSubject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="background-color:#0d1b2a;padding:28px 24px;text-align:center;font-family:Arial,Helvetica,sans-serif;">
              <div style="font-size:20px;font-weight:bold;color:#f0e6d2;letter-spacing:2px;text-transform:uppercase;">Alphaclone Systems</div>
              <div style="font-size:12px;color:#2dd4bf;margin-top:6px;letter-spacing:0.5px;">Simple. Efficient.</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#334155;">
              ${processedBody}
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${listUnsubscribeUrl ? `<!-- List-Unsubscribe: ${escapeHtml(listUnsubscribeUrl)} -->` : ''}
</body>
</html>`;
}
