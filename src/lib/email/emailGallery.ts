import { renderEmail, type EmailTemplateType } from '@/lib/email/renderEmail';

export const EMAIL_TEMPLATE_GALLERY_SAMPLES: Array<{
  id: EmailTemplateType;
  label: string;
  description: string;
}> = [
  { id: 'transactional', label: 'Transactional', description: 'Account and service updates' },
  { id: 'account_verification', label: 'Account verification', description: 'Security codes and verification links' },
  { id: 'welcome', label: 'Welcome', description: 'New user onboarding' },
  { id: 'system_notification', label: 'System notification', description: 'Platform alerts and operational notices' },
  { id: 'marketing_campaign', label: 'Marketing campaign', description: 'Newsletters and product updates' },
  { id: 'outreach', label: 'Outreach', description: 'Sales follow-ups and prospect messages' },
  { id: 'booking_reminder', label: 'Booking reminder', description: 'Appointments and calendar reminders' },
  { id: 'invoice', label: 'Invoice', description: 'Billing and payment requests' },
  { id: 'proposal', label: 'Proposal', description: 'Business proposals' },
  { id: 'contract', label: 'Contract', description: 'Agreements and e-sign requests' },
  { id: 'digest', label: 'Daily / weekly summary', description: 'Digest and briefing emails' },
  { id: 'personal', label: 'Personal / plain', description: 'Direct messages with minimal chrome' },
  { id: 'internal_test', label: 'Internal test', description: 'Delivery validation only' },
];

export function renderEmailGallerySample(type: EmailTemplateType, options?: { longContent?: boolean; blockImages?: boolean }) {
  const long = options?.longContent ?? false;
  const body = long
    ? 'This is an extended message body used to validate spacing, wrapping, and footer stability when content spans multiple paragraphs. It includes enough text to stress-test mobile clients without breaking the centered container layout.'
    : 'Your workspace is ready. Review the latest activity and take action when you are ready.';

  const rendered = renderEmail({
    type,
    subject: `AlphaClone — ${EMAIL_TEMPLATE_GALLERY_SAMPLES.find((s) => s.id === type)?.label || type}`,
    preheader: 'Professional AlphaClone Systems communication preview',
    recipientName: 'Alex',
    heading: EMAIL_TEMPLATE_GALLERY_SAMPLES.find((s) => s.id === type)?.label || 'Preview',
    greeting: 'Hi Alex,',
    content: `${body}${long ? '<p style="margin:16px 0 0;">Additional detail appears here with safe inline styling only.</p>' : ''}`,
    contentIsHtml: true,
    cta: { label: 'Open dashboard', url: 'https://alphaclonesystems.com/dashboard' },
    infoPanelHtml:
      type === 'digest' || type === 'invoice'
        ? '<strong>Summary</strong><br/>Open tasks: 4 · New leads: 12 · Revenue: $8,420'
        : undefined,
    unsubscribeUrl: 'https://alphaclonesystems.com/api/unsubscribe?token=preview',
    tenantName: 'Acme Studio',
  });

  if (options?.blockImages) {
    return {
      ...rendered,
      html: rendered.html.replace(/src="[^"]+"/g, 'src=""'),
    };
  }

  return rendered;
}

export function renderAllEmailGallerySamples(options?: { longContent?: boolean; blockImages?: boolean }) {
  return EMAIL_TEMPLATE_GALLERY_SAMPLES.map((sample) => ({
    ...sample,
    ...renderEmailGallerySample(sample.id, options),
  }));
}
