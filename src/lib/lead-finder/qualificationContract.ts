import { z } from 'zod';

export const QUALIFICATION_RULES_VERSION = '2026.10-evidence-v2';

export type OfferType =
  | 'website_design_and_development'
  | 'crm_and_lead_automation'
  | 'digital_marketing_and_seo'
  | 'general_b2b_service';

export type RequirementDecision = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export type QualificationDecision =
  | 'QUALIFIED'
  | 'REVIEW_NEEDED'
  | 'NOT_A_FIT'
  | 'INSUFFICIENT_DATA';

export type ChannelReadiness =
  | 'email_ready'
  | 'phone_ready'
  | 'no_validated_channel';

export interface QualificationRequirement {
  id: string;
  label: string;
  description: string;
  isMandatory: boolean; // Mandatory = FAIL blocks qualification; Preference = affects rank only
}

export interface QualificationProfile {
  version: string;
  offer: OfferType;
  offerDescription: string;
  targetGeography: {
    city?: string;
    region?: string;
    country?: string;
    rawLocation: string;
  };
  includedIndustries: string[];
  excludedIndustries: string[];
  excludeCompetitorsSameService: boolean;
  sizePreferences: {
    minEmployees?: number;
    maxEmployees?: number;
    preferOwnerOperated: boolean;
  };
  requiredBusinessCharacteristics: string[];
  relevantNeedSignals: string[];
  requiredContactChannels: Array<'email' | 'phone'>;
  preferredContactChannels: Array<'email' | 'phone'>;
  mandatoryRequirements: QualificationRequirement[];
  preferences: QualificationRequirement[];
  explicitExclusions: string[];
  evidenceFreshnessDays: number;
}

/** Default customer categories targeted when offering website design & development */
export const DEFAULT_WEBSITE_OFFER_CUSTOMER_CATEGORIES = [
  'trades_and_contractors', // plumbers, electricians, builders, painters, roofers
  'clinics_and_healthcare',  // dentists, physios, chiropractors, vets
  'salons_and_personal_care',// hair salons, barbers, spas, tattoo
  'restaurants_and_cafes',   // local dining, bakeries, cafes
  'local_professional_services', // local accountants, legal, bookkeeping
  'auto_and_transport',      // mechanics, tyre shops, auto body
  'home_and_commercial_services', // cleaning, pest control, landscaping
];

export const COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS = [
  'web design',
  'website design',
  'web designer',
  'web development',
  'digital agency',
  'digital marketing agency',
  'digital marketing',
  'marketing agency',
  'internet marketing',
  'seo agency',
  'software agency',
  'creative agency',
  'branding agency',
  'marketing consultancy',
  'app development',
  'authentic digital',
];

/**
 * Resolves a natural language or structured search intent into a full QualificationProfile.
 * Merges user intent with tenant preferences and explicitly distinguishes
 * mandatory requirements from preferences.
 */
