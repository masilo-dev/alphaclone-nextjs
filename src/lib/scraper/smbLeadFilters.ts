/**
 * SMB-focused lead filters — excludes enterprise / Fortune 500 targets.
 * Lead Finder is built for small businesses, local shops, startups, and SMBs.
 */

export const ENTERPRISE_DOMAIN_BLOCKLIST = [
  'google.com', 'microsoft.com', 'apple.com', 'amazon.com', 'meta.com', 'facebook.com',
  'netflix.com', 'salesforce.com', 'oracle.com', 'ibm.com', 'accenture.com', 'deloitte.com',
  'pwc.com', 'kpmg.com', 'ey.com', 'mckinsey.com', 'bcg.com', 'bain.com',
  'walmart.com', 'target.com', 'costco.com', 'jpmorgan.com', 'goldmansachs.com',
  'bankofamerica.com', 'wellsfargo.com', 'citi.com', 'hsbc.com', 'barclays.com',
];

/** Name patterns for known mega-corps only — do NOT block "Inc." / "LLC" on normal SMBs. */
export const ENTERPRISE_NAME_PATTERNS = [
  /\b(fortune\s*500|conglomerate|multinational\s+holding)\b/i,
  /\b(Google|Microsoft|Apple|Amazon|Meta|Facebook|Netflix|Salesforce|Oracle|IBM|Accenture)\b/,
  /\b(Walmart|Target|Costco|JPMorgan|Goldman Sachs|Bank of America|Deloitte|PwC|KPMG|Ernst\s*&?\s*Young)\b/i,
];

export const SMB_DEFAULTS = {
  company_size_range: { min: 1, max: 200 },
  min_score_threshold: 35,
  daily_limit: 40,
  exclude_domains: ENTERPRISE_DOMAIN_BLOCKLIST,
  exclude_keywords: ['enterprise', 'fortune 500', 'global headquarters', 'conglomerate'],
};

export interface LeadLike {
  id?: string;
  name?: string | null;
  company?: string | null;
  email?: string | null;
  company_website?: string | null;
  company_size?: number | null;
  title?: string | null;
  phone?: string | null;
  industry?: string | null;
  score?: number | null;
  grade?: string | null;
  source?: string | null;
}

export function isEnterpriseLead(lead: LeadLike): boolean {
  const company = (lead.company || lead.name || '').toLowerCase();
  const website = (lead.company_website || lead.email?.split('@')[1] || '').toLowerCase();

  if (lead.company_size && lead.company_size > 250) return true;

  for (const domain of ENTERPRISE_DOMAIN_BLOCKLIST) {
    if (website.includes(domain)) return true;
  }

  for (const pattern of ENTERPRISE_NAME_PATTERNS) {
    if (pattern.test(company)) return true;
  }

  const enterpriseTitles = ['chief executive officer at fortune', 'board member at'];
  const title = (lead.title || '').toLowerCase();
  if (enterpriseTitles.some((t) => title.includes(t))) return true;

  return false;
}

export function filterSmbLeads<T extends LeadLike>(leads: T[]): T[] {
  return leads.filter((l) => !isEnterpriseLead(l));
}

export function applySmbDefaults<T extends Record<string, unknown>>(intent: T): T {
  return {
    ...intent,
    company_size_range: intent.company_size_range || SMB_DEFAULTS.company_size_range,
    min_score_threshold: intent.min_score_threshold ?? SMB_DEFAULTS.min_score_threshold,
    daily_limit: Math.min(Number(intent.daily_limit) || SMB_DEFAULTS.daily_limit, 80),
    exclude_domains: [
      ...SMB_DEFAULTS.exclude_domains,
      ...((intent.exclude_domains as string[]) || []),
    ],
  };
}
