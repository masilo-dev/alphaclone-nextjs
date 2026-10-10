import parsePhoneNumberFromString, { type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';
import { normalizePhoneNumber } from '../phone/phoneNormalizer';

export const SEARCH_TYPES = [
  'businesses_by_location', 'businesses_by_keyword', 'domain_discovery',
  'website_contact_discovery', 'public_directory_discovery',
  'public_social_discovery', 'csv_import', 'manual',
] as const;

export const leadSearchInput = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  searchType: z.enum(SEARCH_TYPES).default('businesses_by_location'),
  query: z.string().trim().max(300).optional().default(''),
  businessKeywords: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  location: z.string().trim().max(160).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(100).optional().default(''),
  region: z.string().trim().max(100).optional().default(''),
  industry: z.string().trim().max(120).optional().default(''),
  companySizeMin: z.number().int().min(0).max(1_000_000).nullable().optional(),
  companySizeMax: z.number().int().min(0).max(1_000_000).nullable().optional(),
  sources: z.array(z.enum(['openstreetmap', 'wikidata', 'searxng', 'website', 'public_directory', 'manual', 'apify'])).min(1).max(7),
  filterNoWebsite: z.boolean().default(false),
  requirements: z.object({
    website: z.boolean().default(false), email: z.boolean().default(false),
    phone: z.boolean().default(false), social: z.boolean().default(false),
    filterNoWebsite: z.boolean().default(false),
  }).default({ website: false, email: false, phone: false, social: false, filterNoWebsite: false }),
  exclusions: z.object({
    keywords: z.array(z.string().trim().max(100)).max(50).default([]),
    domains: z.array(z.string().trim().max(253)).max(50).default([]),
    locations: z.array(z.string().trim().max(160)).max(50).default([]),
  }).default({ keywords: [], domains: [], locations: [] }),
  resultLimit: z.number().int().min(1).max(500).default(50),
  runNow: z.boolean().default(true),
});

export function normalizeDomain(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return null;
  }
}

const COMMON_CONCATENATED_TLDS = /^(?:com|org|net|edu|gov|io|co|ai|biz|info|me|tv|zw|za|uk|de|fr|ca|au|in|app|dev|tech)([a-z]{2,})$/i;

export function normalizeEmail(value?: string | null) {
  const email = value?.normalize('NFKC').trim().toLowerCase();
  if (!email || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(email)) return null;
  if (/^(example@example\.com|test@test\.com|name@example\.com|user@domain\.com)$/.test(email)) return null;
  if (/\.(png|jpe?g|gif|svg|webp|ico)@/i.test(email)) return null;

  // Extract TLD and verify boundary / validity
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const domainParts = parts[1].split('.');
  const tld = domainParts[domainParts.length - 1];
  if (!tld || tld.length < 2 || tld.length > 24) return null;

  // Reject concatenated run-on words like comanswerrosemaryposted
  if (COMMON_CONCATENATED_TLDS.test(tld)) {
    return null;
  }

  return email;
}

export function normalizePhone(value?: string | null, country?: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const res = normalizePhoneNumber(trimmed, {
      country: country || undefined,
      location: country || undefined,
    });
    if (res.isValid && res.e164) {
      return res.e164;
    }
  } catch {
    // Fall back to direct parsePhoneNumberFromString if normalizer threw
  }

  try {
    const defaultCountry = country?.trim().length === 2 ? country.toUpperCase() as CountryCode : undefined;
    const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    const international = trimmed.startsWith('+') ? `+${trimmed.replace(/\D/g, '')}` : '';
    return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
  }
}

export function normalizeCompany(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
    .replace(/\b(incorporated|inc|limited|ltd|llc|gmbh|plc|pty)\.?$/i, '').trim().toLowerCase();
}