export function resolveQualificationProfile(input: {
  intentPrompt?: string;
  niche?: string;
  location?: string;
  country?: string;
  requireEmail?: boolean;
  filterNoWebsite?: boolean;
  tenantConfig?: Partial<QualificationProfile>;
}): QualificationProfile {
  const prompt = (input.intentPrompt || '').toLowerCase();
  const rawLocation = (input.location || '').trim();

  // Detect offer type from prompt
  const isWebsiteOffer =
    input.filterNoWebsite ||
    prompt.includes('website') ||
    prompt.includes('web design') ||
    prompt.includes('booking portal') ||
    prompt.includes('landing page');

  const offer: OfferType = isWebsiteOffer
    ? 'website_design_and_development'
    : 'general_b2b_service';

  // Extract country from location if present
  let resolvedCountry = input.country;
  if (!resolvedCountry && rawLocation) {
    if (/new zealand|\bnz\b/i.test(rawLocation)) resolvedCountry = 'New Zealand';
    else if (/australia|\bau\b/i.test(rawLocation)) resolvedCountry = 'Australia';
    else if (/united states|\busa?\b/i.test(rawLocation)) resolvedCountry = 'United States';
    else if (/united kingdom|\buk\b/i.test(rawLocation)) resolvedCountry = 'United Kingdom';
    else if (/zimbabwe|\bzw\b/i.test(rawLocation)) resolvedCountry = 'Zimbabwe';
    else if (/south africa|\bza\b/i.test(rawLocation)) resolvedCountry = 'South Africa';
  }

  // Extract city
  let resolvedCity: string | undefined;
  if (rawLocation) {
    const parts = rawLocation.split(',').map((p) => p.trim());
    resolvedCity = parts[0];
  }

  // Parse contact requirements:
  // Check if email is explicitly required vs preferred
  const mustHaveEmail = Boolean(
    input.requireEmail ||
    /require\s+email|must\s+have\s+email|email\s+only/i.test(prompt)
  );
  const prefersEmail = Boolean(
    mustHaveEmail ||
    /prefer.*email|with.*email/i.test(prompt)
  );

  // Mandatory requirements vs preferences
  const mandatoryRequirements: QualificationRequirement[] = [
    {
      id: 'real_operating_business',
      label: 'Real Operating Business',
      description: 'Must be an actual trading business, not a directory listing, aggregator, or search page.',
      isMandatory: true,
    },
    {
      id: 'target_geography',
      label: 'Target Geography',
      description: `Must operate within the target location (${rawLocation || 'specified market'}).`,
      isMandatory: true,
    },
  ];

  if (offer === 'website_design_and_development') {
    mandatoryRequirements.push({
      id: 'no_competitor_same_service',
      label: 'Not a Web Design / Agency Competitor',
      description: 'Must not sell the same website design, web development, or digital agency services.',
      isMandatory: true,
    });
  }

  if (mustHaveEmail) {
    mandatoryRequirements.push({
      id: 'valid_public_email',
      label: 'Public Business Email Present',
      description: 'Must possess a verified, syntax-valid public business email address.',
      isMandatory: true,
    });
  } else {
    mandatoryRequirements.push({
      id: 'valid_contact_channel',
      label: 'Reachable Contact Channel',
      description: 'Must possess at least one validated contact method (phone or email).',
      isMandatory: true,
    });
  }

  // Preferences (affect ranking and recommendations, but do not disqualify on their own)
  const preferences: QualificationRequirement[] = [];

  if (prefersEmail && !mustHaveEmail) {
    preferences.push({
      id: 'preferred_public_email',
      label: 'Preferred Public Email',
      description: 'Prefers businesses with a public email address for automated outreach.',
      isMandatory: false,
    });
  }

  if (offer === 'website_design_and_development') {
    preferences.push({
      id: 'demonstrated_website_need',
      label: 'Demonstrated Website Need',
      description: 'Prefers businesses with weak, outdated, non-mobile, or absent websites.',
      isMandatory: false,
    });
  }

  if (/owner-operated|small business|owner operated/i.test(prompt)) {
    preferences.push({
      id: 'owner_operated_presence',
      label: 'Owner-Operated / Independent Business',
      description: 'Prefers independent, owner-operated local businesses over large national franchises.',
      isMandatory: false,
    });
  }

  return {
    version: QUALIFICATION_RULES_VERSION,
    offer,
    offerDescription:
      offer === 'website_design_and_development'
        ? 'Custom Website Design, Mobile Optimization & Booking Portals'
        : 'B2B Client Growth & Lead Ingestion',
    targetGeography: {
      city: resolvedCity,
      country: resolvedCountry,
      rawLocation,
    },
    includedIndustries:
      input.niche && !input.niche.includes('businesses that could benefit')
        ? [input.niche]
        : DEFAULT_WEBSITE_OFFER_CUSTOMER_CATEGORIES,
    excludedIndustries:
      offer === 'website_design_and_development'
        ? COMPETITOR_KEYWORDS_FOR_WEBSITE_OFFERS
        : [],
    excludeCompetitorsSameService: offer === 'website_design_and_development',
    sizePreferences: {
      minEmployees: 1,
      maxEmployees: 50,
      preferOwnerOperated: /owner-operated|owner operated/i.test(prompt),
    },
    requiredBusinessCharacteristics: [
      'Independent or local commercial entity',
      'Actively operating with physical or local market presence',
    ],
    relevantNeedSignals:
      offer === 'website_design_and_development'
        ? [
            'No identifiable website in public directory listings',
            'Website present but lacks mobile responsive viewport',
            'Website lacks clear contact enquiry or call-to-action mechanism',
            'Social-media-first business with no booking portal or domain',
          ]
        : ['Manual lead follow-up bottleneck'],
    requiredContactChannels: mustHaveEmail ? ['email'] : [],
    preferredContactChannels: prefersEmail ? ['email', 'phone'] : ['phone', 'email'],
    mandatoryRequirements,
    preferences,
    explicitExclusions: [
      'National and international directory websites (e.g., Yelp, Yellow Pages, Clutch)',
      'Web development and digital marketing agencies (competitors)',
      'Government and public educational institutions',
    ],
    evidenceFreshnessDays: 30,
  };
}
