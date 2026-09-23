/**
 * Pluggable Source Adapter Architecture for Lead Discovery and Research.
 */

import { normalizeBusinessName, normalizeDomain, normalizePhone } from './normalization';
import { validateSafeUrl } from './security';
import type { ResearchSource } from './types';

export type DiscoveredBusiness = {
  business_name: string;
  website?: string | null;
  phone?: string | null;
  location?: string | null;
  industry?: string | null;
  source_url?: string | null;
  source_type: string;
  raw?: Record<string, unknown>;
};

/**
 * OpenStreetMap directory adapter (ethical, public open-data discovery)
 */
export class OpenStreetMapSourceAdapter implements ResearchSource {
  name = 'OpenStreetMap Directory';
  type = 'osm';

  async discover(params: {
    query: string;
    location?: string;
    limit: number;
  }): Promise<DiscoveredBusiness[]> {
    const { query, location, limit = 50 } = params;
    const results: DiscoveredBusiness[] = [];

    // Fall back to Nominatim open-data geocoding/POI search
    try {
      const q = [query, location].filter(Boolean).join(' in ');
      const endpoint = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        q
      )}&format=json&addressdetails=1&extratags=1&limit=${Math.min(limit, 100)}`;

      const res = await fetch(endpoint, {
        headers: {
          'User-Agent': 'AlphaClone-BusinessResearch/2.0 (research@alphaclone.app)',
        },
        signal: AbortSignal.timeout(9000),
      });

      if (res.ok) {
        const items = (await res.json()) as Array<Record<string, unknown>>;
        for (const item of items) {
          const extra = (item.extratags as Record<string, string>) || {};
          const address = (item.address as Record<string, string>) || {};
          const name = String(item.namedetails && (item.namedetails as Record<string, string>).name || item.name || item.display_name || '').split(',')[0].trim();
          if (!name) continue;

          const website = extra.website || extra['contact:website'] || extra.url || null;
          const phone = extra.phone || extra['contact:phone'] || null;
          const city = address.city || address.town || address.village || address.suburb || location || null;

          results.push({
            business_name: normalizeBusinessName(name),
            website: website && validateSafeUrl(website).safe ? website : null,
            phone: normalizePhone(phone),
            location: [city, address.country].filter(Boolean).join(', ') || null,
            industry: extra.amenity || extra.shop || extra.craft || query || null,
            source_url: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}`,
            source_type: 'openstreetmap',
            raw: item,
          });
        }
      }
    } catch {
      // Graceful fallback if external OSM service is rate limited
    }

    return results.slice(0, limit);
  }
}

/**
 * Public Website Source Adapter
 * Directly processes target domains or company websites.
 */
export class PublicWebsiteSourceAdapter implements ResearchSource {
  name = 'Public Business Websites';
  type = 'public_websites';

  async discover(params: {
    query: string;
    location?: string;
    limit: number;
  }): Promise<DiscoveredBusiness[]> {
    // If the query contains a domain or URL, discover it directly
    const domain = normalizeDomain(params.query);
    if (domain) {
      return [
        {
          business_name: normalizeBusinessName(domain.split('.')[0]),
          website: `https://${domain}`,
          location: params.location || null,
          industry: null,
          source_url: `https://${domain}`,
          source_type: 'public_website',
        },
      ];
    }
    return [];
  }
}

/**
 * Public Business Directory Adapter
 * High-precision adapter querying public company and open business registries.
 */
export class PublicBusinessDirectoryAdapter implements ResearchSource {
  name = 'Public Business Directory';
  type = 'directories';

  async discover(params: {
    query: string;
    location?: string;
    limit: number;
  }): Promise<DiscoveredBusiness[]> {
    const { query, location, limit = 50 } = params;
    const results: DiscoveredBusiness[] = [];

    // Synthesize structured candidates based on verified query & location
    const cleanQuery = query.replace(/[^\w\s]/g, '').trim();
    const cleanLoc = (location || '').replace(/[^\w\s,]/g, '').trim();

    if (cleanQuery) {
      // Use internal geo/business fallback index
      try {
        const { runLeadStep } = await import('@/lib/scraper/freeLeadSearch');
        let step: 'init' | 'fallbacks' | 'browser' | 'finalize' = 'init';
        let partialResults: import('@/lib/scraper/freeLeadSearch').LeadResult[] = [];
        let sourceStats: Record<string, number> = {};
        let sourceErrors: Record<string, string> = {};
        let finalResults: import('@/lib/scraper/freeLeadSearch').LeadResult[] = [];

        for (let attempt = 0; attempt < 4; attempt += 1) {
          const searchStep = await runLeadStep({
            step,
            niche: cleanQuery,
            location: cleanLoc,
            radiusKm: 50,
            sortBy: 'reach_asc',
            usePlaywright: false,
            partialResults,
            sourceStats,
            sourceErrors,
            resultLimit: limit,
          });
          partialResults = searchStep.partialResults;
          sourceStats = searchStep.sourceStats;
          sourceErrors = searchStep.sourceErrors;
          if (searchStep.nextStep === 'completed') {
            finalResults = searchStep.finalResults.length ? searchStep.finalResults : partialResults;
            break;
          }
          step = searchStep.nextStep;
        }

        for (const item of finalResults.length ? finalResults : partialResults) {
          results.push({
            business_name: normalizeBusinessName(item.business_name),
            website: item.website || null,
            phone: normalizePhone(item.phone),
            location: item.address || cleanLoc || null,
            industry: item.category || cleanQuery,
            source_url: item.source_url || item.website || null,
            source_type: item.source || 'directory',
            raw: item as unknown as Record<string, unknown>,
          });
        }
      } catch {
        // Fallback silently if freeLeadSearch is unavailable in current context
      }
    }

    return results.slice(0, limit);
  }
}

const ADAPTER_REGISTRY: Record<string, ResearchSource> = {
  osm: new OpenStreetMapSourceAdapter(),
  openstreetmap: new OpenStreetMapSourceAdapter(),
  public_websites: new PublicWebsiteSourceAdapter(),
  website: new PublicWebsiteSourceAdapter(),
  directories: new PublicBusinessDirectoryAdapter(),
  directory: new PublicBusinessDirectoryAdapter(),
};

export function getSourceAdapter(type: string): ResearchSource {
  return ADAPTER_REGISTRY[type] || ADAPTER_REGISTRY.directories;
}

export function listAvailableSourceAdapters(): Array<{ type: string; name: string }> {
  return [
    { type: 'public_websites', name: 'Public Business Websites' },
    { type: 'osm', name: 'OpenStreetMap Directory (Public POIs)' },
    { type: 'directories', name: 'Public Business Directories' },
  ];
}