const NON_BUSINESS_PATTERNS = [
  /\b(top|best|leading|trusted|recommended)\s+\d+\b/i,
  /\b\d+\s+(top|best|leading|trusted)\b/i,
  /\b(top|best)\s+.*\s+(in|near|around)\b/i,
  /\bbusiness\s+directory\b/i,
  /\byellow\s*pages\b/i,
  /\bsearch\s+results?\b/i,
  /\b(category|categories)\b/i,
  /\bnear\s+me\b/i,
  /\blinkedin\s+search\b/i,
  /\bfacebook\s+search\b/i,
  /\bgoogle\s+search\b/i,
  /\b(companies|firms|services|agencies|businesses|contractors)\s+in\s+[a-z\s-]+/i,
  /\blist\s+of\s+[a-z\s-]+/i,
  /\b(aeroleads|clutch|yelp|tripadvisor|trustpilot|bbb|zoominfo|apollo\.io|kompass|cybo|hotfrog|africabizinfo|africa2trust)\b/i,
];

const KNOWN_AGGREGATOR_DOMAINS = new Set([
  'aeroleads.com', 'clutch.co', 'yellowpages.com', 'yellowpages.co.zw',
  'yelp.com', 'tripadvisor.com', 'trustpilot.com', 'bbb.org',
  'zoominfo.com', 'dnb.com', 'apollo.io', 'kompass.com', 'cybo.com',
  'hotfrog.com', 'africabizinfo.com', 'africa2trust.com', 'yell.com',
  'cylex.com', 'bark.com', 'thumbtack.com', 'angi.com',
]);

export type EntityResolution = {
  isRealBusiness: boolean;
  canonicalName: string | null;
  canonicalDomain: string | null;
  reason: 'ok' | 'missing_name' | 'directory_or_search_result';
};

/** Reject list/article/search-page labels before they can become CRM entities. */
export function resolveBusinessEntity(input: { businessName?: string | null; website?: string | null; sourceUrl?: string | null }): EntityResolution {
  const rawName = String(input.businessName || '').trim();
  const domain = normalizeDomain(input.website) || normalizeDomain(input.sourceUrl);
  if (!rawName) return { isRealBusiness: false, canonicalName: null, canonicalDomain: domain, reason: 'missing_name' };

  if (domain && KNOWN_AGGREGATOR_DOMAINS.has(domain)) {
    return { isRealBusiness: false, canonicalName: null, canonicalDomain: domain, reason: 'directory_or_search_result' };
  }

  const source = `${rawName} ${String(input.sourceUrl || '')}`;
  if (NON_BUSINESS_PATTERNS.some((pattern) => pattern.test(source))) {
    return { isRealBusiness: false, canonicalName: null, canonicalDomain: domain, reason: 'directory_or_search_result' };
  }
  return { isRealBusiness: true, canonicalName: normalizeCompany(rawName), canonicalDomain: domain, reason: 'ok' };
}

export function buildCanonicalBusinessKey(input: {
  email?: string | null; website?: string | null; phone?: string | null;
  sourceExternalId?: string | null; businessName: string; city?: string | null; country?: string | null;
}) {
  const email = normalizeEmail(input.email);
  if (email) return `email:${email}`;
  const domain = normalizeDomain(input.website);
  if (domain) return `domain:${domain}`;
  const phone = normalizePhone(input.phone, input.country);
  if (phone) return `phone:${phone}`;
  const name = normalizeCompany(input.businessName);
  const place = `${String(input.city || '').trim().toLowerCase()}:${String(input.country || '').trim().toLowerCase()}`;
  if (name) return `business:${name}:${place}`;
  return `external:${String(input.sourceExternalId || 'unknown').trim().toLowerCase()}`;
}

/** Stable dedupe key for lead_candidates upsert (must match DB unique constraint). */
export function buildLeadCandidateDedupeKey(input: {
  source_type: string;
  source_external_id?: string | null;
  website?: string | null;
  business_name: string;
  city?: string | null;
}): string {
  const domain = normalizeDomain(input.website);
  if (domain) return `domain:${domain}`;
  if (input.source_external_id) return `external:${input.source_external_id}`;
  const name = normalizeCompany(input.business_name).slice(0, 80);
  const city = (input.city || '').trim().toLowerCase().slice(0, 40);
  return `business:${name}:${city}`;
}

export type ScoreCandidate = {
  website?: string | null; public_email?: string | null; public_phone?: string | null;
  address_line_1?: string | null; facebook_url?: string | null; linkedin_url?: string | null;
  instagram_url?: string | null; industry?: string | null; city?: string | null;
  business_name: string;
};

