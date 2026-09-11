export type CampaignMergeTagContext = {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  company?: string;
  fromName?: string;
  fromEmail?: string;
  senderName?: string;
  clientName?: string;
  clientCalendlyLink?: string;
};

const DEFAULT_SENDER_NAME = 'AlphaClone Systems';

function trimToString(value: unknown): string {
  return String(value ?? '').trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function splitName(name: string): { firstName: string; lastName: string } {
  const parts = trimToString(name).split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

function normalizeContext(context: CampaignMergeTagContext = {}): Required<Pick<CampaignMergeTagContext, 'firstName' | 'lastName' | 'name' | 'email' | 'company' | 'fromName' | 'fromEmail' | 'senderName' | 'clientName' | 'clientCalendlyLink'>> {
  const email = trimToString(context.email);
  const company = trimToString(context.company);
  const fromName = trimToString(context.fromName || context.senderName || DEFAULT_SENDER_NAME) || DEFAULT_SENDER_NAME;
  const senderName = trimToString(context.senderName || context.fromName || DEFAULT_SENDER_NAME) || DEFAULT_SENDER_NAME;
  const rawName = trimToString(context.name);
  const fallbackName = rawName || [context.firstName, context.lastName].map(trimToString).filter(Boolean).join(' ');
  const name = fallbackName || splitName(email).firstName || email || '';
  const firstName = trimToString(context.firstName || splitName(name).firstName || splitName(email).firstName);
  const lastName = trimToString(context.lastName || splitName(name).lastName);

  return {
    firstName,
    lastName,
    name,
    email,
    company,
    fromName,
    fromEmail: trimToString(context.fromEmail),
    senderName,
    clientName: trimToString(context.clientName),
    clientCalendlyLink: trimToString(context.clientCalendlyLink),
  };
}

export function resolveCampaignMergeTags(
  template: string,
  context?: CampaignMergeTagContext
): string {
  const body = String(template || '');
  if (!body) return '';

  const values = normalizeContext(context);
  const replacements: Record<string, string> = {
    firstName: values.firstName,
    lastName: values.lastName,
    name: values.name,
    email: values.email,
    company: values.company,
    fromName: values.fromName,
    fromEmail: values.fromEmail,
    senderName: values.senderName,
    clientName: values.clientName,
    clientCalendlyLink: values.clientCalendlyLink,
  };

  let output = body;
  for (const [key, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{\\s*${escapeRegExp(key)}\\s*}}`, 'g');
    output = output.replace(pattern, value);
  }

  return output;
}

export function buildCampaignMergeContext(context: CampaignMergeTagContext = {}): CampaignMergeTagContext {
  const normalized = normalizeContext(context);
  return {
    ...normalized,
  };
}
