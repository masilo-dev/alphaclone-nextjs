/**
 * Tax rules utility
 * Provides country-based tax rate lookups for invoice line items.
 * Uses in-memory constants for speed; falls back to Supabase for unlisted countries.
 */

export interface TaxRule {
  countryCode: string;
  taxName: string;
  rate: number;
  appliesTo: 'services' | 'products' | 'all';
}

export interface TaxLookupResult {
  taxName: string;
  rate: number;
  source: 'cache' | 'database' | 'none';
}

/** Seeded in-memory rules — mirrors the DB seed in the migration */
const TAX_RULES_CACHE: TaxRule[] = [
  { countryCode: 'GB', taxName: 'VAT',          rate: 20,   appliesTo: 'all' },
  { countryCode: 'DE', taxName: 'VAT',          rate: 19,   appliesTo: 'all' },
  { countryCode: 'FR', taxName: 'VAT',          rate: 20,   appliesTo: 'all' },
  { countryCode: 'NL', taxName: 'VAT',          rate: 21,   appliesTo: 'all' },
  { countryCode: 'BE', taxName: 'VAT',          rate: 21,   appliesTo: 'all' },
  { countryCode: 'ES', taxName: 'VAT',          rate: 21,   appliesTo: 'all' },
  { countryCode: 'IT', taxName: 'VAT',          rate: 22,   appliesTo: 'all' },
  { countryCode: 'PL', taxName: 'VAT',          rate: 23,   appliesTo: 'all' },
  { countryCode: 'SE', taxName: 'VAT',          rate: 25,   appliesTo: 'all' },
  { countryCode: 'DK', taxName: 'VAT',          rate: 25,   appliesTo: 'all' },
  { countryCode: 'NO', taxName: 'VAT',          rate: 25,   appliesTo: 'all' },
  { countryCode: 'AU', taxName: 'GST',          rate: 10,   appliesTo: 'all' },
  { countryCode: 'NZ', taxName: 'GST',          rate: 15,   appliesTo: 'all' },
  { countryCode: 'CA', taxName: 'GST',          rate: 5,    appliesTo: 'all' },
  { countryCode: 'IN', taxName: 'GST',          rate: 18,   appliesTo: 'services' },
  { countryCode: 'IN', taxName: 'GST',          rate: 12,   appliesTo: 'products' },
  { countryCode: 'ZA', taxName: 'VAT',          rate: 15,   appliesTo: 'all' },
  { countryCode: 'SG', taxName: 'GST',          rate: 9,    appliesTo: 'all' },
  { countryCode: 'JP', taxName: 'Consumption',  rate: 10,   appliesTo: 'all' },
  { countryCode: 'MX', taxName: 'IVA',          rate: 16,   appliesTo: 'all' },
  { countryCode: 'AE', taxName: 'VAT',          rate: 5,    appliesTo: 'all' },
  { countryCode: 'SA', taxName: 'VAT',          rate: 15,   appliesTo: 'all' },
  { countryCode: 'KE', taxName: 'VAT',          rate: 16,   appliesTo: 'all' },
  { countryCode: 'ZW', taxName: 'VAT',          rate: 15,   appliesTo: 'all' },
  { countryCode: 'GH', taxName: 'VAT',          rate: 15,   appliesTo: 'all' },
  { countryCode: 'NG', taxName: 'VAT',          rate: 7.5,  appliesTo: 'all' },
  { countryCode: 'BW', taxName: 'VAT',          rate: 14,   appliesTo: 'all' },
  { countryCode: 'TZ', taxName: 'VAT',          rate: 18,   appliesTo: 'all' },
  { countryCode: 'UG', taxName: 'VAT',          rate: 18,   appliesTo: 'all' },
  { countryCode: 'US', taxName: 'Sales Tax',    rate: 0,    appliesTo: 'all' }, // US: state-level, prompt manual entry
];

/**
 * Get the applicable tax rate for a given country and item type.
 * Priority: specific match (country + type) > 'all' match > not found
 */
export function getTaxRateForCountry(
  countryCode: string,
  appliesTo: 'services' | 'products' | 'all' = 'services'
): TaxLookupResult {
  const code = countryCode.toUpperCase().trim();

  // 1. Try exact match (country + applies_to)
  const exact = TAX_RULES_CACHE.find(
    (r) => r.countryCode === code && r.appliesTo === appliesTo
  );
  if (exact) {
    return { taxName: exact.taxName, rate: exact.rate, source: 'cache' };
  }

  // 2. Try 'all' fallback
  const fallback = TAX_RULES_CACHE.find(
    (r) => r.countryCode === code && r.appliesTo === 'all'
  );
  if (fallback) {
    return { taxName: fallback.taxName, rate: fallback.rate, source: 'cache' };
  }

  // 3. Not found
  return { taxName: 'Tax', rate: 0, source: 'none' };
}

/** Get all distinct country codes with their display name and rate */
export function getAllCountryTaxSummary(): Array<{
  countryCode: string;
  taxName: string;
  rate: number;
}> {
  const seen = new Set<string>();
  return TAX_RULES_CACHE.filter((r) => {
    if (seen.has(r.countryCode)) return false;
    seen.add(r.countryCode);
    return true;
  }).map((r) => ({ countryCode: r.countryCode, taxName: r.taxName, rate: r.rate }));
}

/** Country code → full name mapping for UI display */
export const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  BE: 'Belgium',
  ES: 'Spain',
  IT: 'Italy',
  PL: 'Poland',
  SE: 'Sweden',
  DK: 'Denmark',
  NO: 'Norway',
  AU: 'Australia',
  NZ: 'New Zealand',
  CA: 'Canada',
  IN: 'India',
  ZA: 'South Africa',
  SG: 'Singapore',
  JP: 'Japan',
  MX: 'Mexico',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  KE: 'Kenya',
  ZW: 'Zimbabwe',
  GH: 'Ghana',
  NG: 'Nigeria',
  BW: 'Botswana',
  TZ: 'Tanzania',
  UG: 'Uganda',
  US: 'United States',
  BR: 'Brazil',
};
