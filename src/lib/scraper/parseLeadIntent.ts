import { callDeepSeek } from '@/lib/ai/deepseek';
import { SMB_DEFAULTS, applySmbDefaults } from '@/lib/scraper/smbLeadFilters';
import { extractNicheFromMessage } from '@/lib/scraper/nicheSearchAdvisor';

export interface ParsedLeadIntent {
  name: string;
  sources: string[];
  industry: string[];
  location: { city?: string; country?: string; radius_km?: number };
  title_keywords: string[];
  company_size_range: { min?: number; max?: number };
  exclude_domains: string[];
  exclude_keywords: string[];
  min_score_threshold: number;
  daily_limit: number;
  enrichment_level: 'basic' | 'full';
  target_language: string;
  summary: string;
  search_query: string;
  niche?: string;
  smb_only: boolean;
}

const VALID_SOURCES = [
  'website',
  'directory',
  'github',
  'linkedin',
  'twitter',
  'job_boards',
  'custom',
] as const;

const DEFAULT_INTENT: ParsedLeadIntent = {
  name: 'Chat lead search',
  sources: ['website', 'directory'],
  industry: [],
  location: {},
  title_keywords: ['owner', 'founder', 'director', 'manager'],
  company_size_range: SMB_DEFAULTS.company_size_range,
  exclude_domains: SMB_DEFAULTS.exclude_domains,
  exclude_keywords: SMB_DEFAULTS.exclude_keywords,
  min_score_threshold: SMB_DEFAULTS.min_score_threshold,
  daily_limit: SMB_DEFAULTS.daily_limit,
  enrichment_level: 'full',
  target_language: 'en',
  summary: 'SMB business lead search',
  search_query: '',
  smb_only: true,
};

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  try {
    return JSON.parse(raw.trim());
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function normalizeIntent(data: Record<string, unknown>, userMessage: string): ParsedLeadIntent {
  const sources = Array.isArray(data.sources)
    ? data.sources
        .map((s) => String(s).toLowerCase())
        .filter((s) => VALID_SOURCES.includes(s as (typeof VALID_SOURCES)[number]))
    : DEFAULT_INTENT.sources;

  const industry = Array.isArray(data.industry)
    ? data.industry.map(String)
    : data.industry
      ? [String(data.industry)]
      : [];

  const location =
    data.location && typeof data.location === 'object'
      ? (data.location as ParsedLeadIntent['location'])
      : typeof data.location === 'string'
        ? { city: data.location }
        : {};

  const title_keywords = Array.isArray(data.title_keywords)
    ? data.title_keywords.map(String)
    : data.title_keywords
      ? String(data.title_keywords).split(',').map((s) => s.trim())
      : [];

  return applySmbDefaults({
    name: String(data.name || `Search: ${userMessage.slice(0, 60)}`),
    sources: sources.length ? sources : DEFAULT_INTENT.sources,
    industry,
    location,
    title_keywords,
    company_size_range:
      data.company_size_range && typeof data.company_size_range === 'object'
        ? (data.company_size_range as ParsedLeadIntent['company_size_range'])
        : SMB_DEFAULTS.company_size_range,
    exclude_domains: Array.isArray(data.exclude_domains)
      ? data.exclude_domains.map(String)
      : SMB_DEFAULTS.exclude_domains,
    exclude_keywords: Array.isArray(data.exclude_keywords)
      ? data.exclude_keywords.map(String)
      : SMB_DEFAULTS.exclude_keywords,
    min_score_threshold: Number(data.min_score_threshold) || SMB_DEFAULTS.min_score_threshold,
    daily_limit: Math.min(Number(data.daily_limit) || SMB_DEFAULTS.daily_limit, 80),
    enrichment_level: data.enrichment_level === 'basic' ? 'basic' : 'full',
    target_language: String(data.target_language || 'en'),
    summary: String(data.summary || DEFAULT_INTENT.summary),
    search_query: String(data.search_query || userMessage),
    niche: String(data.niche || extractNicheFromMessage(userMessage) || industry[0] || ''),
    smb_only: data.smb_only !== false,
  }) as ParsedLeadIntent;
}

/** Rule-based intent when AI is unavailable — keeps Lead Finder working without paid providers. */
export function parseLeadIntentHeuristic(userMessage: string): ParsedLeadIntent {
  const niche =
    extractNicheFromMessage(userMessage) ||
    userMessage.match(/find\s+(.+?)\s+(?:in|near|around|at)\s+/i)?.[1]?.trim() ||
    userMessage.replace(/find|leads|businesses|companies|owners?/gi, '').trim().slice(0, 80) ||
    'local business';

  const locationMatch = userMessage.match(/\b(?:in|near|around|at)\s+([^.!?\n]+?)(?:\s+within\s+\d|\s*$|[.!?])/i);
  const locationRaw = locationMatch?.[1]?.trim().replace(/,?\s*within\s+\d+.*$/i, '').trim() || '';
  const parts = locationRaw.split(',').map((p) => p.trim()).filter(Boolean);
  const location: ParsedLeadIntent['location'] = {};
  if (parts.length >= 2) {
    location.city = parts[0];
    location.country = parts[parts.length - 1];
  } else if (locationRaw) {
    location.city = locationRaw;
  }
  const radiusMatch = userMessage.match(/\bwithin\s+(\d+)\s*k?m?\b/i) || userMessage.match(/\b(\d+)\s*km\b/i);
  const parsedRadius = radiusMatch ? Number(radiusMatch[1]) : 25;
  location.radius_km = Number.isFinite(parsedRadius)
    ? Math.min(Math.max(parsedRadius, 1), 100)
    : 25;

  const industry = niche.split(/\s+/).slice(0, 3).join(' ');

  return applySmbDefaults({
    ...DEFAULT_INTENT,
    name: `Search: ${niche.slice(0, 50)}`,
    niche,
    industry: industry ? [industry] : [],
    location,
    search_query: userMessage,
    summary: `SMB ${niche}${locationRaw ? ` in ${locationRaw}` : ''}`,
  }) as ParsedLeadIntent;
}

export async function parseLeadIntentFromChat(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<{ intent: ParsedLeadIntent; assistantReply: string }> {
  const historyText = conversationHistory
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = `You are a lead generation assistant for Alphaclone. Parse the user's request into a structured SMB lead search campaign.

CRITICAL RULES:
- Target SMALL and MID-SIZE businesses only (1-200 employees). NEVER target Fortune 500, mega-corps, or global enterprises.
- Exclude: Google, Microsoft, Apple, Amazon, banks, consulting giants, retail chains.
- Prefer: local businesses, startups, agencies, shops, clinics, trades, SMB SaaS.
- If user mentions a "niche", set industry and niche fields from that niche and search until results are found.
- Default title_keywords: owner, founder, director, manager (NOT Fortune 500 CEOs).

Conversation:
${historyText}

Latest user message:
${userMessage}

Respond with ONLY valid JSON:
{
  "name": "short campaign name",
  "niche": "the specific niche e.g. dental clinics",
  "sources": ["website","directory"],
  "industry": ["dental","healthcare"],
  "location": {"city":"Austin","country":"US","radius_km":25},
  "title_keywords": ["owner","founder","office manager"],
  "company_size_range": {"min":1,"max":200},
  "exclude_domains": ["google.com","microsoft.com"],
  "exclude_keywords": ["enterprise","fortune 500"],
  "min_score_threshold": 45,
  "daily_limit": 40,
  "enrichment_level": "full",
  "target_language": "en",
  "smb_only": true,
  "summary": "one sentence SMB-focused plan",
  "search_query": "normalized search description",
  "assistant_reply": "friendly reply confirming SMB focus and asking to start search"
}`;

  try {
    let text = '';
    try {
      text = await callDeepSeek(prompt, {
        model: 'deepseek-chat',
        maxTokens: 1200,
        temperature: 0.2,
      });
    } catch (aiErr) {
      console.warn('[parseLeadIntent] DeepSeek failed, using heuristic parser:', aiErr);
      const intent = parseLeadIntentHeuristic(userMessage);
      return {
        intent,
        assistantReply: `I'll search for **${intent.niche || intent.summary}** using directory and website sources. Click **Start search** when ready.`,
      };
    }

    const parsed = extractJson(text);
    if (!parsed) {
      const intent = parseLeadIntentHeuristic(userMessage);
      return {
        intent,
        assistantReply:
          "I parsed your request locally. I'll search business directories and company websites for matching SMB leads. Click **Start search** when you're ready.",
      };
    }

    const intent = normalizeIntent(parsed, userMessage);
    const assistantReply = String(
      parsed.assistant_reply ||
        `I'll find ${intent.summary}. Sources: ${intent.sources.join(', ')}. Ready to start?`
    );

    return { intent, assistantReply };
  } catch {
    const intent = parseLeadIntentHeuristic(userMessage);
    return {
      intent,
      assistantReply:
        "I'll run a lead search using directories and company websites based on your description. Click **Start search** to begin.",
    };
  }
}
