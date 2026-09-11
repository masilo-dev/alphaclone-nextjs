import { normalizeEmail, normalizePhone } from '@/lib/lead-finder/core';

export type LeadContactShape = {
  email?: string | null;
  phone?: string | null;
  public_email?: string | null;
  public_phone?: string | null;
  country?: string | null;
  enrichment_status?: string | null;
  verification_status?: string | null;
};

export type ContactabilityStatus = 'outreach_ready' | 'needs_enrichment';

/**
 * Canonical presentation gate for lead-finder results.
 * Discovery can retain enrichable businesses internally, but anything presented
 * as an actionable lead must have at least one real public contact method.
 */
export function getLeadContactability(lead: LeadContactShape): {
  status: ContactabilityStatus;
  email: string | null;
  phone: string | null;
  contactMethods: Array<'email' | 'phone'>;
} {
  const email = normalizeEmail(lead.public_email || lead.email || null);
  const phone = normalizePhone(lead.public_phone || lead.phone || null, lead.country || null);
  const contactMethods: Array<'email' | 'phone'> = [];
  if (email) contactMethods.push('email');
  if (phone) contactMethods.push('phone');

  return {
    status: contactMethods.length ? 'outreach_ready' : 'needs_enrichment',
    email,
    phone,
    contactMethods,
  };
}

export function isOutreachReadyLead(lead: LeadContactShape): boolean {
  return getLeadContactability(lead).status === 'outreach_ready';
}

export function partitionLeadResults<T extends LeadContactShape>(leads: T[]) {
  const outreachReady: T[] = [];
  const needsEnrichment: T[] = [];
  for (const lead of leads) {
    if (isOutreachReadyLead(lead)) outreachReady.push(lead);
    else needsEnrichment.push(lead);
  }
  return {
    outreachReady,
    needsEnrichment,
    counts: {
      discovered: leads.length,
      outreach_ready: outreachReady.length,
      needs_enrichment: needsEnrichment.length,
    },
  };
}
