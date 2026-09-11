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

  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail, tenantId);

  const rendered = renderEmail({
    type: 'outreach',
    subject,
    heading: subject,
    content: processedBody,
    contentIsHtml: true,
    footerType: 'outreach',
    tenantName,
    unsubscribeUrl,
    reasonText: `${tenantName} is following up on a business conversation with you.`,
  });

  const listUnsubscribeUrl = buildUnsubscribeUrl(recipientEmail, tenantId);
  const listHeader = listUnsubscribeUrl
    ? `\n<!-- List-Unsubscribe: ${listUnsubscribeUrl} -->`
    : '';

  return rendered.html.replace('</body>', `${listHeader}\n</body>`);
}

export function buildEmailWithText(params: BuildEmailParams): { html: string; text: string } {
  const html = buildEmail(params);
  const rendered = renderEmail({
    type: 'outreach',
    subject: params.subject,
    heading: params.subject,
    content: params.bodyHtml.replace(/<[^>]+>/g, ' '),
    footerType: 'outreach',
    tenantName: params.tenantName,
    unsubscribeUrl: buildUnsubscribeUrl(params.recipientEmail, params.tenantId),
  });
  return { html, text: rendered.text };
}
