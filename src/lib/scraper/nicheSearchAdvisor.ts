import type { ParsedLeadIntent } from '@/lib/scraper/parseLeadIntent';

const BROADEN_STEPS = [
  { label: 'widen location radius', apply: (i: ParsedLeadIntent) => ({ ...i, location: { ...i.location, radius_km: (i.location.radius_km || 25) + 25 } }) },
  { label: 'add GitHub + job boards', apply: (i: ParsedLeadIntent) => ({ ...i, sources: [...new Set([...i.sources, 'github', 'job_boards'])] }) },
  { label: 'lower score threshold', apply: (i: ParsedLeadIntent) => ({ ...i, min_score_threshold: Math.max(25, i.min_score_threshold - 15) }) },
  { label: 'expand to directory-only sweep', apply: (i: ParsedLeadIntent) => ({ ...i, sources: ['directory', 'website'], daily_limit: Math.min(i.daily_limit + 20, 80) }) },
];

export function broadenIntentForRetry(
  intent: ParsedLeadIntent,
  attempt: number
): ParsedLeadIntent {
  let broadened = { ...intent };
  for (let i = 0; i <= attempt && i < BROADEN_STEPS.length; i++) {
    broadened = BROADEN_STEPS[i].apply(broadened);
  }
  broadened.name = `${intent.name} (retry ${attempt + 1})`;
  return broadened;
}

export function getNicheSearchAdvice(
  intent: ParsedLeadIntent,
  leadCount: number,
  attempt: number
): string {
  const niche = intent.industry?.[0] || intent.search_query || 'your niche';
  const location = intent.location?.city || intent.location?.country || 'the area';

  if (leadCount > 0) {
    return `Found ${leadCount} SMB leads for "${niche}" in ${location}. Select leads to qualify, save to CRM, or start email automation.`;
  }

  if (attempt < 2) {
    return `No SMB matches yet for "${niche}" in ${location}. I'll broaden the search — trying more sources and a wider area. Hang tight.`;
  }

  return [
    `I searched "${niche}" in ${location} but didn't find enough SMB leads after ${attempt + 1} attempts.`,
    '',
    '**Try this:**',
    `• Use a broader niche (e.g. "${niche} services" instead of a hyper-specific sub-niche)`,
    '• Add a nearby city or expand the region',
    '• Target owner/founder titles instead of C-suite at large firms',
    '• We intentionally skip big corporations — this tool is built for SMB outreach',
    '',
    'Want me to retry with a different niche or location? Just tell me.',
  ].join('\n');
}

export function extractNicheFromMessage(message: string): string | null {
  const nicheMatch = message.match(/\b(niche|industry|sector)\s*(?:is|:)?\s*["']?([^"'\n,.]+)/i);
  if (nicheMatch) return nicheMatch[2].trim();
  const findMatch = message.match(/find\s+(.+?)\s+(?:in|near|around|at)\s+/i);
  if (findMatch) return findMatch[1].trim();
  return null;
}