export function scoreCandidate(candidate: ScoreCandidate, search: {
  industry?: string | null; city?: string | null; location?: string | null;
  business_keywords?: string[] | null; exclusions?: { keywords?: string[] };
}) {
  const quality: Array<{ points: number; reason: string }> = [];
  const fit: Array<{ points: number; reason: string }> = [];
  if (candidate.website) {
    quality.push({ points: 15, reason: 'Public website found' });
    if (normalizeDomain(candidate.website)) quality.push({ points: 10, reason: 'Website domain valid' });
  } else {
    // Prime digital opportunity for AlphaClone (custom website, client portal & booking system prospect)
    quality.push({ points: 25, reason: 'No website found — prime custom web & booking development opportunity' });
  }
  if (normalizeEmail(candidate.public_email)) quality.push({ points: 20, reason: 'Public email format valid' });
  if (candidate.public_phone) quality.push({ points: 15, reason: 'Public phone found' });
  if (candidate.address_line_1) quality.push({ points: 10, reason: 'Physical address found' });
  if (candidate.facebook_url || candidate.linkedin_url || candidate.instagram_url) quality.push({ points: 10, reason: 'Public social profile found' });
  quality.push({ points: 10, reason: 'Traceable public source' });

  if (search.industry && candidate.industry?.toLowerCase().includes(search.industry.toLowerCase()))
    fit.push({ points: 25, reason: 'Industry match' });
  const location = `${candidate.city || ''}`.toLowerCase();
  if ([search.city, search.location].filter(Boolean).some(v => location.includes(String(v).toLowerCase())))
    fit.push({ points: 25, reason: 'Location match' });
  const haystack = `${candidate.business_name} ${candidate.industry || ''}`.toLowerCase();
  if (search.business_keywords?.some(k => haystack.includes(k.toLowerCase())))
    fit.push({ points: 20, reason: 'Keyword match' });
  for (const keyword of search.exclusions?.keywords || []) {
    if (haystack.includes(keyword.toLowerCase())) fit.push({ points: -30, reason: `Excluded keyword: ${keyword}` });
  }
  return {
    qualityScore: Math.max(0, Math.min(100, quality.reduce((n, x) => n + x.points, 0))),
    fitScore: Math.max(0, Math.min(100, fit.reduce((n, x) => n + x.points, 30))),
    explanation: [...quality.map(x => ({ ...x, type: 'quality' })), ...fit.map(x => ({ ...x, type: 'fit' }))],
  };
}

export function calculateCompositeLeadScore(input: {
  fit: number; contactability: number; quality: number; confidence: number; freshness: number; opportunity: number;
}) {
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  return Math.round(
    clamp(input.fit) * 0.25 + clamp(input.contactability) * 0.20 +
    clamp(input.quality) * 0.20 + clamp(input.confidence) * 0.15 +
    clamp(input.freshness) * 0.10 + clamp(input.opportunity) * 0.10
  );
}

export type LeadContactRequirements = {
  website?: boolean;
  email?: boolean;
  phone?: boolean;
  social?: boolean;
  filterNoWebsite?: boolean;
};

/** Apply the search contract after enrichment, before a candidate is persisted. */
export function candidateMeetsRequirements(
  candidate: ScoreCandidate,
  requirements: LeadContactRequirements = {}
): boolean {
  if (requirements.filterNoWebsite && Boolean(candidate.website && normalizeDomain(candidate.website))) {
    return false;
  }
  const email = normalizeEmail(candidate.public_email);
  const phone = normalizePhone(candidate.public_phone);
  // Contact requirements are qualification gates, not discovery gates. A business
  // without a contact method remains a candidate for later enrichment; it must
  // never be promoted to qualified CRM status until the configured gate passes.
  if (requirements.email && !email) return false;
  if (requirements.phone && !phone) return false;
  if (requirements.website && !normalizeDomain(candidate.website)) return false;
  if (
    requirements.social &&
    !candidate.facebook_url &&
    !candidate.linkedin_url &&
    !candidate.instagram_url
  ) return false;
  return true;
}

export function escapeCsvFormula(value: unknown) {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
