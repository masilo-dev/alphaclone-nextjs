import { resolveCampaignMergeTags, buildCampaignMergeContext, type CampaignMergeTagContext } from '@/lib/email/mergeTags';

export type PersonalizationVariables = Record<string, string | number | boolean | null | undefined>;

const GREETING_FALLBACKS = ['there', 'friend'] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimString(value: unknown): string {
  return String(value ?? '').trim();
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = trimString(name).split(/\s+/).filter(Boolean);
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') };
}

function timeOfDayGreeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Normalizes personalization variables with safe fallbacks — never leaves raw {{tags}} in output.
 */
export function normalizePersonalizationVariables(
  raw: PersonalizationVariables = {},
  options?: { recipientEmail?: string; now?: Date },
): Record<string, string> {
  const email = trimString(raw.email || raw.recipient_email || options?.recipientEmail);
  const businessName = trimString(raw.business_name || raw.company || raw.businessName);
  const leadName = trimString(raw.lead_name || raw.leadName);
  const clientName = trimString(raw.client_name || raw.clientName);
  const contactName = trimString(raw.contact_name || raw.contactName || raw.name);
  const name = trimString(raw.name) || contactName || leadName || clientName || splitName(email).firstName;
  const firstName = trimString(raw.first_name || raw.firstName) || splitName(name).firstName || splitName(email).firstName;
  const lastName = trimString(raw.last_name || raw.lastName) || splitName(name).lastName;

  const greetingName = firstName || GREETING_FALLBACKS[0];
  const greeting = `${timeOfDayGreeting(options?.now)}, ${greetingName}.`;

  const stringVars: Record<string, string> = {
    first_name: firstName || GREETING_FALLBACKS[0],
    last_name: lastName,
    name: name || email || 'Recipient',
    email,
    business_name: businessName || 'your business',
    company: businessName || 'your business',
    lead_name: leadName || name || 'your lead',
    client_name: clientName || businessName || 'your client',
    contact_name: contactName || name || 'your contact',
    invoice_number: trimString(raw.invoice_number || raw.invoiceNumber) || '—',
    invoice_amount: trimString(raw.invoice_amount || raw.invoiceAmount) || '—',
    meeting_time: trimString(raw.meeting_time || raw.meetingTime) || 'soon',
    campaign_name: trimString(raw.campaign_name || raw.campaignName) || 'your campaign',
    reply_count: trimString(raw.reply_count ?? raw.replyCount ?? '0'),
    lead_count: trimString(raw.lead_count ?? raw.leadCount ?? '0'),
    deal_value: trimString(raw.deal_value || raw.dealValue) || '—',
    cta_url: trimString(raw.cta_url || raw.ctaUrl) || '#',
    greeting,
    greeting_name: greetingName,
  };

  for (const [key, value] of Object.entries(raw)) {
    if (stringVars[key] !== undefined) continue;
    if (value === null || value === undefined) {
      stringVars[key] = '';
    } else if (typeof value === 'boolean') {
      stringVars[key] = value ? 'yes' : 'no';
    } else {
      stringVars[key] = trimString(value);
    }
  }

  return stringVars;
}

export function applyPersonalizationTemplate(
  template: string,
  variables: PersonalizationVariables,
  options?: { recipientEmail?: string },
): string {
  const normalized = normalizePersonalizationVariables(variables, { recipientEmail: options?.recipientEmail });
  let output = String(template || '');

  for (const [key, value] of Object.entries(normalized)) {
    const snake = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'gi');
    const camel = new RegExp(`{{\\s*${escapeRegExp(key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()))}\\s*}}`, 'g');
    output = output.replace(snake, value).replace(camel, value);
  }

  output = resolveCampaignMergeTags(output, buildCampaignMergeContext({
    firstName: normalized.first_name,
    lastName: normalized.last_name,
    name: normalized.name,
    email: normalized.email,
    company: normalized.business_name,
    clientName: normalized.client_name,
  }));

  // Strip any remaining unresolved merge tags
  output = output.replace(/{{\s*[\w.]+\s*}}/g, '');
  return output.trim();
}

export function renderSubjectAndPreheader(
  subjectTemplate: string,
  preheaderTemplate: string | undefined,
  variables: PersonalizationVariables,
  options?: { recipientEmail?: string },
): { subject: string; preheader: string } {
  const subject = applyPersonalizationTemplate(subjectTemplate, variables, options);
  const preheader = preheaderTemplate
    ? applyPersonalizationTemplate(preheaderTemplate, variables, options)
    : '';
  return { subject, preheader };
}
