import { renderEmail } from '@/lib/email/renderEmail';
import { buildUnsubscribeUrl } from '@/lib/email/unsubscribeToken';

export interface BuildEmailParams {
  subject: string;
  bodyHtml: string;
  tenantName: string;
  tenantId: string;
  recipientEmail: string;
  clientName?: string;
  clientCalendlyLink?: string;
}

/**
 * Builds a complete branded HTML email via the central renderEmail layout.
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
  let processedBody = bodyHtml;
  if (clientName) {
    processedBody = processedBody.replace(/{{client_name}}/g, clientName);
  }
  if (clientCalendlyLink) {
    processedBody = processedBody.replace(/{{client_calendly_link}}/g, clientCalendlyLink);
  }

  const rendered = renderEmail({
    type: 'outreach',
    subject,
    heading: subject,
    content: processedBody,
    contentIsHtml: true,
    footerType: 'outreach',
    tenantName,
    unsubscribeUrl: buildUnsubscribeUrl(recipientEmail, tenantId),
    reasonText: `${tenantName} is following up on a business conversation with you.`,
  });

  return rendered.html;
}

export function buildEmailWithText(params: BuildEmailParams): { html: string; text: string } {
  const rendered = renderEmail({
    type: 'outreach',
    subject: params.subject,
    heading: params.subject,
    content: params.bodyHtml,
    contentIsHtml: true,
    footerType: 'outreach',
    tenantName: params.tenantName,
    unsubscribeUrl: buildUnsubscribeUrl(params.recipientEmail, params.tenantId),
    reasonText: `${params.tenantName} is following up on a business conversation with you.`,
  });
  return { html: rendered.html, text: rendered.text };
}

/** @deprecated Legacy footer helper — new emails use renderEmail footer. */
export function getEmailFooter(
  tenantName: string,
  tenantId: string,
  recipientEmail?: string,
): string {
  const rendered = renderEmail({
    type: 'outreach',
    subject: 'Message',
    content: '<p></p>',
    contentIsHtml: true,
    footerType: 'outreach',
    tenantName,
    unsubscribeUrl: buildUnsubscribeUrl(recipientEmail || '', tenantId),
  });
  const start = rendered.html.lastIndexOf('<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">');
  return start >= 0 ? rendered.html.slice(start) : rendered.html;
}
