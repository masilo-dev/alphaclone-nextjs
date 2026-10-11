import {
  QualificationProfile,
  COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS,
} from './qualificationContract';

export interface GeneratedDiscoveryQuery {
  category: string;
  queryTerm: string;
  locationTerm: string;
  fullSearchString: string;
  isFallbackCategory: boolean;
}

export interface DiscoveryPlan {
  originalIntent: string;
  profile: QualificationProfile;
  generatedQueries: GeneratedDiscoveryQuery[];
  discoveryOnly: boolean;
  maxResultsPerQuery: number;
  totalPlannedLimit: number;
}

/**
 * Standard customer sectors that need websites and booking systems,
 * mapped to concrete place search terms.
 */
const TARGET_CUSTOMER_SEARCH_SECTORS: Record<string, string[]> = {
  trades: [
    'plumber',
    'electrician',
    'builder',
    'painter',
    'roofing contractor',
    'landscaper',
  ],
  healthcare: [
    'dentist',
    'physiotherapist',
    'chiropractor',
    'veterinary clinic',
  ],
  personal_care: [
    'hair salon',
    'barber shop',
    'beauty salon',
    'wellness spa',
  ],
  dining: [
    'cafe',
    'restaurant',
    'bakery',
  ],
  auto: [
    'auto repair mechanic',
    'tyre shop',
    'car detailing',
  ],
};

/**
 * Builds structured, bounded discovery queries from a qualification profile.
 * CRITICAL RULE: Never passes free-text sales pitches containing words like "website"
 * to place-search providers. Translates the user's intent into prospective client sectors.
 */
export function buildDiscoveryQueries(
  profile: QualificationProfile,
  originalIntent: string,
  options: {
    maxQueries?: number;
    resultsPerQuery?: number;
    discoveryOnly?: boolean;
  } = {}
): DiscoveryPlan {
  const maxQueries = options.maxQueries || 3;
  const resultsPerQuery = options.resultsPerQuery || 15;
  const locationTerm =
    profile.targetGeography.rawLocation ||
    [profile.targetGeography.city, profile.targetGeography.country]
      .filter(Boolean)
      .join(', ') ||
    'Auckland, New Zealand';

  const queries: GeneratedDiscoveryQuery[] = [];

  if (profile.offer === 'website_design_and_development') {
    // If specific included industries were requested (and aren't the generic fallback), use those
    const specificIndustries = profile.includedIndustries.filter(
      (ind) =>
        !ind.includes('businesses that could benefit') &&
        !ind.includes('local businesses') &&
        !ind.includes('trades_and_contractors')
    );

    if (specificIndustries.length > 0) {
      for (const industry of specificIndustries.slice(0, maxQueries)) {
        // Strip any competitor keywords if user mistakenly wrote "web design clients"
        let cleanTerm = industry;
        for (const comp of COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS) {
          cleanTerm = cleanTerm.replace(new RegExp(`\\b${comp}\\b`, 'gi'), '').trim();
        }
        cleanTerm = cleanTerm || 'local services';
        queries.push({
          category: industry,
          queryTerm: cleanTerm,
          locationTerm,
          fullSearchString: `${cleanTerm} in ${locationTerm}`,
          isFallbackCategory: false,
        });
      }
    } else {
      // Use structured prospective customer sectors (trades, personal care, auto, dining)
      const selectedSectors = ['trades', 'personal_care', 'auto'];
      for (const sector of selectedSectors.slice(0, maxQueries)) {
        const sampleTerm = TARGET_CUSTOMER_SEARCH_SECTORS[sector]?.[0] || 'local business';
        queries.push({
          category: sector,
          queryTerm: sampleTerm,
          locationTerm,
          fullSearchString: `${sampleTerm} in ${locationTerm}`,
          isFallbackCategory: true,
        });
      }
    }
  } else {
    // Non-website offers: use the specified included industries or fallback
    const targetTerms = profile.includedIndustries.slice(0, maxQueries);
    if (targetTerms.length > 0) {
      for (const term of targetTerms) {
        queries.push({
          category: term,
          queryTerm: term,
          locationTerm,
          fullSearchString: `${term} in ${locationTerm}`,
          isFallbackCategory: false,
        });
      }
    } else {
      queries.push({
        category: 'general_commercial',
        queryTerm: 'independent businesses',
        locationTerm,
        fullSearchString: `independent businesses in ${locationTerm}`,
        isFallbackCategory: true,
      });
    }
  }

  return {
    originalIntent,
    profile,
    generatedQueries: queries,
    discoveryOnly: options.discoveryOnly !== false,
    maxResultsPerQuery: resultsPerQuery,
    totalPlannedLimit: queries.length * resultsPerQuery,
  };
}
