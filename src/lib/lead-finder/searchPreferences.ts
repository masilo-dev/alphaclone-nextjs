export interface LeadFinderSettings {
  defaultResultLimit: number;
  requireEmail: boolean;
  requireWebsite: boolean;
  defaultSources: string[];
}
const allowedSources = new Set(['apify', 'openstreetmap', 'website', 'wikidata', 'searxng', 'public_directory', 'manual']);
export function normalizeLeadFinderSettings(value: unknown): LeadFinderSettings {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const sources = Array.isArray(input.defaultSources)
    ? [...new Set(input.defaultSources.filter((source): source is string => typeof source === 'string' && allowedSources.has(source)))]
    : [];
  return {
    defaultResultLimit: typeof input.defaultResultLimit === 'number' && Number.isInteger(input.defaultResultLimit) && input.defaultResultLimit >= 1 && input.defaultResultLimit <= 500 ? input.defaultResultLimit : 50,
    requireEmail: input.requireEmail === true,
    requireWebsite: input.requireWebsite === true,
    defaultSources: sources.length ? sources : ['apify', 'openstreetmap', 'website'],
  };
}
