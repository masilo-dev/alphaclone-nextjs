import 'server-only';

export interface LeadSearchInput { query: string; industry?: string; location?: string; country?: string; resultLimit: number }
export interface DiscoveredBusiness {
  source: string; sourceId?: string; businessName: string; website?: string; sourceUrl?: string;
  phone?: string; email?: string; address?: string; city?: string; region?: string; country?: string;
  lat?: number; lng?: number; category?: string; description?: string;
  socialUrls?: { linkedin?: string; facebook?: string; instagram?: string }; rawData?: unknown;
}
export interface LeadDiscoveryResult { businesses: DiscoveredBusiness[]; metadata?: Record<string, unknown> }
export interface LeadDiscoveryProvider { id: string; enabled(): boolean; search(input: LeadSearchInput): Promise<LeadDiscoveryResult> }

export const searxngProvider: LeadDiscoveryProvider = {
  id: 'searxng',
  enabled: () => process.env.SEARXNG_ENABLED === 'true' && Boolean(process.env.SEARXNG_BASE_URL),
  async search(input) {
    if (!this.enabled()) return { businesses: [], metadata: { status: 'skipped', reason: 'not_configured' } };
    const base = new URL(String(process.env.SEARXNG_BASE_URL));
    const url = new URL('/search', base); url.searchParams.set('q', [input.query, input.industry, input.location, input.country, 'contact'].filter(Boolean).join(' ')); url.searchParams.set('format', 'json');
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'AlphaClone-LeadFinder/1.0' }, signal: AbortSignal.timeout(9000) });
    if (!res.ok) throw new Error(`SEARXNG_${res.status}`);
    const data = await res.json() as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return { businesses: (data.results || []).slice(0, input.resultLimit).flatMap((row, i) => {
      if (!row.title || !row.url) return [];
      let website: string; try { website = new URL(row.url).origin; } catch { return []; }
      return [{ source: 'searxng', sourceId: `searxng:${i}:${website}`, businessName: row.title.replace(/\s*[-|].*$/, ''), website, sourceUrl: row.url, description: row.content, city: input.location, country: input.country, rawData: row } as DiscoveredBusiness];
    }) };
  },
};

export class LeadSourceRouter {
  constructor(private readonly providers: LeadDiscoveryProvider[]) {}
  async search(input: LeadSearchInput) {
    const enabled = this.providers.filter((p) => p.enabled());
    const settled = await Promise.allSettled(enabled.map(async (provider) => ({ provider: provider.id, started: Date.now(), result: await provider.search(input) })));
    const businesses: DiscoveredBusiness[] = []; const health: Record<string, unknown>[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') { businesses.push(...result.value.result.businesses); health.push({ provider: result.value.provider, status: 'success', results: result.value.result.businesses.length, duration_ms: Date.now() - result.value.started }); }
      else health.push({ provider: enabled[health.length]?.id || 'unknown', status: 'failed', error: result.reason instanceof Error ? result.reason.message : 'PROVIDER_FAILED' });
    }
    return { businesses, health };
  }
}
