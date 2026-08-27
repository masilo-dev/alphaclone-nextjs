import parsePhoneNumberFromString, { type CountryCode } from 'libphonenumber-js/max';
import { z } from 'zod';

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
  sources: z.array(z.enum(['openstreetmap', 'website', 'public_directory', 'manual'])).min(1).max(4),
  requirements: z.object({
    website: z.boolean().default(false), email: z.boolean().default(false),
    phone: z.boolean().default(false), social: z.boolean().default(false),
  }).default({ website: false, email: false, phone: false, social: false }),
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

export function normalizeEmail(value?: string | null) {
  const email = value?.normalize('NFKC').trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function normalizePhone(value?: string | null, country?: string | null) {
  if (!value) return null;
  try {
    const defaultCountry = country?.trim().length === 2 ? country.toUpperCase() as CountryCode : undefined;
    const parsed = parsePhoneNumberFromString(value, defaultCountry);
    return parsed?.isValid() ? parsed.number : null;
  } catch {
    // Some worker transpilers do not preserve libphonenumber's CJS metadata binding.
    // Retain only already-international, plausible values in that environment.
    const international = value.trim().startsWith('+') ? `+${value.replace(/\D/g, '')}` : '';
    return /^\+[1-9]\d{7,14}$/.test(international) ? international : null;
  }
}

export function normalizeCompany(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ')
    .replace(/\b(incorporated|inc|limited|ltd|llc|gmbh|plc|pty)\.?$/i, '').trim().toLowerCase();
}

/** Stable dedupe key for lead_candidates upsert (must match DB unique constraint). */
export function buildLeadCandidateDedupeKey(input: {
  source_type: string;
  source_external_id?: string | null;
  website?: string | null;
  business_name: string;
  city?: string | null;
}): string {
  if (input.source_external_id) {
    return `${input.source_type}:${input.source_external_id}`;
  }
  const domain = normalizeDomain(input.website);
  if (domain) return `${input.source_type}:domain:${domain}`;
  const name = normalizeCompany(input.business_name).slice(0, 80);
  const city = (input.city || '').trim().toLowerCase().slice(0, 40);
  return `${input.source_type}:name:${name}:${city}`;
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
  if (candidate.website) quality.push({ points: 15, reason: 'Public website found' });
  if (normalizeDomain(candidate.website)) quality.push({ points: 10, reason: 'Website domain valid' });
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

export function escapeCsvFormula(value: unknown) {
  const text = String(value ?? '');
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
