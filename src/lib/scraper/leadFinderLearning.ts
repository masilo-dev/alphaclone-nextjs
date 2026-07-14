import { getMemory, upsertMemory } from '@/services/nexusMemoryService';
import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';

export type LeadFinderSearchRecord = {
  niche: string;
  location: string;
  leadCount: number;
  campaignId?: string;
  at: string;
};

export type LeadFinderProfile = {
  niche: string;
  location: string;
  minScore: number;
  preferEmail: boolean;
  lastSearch?: LeadFinderSearchRecord;
  topNiches: Array<{ niche: string; location: string; avgLeads: number; runs: number }>;
  totalSearches: number;
  totalLeadsFound: number;
  learnedMessage: string;
};

const HISTORY_KEY = 'lead_finder_search_history';
const CRITERIA_KEY = 'lead_qualification_criteria';

function parseHistory(value: unknown): LeadFinderSearchRecord[] {
  if (!value || typeof value !== 'object') return [];
  const searches = (value as { searches?: LeadFinderSearchRecord[] }).searches;
  return Array.isArray(searches) ? searches : [];
}

function aggregateTopNiches(searches: LeadFinderSearchRecord[]) {
  const map = new Map<string, { niche: string; location: string; total: number; runs: number }>();
  for (const s of searches) {
    if (s.leadCount < 1) continue;
    const key = `${s.niche.toLowerCase()}::${s.location.toLowerCase()}`;
    const cur = map.get(key) || { niche: s.niche, location: s.location, total: 0, runs: 0 };
    cur.total += s.leadCount;
    cur.runs += 1;
    map.set(key, cur);
  }
  return Array.from(map.values())
    .map((e) => ({ niche: e.niche, location: e.location, avgLeads: Math.round(e.total / e.runs), runs: e.runs }))
    .sort((a, b) => b.avgLeads * b.runs - a.avgLeads * a.runs)
    .slice(0, 5);
}

export async function getLeadFinderProfile(tenantId: string): Promise<LeadFinderProfile> {
  const [criteriaRows, historyRows] = await Promise.all([
    getMemory(tenantId, { key: CRITERIA_KEY, category: 'preference' }),
    getMemory(tenantId, { key: HISTORY_KEY, category: 'pattern' }),
  ]);

  const criteria = (criteriaRows[0]?.value || {}) as Record<string, unknown>;
  const history = parseHistory(historyRows[0]?.value);
  const topNiches = aggregateTopNiches(history);
  const lastSearch = history[0];
  const totalLeadsFound = history.reduce((sum, s) => sum + s.leadCount, 0);

  const industryRaw = criteria.industry;
  const industryFirst = Array.isArray(industryRaw) ? String(industryRaw[0] || '') : '';
  const niche =
    String(criteria.niche || industryFirst || topNiches[0]?.niche || lastSearch?.niche || '').trim();
  const locObj = criteria.location as { city?: string; country?: string } | undefined;
  const location =
    [locObj?.city, locObj?.country].filter(Boolean).join(', ') ||
    topNiches[0]?.location ||
    lastSearch?.location ||
    '';

  let learnedMessage = 'Tell me your niche once — I will remember it for next time.';
  if (topNiches.length > 0) {
    const best = topNiches[0];
    learnedMessage = `I learn from your searches. Best results so far: **${best.niche}** in **${best.location}** (~${best.avgLeads} leads per run).`;
  } else if (niche && location) {
    learnedMessage = `Saved profile: **${niche}** in **${location}**. Click "Find leads for me" to search without retyping.`;
  } else if (niche) {
    learnedMessage = `Saved niche: **${niche}**. Add a city or use "Find leads for me".`;
  }

  return {
    niche,
    location,
    minScore: Number(criteria.min_score_threshold) || 45,
    preferEmail: true,
    lastSearch,
    topNiches,
    totalSearches: history.length,
    totalLeadsFound,
    learnedMessage,
  };
}

export async function recordLeadFinderSearch(
  tenantId: string,
  input: { niche: string; location: string; leadCount: number; campaignId?: string; intent?: ParsedLeadIntent }
): Promise<void> {
  const historyRows = await getMemory(tenantId, { key: HISTORY_KEY, category: 'pattern' });
  const history = parseHistory(historyRows[0]?.value);

  const record: LeadFinderSearchRecord = {
    niche: input.niche.trim() || 'local business',
    location: input.location.trim() || 'nearby',
    leadCount: input.leadCount,
    campaignId: input.campaignId,
    at: new Date().toISOString(),
  };

  await upsertMemory(tenantId, {
    category: 'pattern',
    key: HISTORY_KEY,
    value: { searches: [record, ...history].slice(0, 40) },
    source: 'agent',
    confidence: Math.min(0.95, 0.5 + input.leadCount / 40),
  });

  if (input.intent && input.leadCount >= 1) {
    await upsertMemory(tenantId, {
      category: 'preference',
      key: CRITERIA_KEY,
      value: input.intent as unknown as Record<string, unknown>,
      source: 'agent',
      confidence: 0.85,
    });
  }
}

export async function recordLeadFinderFeedback(
  tenantId: string,
  input: { action: 'save' | 'qualify' | 'contact' | 'reject'; count: number; grades?: string[] }
): Promise<void> {
  const key = 'lead_finder_feedback';
  const rows = await getMemory(tenantId, { key, category: 'pattern' });
  const existing = (rows[0]?.value?.events as Array<Record<string, unknown>>) || [];
  await upsertMemory(tenantId, {
    category: 'pattern',
    key,
    value: {
      events: [
        { ...input, at: new Date().toISOString() },
        ...existing,
      ].slice(0, 50),
    },
    source: 'agent',
  });
}

export function buildIntentFromProfile(profile: LeadFinderProfile): ParsedLeadIntent | null {
  if (!profile.niche.trim()) return null;
  const parts = profile.location.split(',').map((p) => p.trim()).filter(Boolean);
  const location =
    parts.length >= 2
      ? { city: parts[0], country: parts[parts.length - 1], radius_km: 25 }
      : profile.location
        ? { city: profile.location, radius_km: 25 }
        : { radius_km: 25 };

  return {
    name: `Auto: ${profile.niche.slice(0, 40)}`,
    sources: ['website', 'directory'],
    industry: [profile.niche],
    location,
    title_keywords: ['owner', 'founder', 'director', 'manager'],
    company_size_range: { min: 1, max: 200 },
    exclude_domains: [],
    exclude_keywords: ['enterprise', 'fortune 500', 'franchise'],
    min_score_threshold: profile.minScore,
    daily_limit: 40,
    enrichment_level: 'full',
    target_language: 'en',
    summary: `SMB ${profile.niche}${profile.location ? ` in ${profile.location}` : ''}`,
    search_query: `Find ${profile.niche} businesses${profile.location ? ` in ${profile.location}` : ''}`,
    niche: profile.niche,
    smb_only: true,
  };
}
