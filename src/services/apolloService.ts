import { ENV } from '@/config/env';

export interface ApolloPeopleMatchInput {
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  domain?: string;
  organizationName?: string;
  linkedinUrl?: string;
  revealPersonalEmails?: boolean;
  revealPhoneNumber?: boolean;
}

export interface ApolloPeopleMatchResult {
  matched: boolean;
  raw: unknown;
  person: {
    firstName?: string;
    lastName?: string;
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
    linkedinUrl?: string;
    organizationName?: string;
    domain?: string;
  } | null;
}

function normalizeApolloPerson(payload: any, fallback: ApolloPeopleMatchInput): ApolloPeopleMatchResult['person'] {
  const person = payload?.person || payload?.contact || payload?.match || payload?.data?.person || payload?.data?.contact || payload;
  if (!person || typeof person !== 'object') return null;

  const organization = person.organization || person.company || person.account || {};
  const name = String(person.name || [person.first_name, person.last_name].filter(Boolean).join(' ') || fallback.name || '').trim();

  return {
    firstName: person.first_name || person.firstName || undefined,
    lastName: person.last_name || person.lastName || undefined,
    name: name || undefined,
    title: person.title || person.job_title || undefined,
    email: person.email || person.email_address || undefined,
    phone: person.phone || person.phone_number || undefined,
    linkedinUrl: person.linkedin_url || person.linkedinUrl || undefined,
    organizationName:
      organization.name ||
      person.organization_name ||
      person.company_name ||
      fallback.organizationName ||
      undefined,
    domain: organization.website_domain || person.domain || fallback.domain || undefined,
  };
}

export const apolloService = {
  async matchPerson(input: ApolloPeopleMatchInput): Promise<ApolloPeopleMatchResult | null> {
    const apiKey = ENV.APOLLO_API_KEY || process.env.APOLLO_API_KEY || '';
    if (!apiKey) return null;

    const url = new URL('https://api.apollo.io/api/v1/people/match');
    if (input.firstName) url.searchParams.set('first_name', input.firstName);
    if (input.lastName) url.searchParams.set('last_name', input.lastName);
    if (input.name) url.searchParams.set('name', input.name);
    if (input.email) url.searchParams.set('email', input.email);
    if (input.domain) url.searchParams.set('domain', input.domain);
    if (input.organizationName) url.searchParams.set('organization_name', input.organizationName);
    if (input.linkedinUrl) url.searchParams.set('linkedin_url', input.linkedinUrl);
    if (input.revealPersonalEmails) url.searchParams.set('reveal_personal_emails', 'true');
    if (input.revealPhoneNumber) url.searchParams.set('reveal_phone_number', 'true');

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });

    const raw = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(raw?.error || raw?.message || 'Apollo people enrichment failed');
    }

    const person = normalizeApolloPerson(raw, input);
    return {
      matched: !!person,
      raw,
      person,
    };
  },
};
