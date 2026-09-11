export type EmailClassification = 'Marketing' | 'Lead' | 'Client' | 'Unverified' | 'Direct';

export type EmailClassificationInput = {
  from?: string;
  headers?: Record<string, string | string[] | undefined>;
  senderDomain?: string;
  isKnownLead?: boolean;
  isKnownClient?: boolean;
  spfFailed?: boolean;
  dkimFailed?: boolean;
};

function headerValue(headers: Record<string, string | string[] | undefined>, key: string): string {
  const raw = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(raw)) return raw.join(' ');
  return String(raw || '');
}

function extractDomain(from: string): string | null {
  const match = from.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  return match?.[1]?.toLowerCase() ?? null;
}

/** Classify an inbound email from headers and CRM context. */
export function classifyEmail(input: EmailClassificationInput): EmailClassification {
  const headers = input.headers || {};
  const xMailer = headerValue(headers, 'X-Mailer').toLowerCase();
  const listUnsub = headerValue(headers, 'List-Unsubscribe');
  const precedence = headerValue(headers, 'Precedence').toLowerCase();

  if (
    listUnsub ||
    precedence === 'bulk' ||
    precedence === 'list' ||
    xMailer.includes('mailchimp') ||
    xMailer.includes('campaign')
  ) {
    return 'Marketing';
  }

  if (input.spfFailed || input.dkimFailed) {
    return 'Unverified';
  }

  if (input.isKnownClient) return 'Client';
  if (input.isKnownLead) return 'Lead';

  return 'Direct';
}

export function classifyEmailFromAddress(
  from: string,
  options?: { isKnownLead?: boolean; isKnownClient?: boolean }
): EmailClassification {
  const domain = extractDomain(from);
  return classifyEmail({
    from,
    senderDomain: domain ?? undefined,
    isKnownLead: options?.isKnownLead,
    isKnownClient: options?.isKnownClient,
  });
}
