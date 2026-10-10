import 'server-only';

import { normalizeDomain, normalizeEmail, normalizePhone, resolveBusinessEntity } from '@/lib/lead-finder/core';

export const DEFAULT_DISCOVERY_ACTOR = 'compass/crawler-google-places';
export const DEFAULT_CONTACT_ACTOR = 'apify/contact-info-scraper';
export const DEFAULT_INSTAGRAM_ACTOR = 'apify/instagram-scraper';

const APIFY_API_BASE = 'https://api.apify.com/v2';

export interface ApifyRunStatusResponse {
  id: string;
  actId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
  defaultDatasetId: string;
  startedAt: string;
  finishedAt?: string;
  usageTotalUsd?: number;
  usage?: {
    ACTOR_COMPUTE_UNITS?: number;
    DATASET_READS?: number;
    DATASET_WRITES?: number;
    PROXY_RESIDENTIAL_TRANSFER_GB?: number;
  };
}

export interface ApifyDiscoveryParams {
  query?: string;
  industry?: string;
  location?: string;
  country?: string;
  city?: string;
  radiusKm?: number;
  resultLimit?: number;
  filterNoWebsite?: boolean;
  requireEmail?: boolean;
  actorId?: string;
  extractDeepContacts?: boolean;
  abortSignal?: AbortSignal;
}

export interface DiscoveredBusiness {
  source: string;
  sourceId: string;
  businessName: string;
  website?: string | null;
  sourceUrl?: string | null;
  googleMapsUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  emailSourceUrl?: string | null;
  verificationStatus: 'unverified' | 'publicly_published' | 'format_valid' | 'verified';
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  description?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  socialUrls?: {
    linkedin?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  apifyPlaceId?: string | null;
  hasWebsite: boolean;
  opportunityType: 'no_website' | 'outdated_digital' | 'social_first' | 'standard';
  opportunitySummary: string;
  rawData?: unknown;
}

export interface ApifyDiscoveryReceipt {
  success: boolean;
  runId?: string;
  datasetId?: string;
  actorId: string;
  totalFound: number;
  discovered: DiscoveredBusiness[];
  costUsd: number;
  computeUnits: number;
  durationMs: number;
  status: string;
  error?: string;
}

/** Retrieve Apify API Token from server-side environment. Never expose to client. */
export function getApifyApiToken(): string | null {
  const token = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN;
  return token && token.trim() ? token.trim() : null;
}

export function isApifyConfigured(): boolean {
  return Boolean(getApifyApiToken());
}

/** Execute authenticated HTTP request to Apify REST API with exponential backoff for rate limits. */
async function callApifyApi<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
    retries?: number;
  } = {}
): Promise<T> {
  const token = getApifyApiToken();
  if (!token) {
    throw new Error('APIFY_TOKEN_NOT_CONFIGURED: Set APIFY_API_TOKEN in server environment variables.');
  }

  const { method = 'GET', body, signal, retries = 3 } = options;
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${APIFY_API_BASE}${endpoint}${separator}token=${encodeURIComponent(token)}`;

  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          'User-Agent': 'AlphaClone-LeadFinder/3.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });

      if (response.status === 429) {
        attempt++;
        if (attempt > retries) {
          throw new Error('APIFY_RATE_LIMIT_EXCEEDED: Apify API rate limit exceeded after maximum retries.');
        }
        const delay = Math.min(2000 * Math.pow(2, attempt), 10000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let parsedMessage = errorText;
        try {
          const parsed = JSON.parse(errorText) as { error?: { message?: string } };
          if (parsed?.error?.message) parsedMessage = parsed.error.message;
        } catch {}
        throw new Error(`APIFY_API_ERROR_${response.status}: ${parsedMessage || response.statusText}`);
      }

      const json = await response.json();
      return (json.data ?? json) as T;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      if (attempt >= retries) throw err;
      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }

  throw new Error('APIFY_REQUEST_FAILED');
}

/** Starts an asynchronous Apify Actor run. */
export async function startApifyActorRun(
  actorId: string,
  input: Record<string, unknown>,
  options: { timeoutSecs?: number; memoryMbytes?: number; signal?: AbortSignal } = {}
): Promise<ApifyRunStatusResponse> {
  const { timeoutSecs = 180, memoryMbytes = 1024, signal } = options;
  const encodedActorId = encodeURIComponent(actorId);
  const endpoint = `/acts/${encodedActorId}/runs?timeout=${timeoutSecs}&memory=${memoryMbytes}`;
  return callApifyApi<ApifyRunStatusResponse>(endpoint, {
    method: 'POST',
    body: input,
    signal,
  });
}

/** Fetch current status and usage metrics of an Apify Actor run. */
export async function getApifyRunStatus(
  runId: string,
  signal?: AbortSignal
): Promise<ApifyRunStatusResponse> {
  const endpoint = `/actor-runs/${encodeURIComponent(runId)}`;
  return callApifyApi<ApifyRunStatusResponse>(endpoint, { method: 'GET', signal });
}

/** Abort / cancel an active Apify run to stop compute cost billing immediately. */
export async function abortApifyRun(
  runId: string
): Promise<ApifyRunStatusResponse | null> {
  try {
    const endpoint = `/actor-runs/${encodeURIComponent(runId)}/abort`;
    return await callApifyApi<ApifyRunStatusResponse>(endpoint, { method: 'POST' });
  } catch (err) {
    console.warn(`[apifyLeadService] Failed to abort run ${runId}:`, err);
    return null;
  }
}

/** Fetch items from an Apify dataset with pagination. */
export async function fetchApifyDatasetItems<T = Record<string, unknown>>(
  datasetId: string,
  options: { offset?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<T[]> {
  const { offset = 0, limit = 100, signal } = options;
  const endpoint = `/datasets/${encodeURIComponent(datasetId)}/items?offset=${offset}&limit=${limit}`;
  return callApifyApi<T[]>(endpoint, { method: 'GET', signal });
}

/** Poll an Actor run until completion with progressive backoff. */
export async function waitForApifyRunCompletion(
  runId: string,
  options: {
    maxWaitMs?: number;
    checkIntervalMs?: number;
    signal?: AbortSignal;
  } = {}
): Promise<ApifyRunStatusResponse> {
  const { maxWaitMs = 120_000, checkIntervalMs = 3000, signal } = options;
  const started = Date.now();
  let interval = checkIntervalMs;

  while (Date.now() - started < maxWaitMs) {
    if (signal?.aborted) {
      await abortApifyRun(runId);
      throw new Error('APIFY_RUN_CANCELLED_BY_CLIENT');
    }

    const run = await getApifyRunStatus(runId, signal);
    if (['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) {
      return run;
    }

    await new Promise((resolve) => setTimeout(resolve, interval));
    // Gradual backoff up to 7 seconds
    interval = Math.min(interval + 1000, 7000);
  }

  // If timed out waiting on our side, abort the Apify container
  await abortApifyRun(runId);
  throw new Error(`APIFY_POLL_TIMEOUT: Actor run ${runId} did not finish within ${maxWaitMs / 1000}s`);
}

/** Normalizes raw output from Google Places and Directory actors into unified DiscoveredBusiness schema. */
export function normalizeApifyPlaceItem(
  raw: Record<string, unknown>,
  params: ApifyDiscoveryParams
): DiscoveredBusiness | null {
  const rawTitle = String(raw.title || raw.name || raw.placeName || raw.businessName || '').trim();
  if (!rawTitle) return null;

  // Validate that this is a real business, not a directory or aggregator
  const entity = resolveBusinessEntity({
    businessName: rawTitle,
    website: typeof raw.website === 'string' ? raw.website : null,
    sourceUrl: typeof raw.url === 'string' ? raw.url : null,
  });
  if (!entity.isRealBusiness) return null;

  // Clean and validate website
  let rawWebsite: string | null = null;
  if (typeof raw.website === 'string' && raw.website.trim()) {
    const candidateUrl = raw.website.trim();
    // Exclude Google Maps self-referential links or directory URLs from counting as business websites
    if (!/google\.[a-z.]+\/maps/i.test(candidateUrl) && !/maps\.app\.goo\.gl/i.test(candidateUrl)) {
      rawWebsite = candidateUrl;
    }
  }

  const hasWebsite = Boolean(rawWebsite && normalizeDomain(rawWebsite));
  const countryContext = params.country || params.location || (typeof raw.countryCode === 'string' ? raw.countryCode : null);
  const normalizedPhone = normalizePhone(
    typeof raw.phone === 'string' ? raw.phone : typeof raw.phoneUnformatted === 'string' ? raw.phoneUnformatted : null,
    countryContext
  );

  // Extract public emails if present in raw item or contact sub-fields
  let discoveredEmail: string | null = null;
  let emailSourceUrl: string | null = null;
  if (typeof raw.email === 'string' && normalizeEmail(raw.email)) {
    discoveredEmail = normalizeEmail(raw.email);
    emailSourceUrl = rawWebsite || (typeof raw.url === 'string' ? raw.url : null);
  } else if (Array.isArray(raw.emails) && raw.emails.length > 0) {
    const firstValid = raw.emails.map((e) => normalizeEmail(String(e))).find(Boolean);
    if (firstValid) {
      discoveredEmail = firstValid;
      emailSourceUrl = rawWebsite || (typeof raw.url === 'string' ? raw.url : null);
    }
  }

  // Verification status separation: strictly differentiate discovered vs verified
  const verificationStatus: DiscoveredBusiness['verificationStatus'] = discoveredEmail
    ? 'publicly_published'
    : 'unverified';

  // Social profile extraction
  const socialUrls: DiscoveredBusiness['socialUrls'] = {};
  if (typeof raw.instagram === 'string') socialUrls.instagram = raw.instagram;
  if (typeof raw.facebook === 'string') socialUrls.facebook = raw.facebook;
  if (typeof raw.linkedin === 'string') socialUrls.linkedin = raw.linkedin;
  if (typeof raw.twitter === 'string') socialUrls.twitter = raw.twitter;

  // Check nested social profiles if present
  if (raw.socialMedia && typeof raw.socialMedia === 'object') {
    const sm = raw.socialMedia as Record<string, string>;
    if (sm.instagram) socialUrls.instagram = sm.instagram;
    if (sm.facebook) socialUrls.facebook = sm.facebook;
    if (sm.linkedin) socialUrls.linkedin = sm.linkedin;
    if (sm.twitter) socialUrls.twitter = sm.twitter;
  }

  // Location details
  const address = String(raw.address || raw.formattedAddress || raw.street || '').trim() || null;
  const city = String(raw.city || params.city || '').trim() || null;
  const country = String(raw.countryCode || raw.country || params.country || '').trim() || null;

  let lat: number | null = null;
  let lng: number | null = null;
  if (raw.location && typeof raw.location === 'object') {
    const loc = raw.location as { lat?: number; lng?: number };
    if (typeof loc.lat === 'number') lat = loc.lat;
    if (typeof loc.lng === 'number') lng = loc.lng;
  } else {
    if (typeof raw.lat === 'number') lat = raw.lat;
    if (typeof raw.lng === 'number') lng = raw.lng;
  }

  const category = String(raw.categoryName || raw.category || params.industry || '').trim() || null;
  const rating = typeof raw.totalScore === 'number' ? raw.totalScore : typeof raw.rating === 'number' ? raw.rating : null;
  const reviewsCount = typeof raw.reviewsCount === 'number' ? raw.reviewsCount : typeof raw.reviews === 'number' ? raw.reviews : null;
  const placeId = String(raw.placeId || raw.cid || raw.fid || '').trim() || null;
  const googleMapsUrl = typeof raw.url === 'string' ? raw.url : placeId ? `https://maps.google.com/?cid=${placeId}` : null;

  // Opportunity classification for AlphaClone sales profile
  let opportunityType: DiscoveredBusiness['opportunityType'] = 'standard';
  let opportunitySummary = 'Standard local business presence.';

  if (!hasWebsite) {
    if (socialUrls.instagram || socialUrls.facebook) {
      opportunityType = 'social_first';
      opportunitySummary = 'Active on social media with no dedicated website or booking portal.';
    } else {
      opportunityType = 'no_website';
      opportunitySummary = 'High opportunity: No public website found on Google Maps directory.';
    }
  } else if (rating && rating >= 4.0 && reviewsCount && reviewsCount >= 15) {
    opportunityType = 'outdated_digital';
    opportunitySummary = 'High local demand with strong reviews; prime candidate for booking and conversion upgrades.';
  }

  const sourceId = placeId ? `apify:places:${placeId}` : `apify:${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${city || 'unknown'}`;

  return {
    source: 'apify:google-places',
    sourceId,
    businessName: rawTitle,
    website: rawWebsite,
    sourceUrl: googleMapsUrl || rawWebsite,
    googleMapsUrl,
    phone: normalizedPhone,
    email: discoveredEmail,
    emailSourceUrl,
    verificationStatus,
    address,
    city,
    country,
    lat,
    lng,
    category,
    description: typeof raw.description === 'string' ? raw.description : null,
    rating,
    reviewsCount,
    socialUrls: Object.keys(socialUrls).length ? socialUrls : undefined,
    apifyPlaceId: placeId,
    hasWebsite,
    opportunityType,
    opportunitySummary,
    rawData: raw,
  };
}

/** Formats Google Places crawler input according to official Apify actor schema. */
export function buildGooglePlacesActorInput(params: ApifyDiscoveryParams): Record<string, unknown> {
  const searchTerms: string[] = [];
  const keyword = [params.industry, params.query].filter(Boolean).join(' ').trim();
  const location = [params.city, params.location, params.country].filter(Boolean).join(', ').trim();

  if (keyword) {
    searchTerms.push(location ? `${keyword} in ${location}` : keyword);
  } else if (location) {
    searchTerms.push(`businesses in ${location}`);
  } else {
    searchTerms.push('local businesses');
  }

  const maxPlaces = Math.max(5, Math.min(params.resultLimit || 50, 250));

  return {
    searchStringsArray: searchTerms,
    locationQuery: location || undefined,
    maxCrawledPlacesPerSearch: maxPlaces,
    language: 'en',
    includeHistogram: false,
    includeOpeningHours: true,
    includePeopleAlsoSearch: false,
    maxReviews: 0,
    maxImages: 0,
  };
}

/** Generates deterministic mock discovery data for tests or offline sandbox environments. */
export function generateMockDiscoveryResults(params: ApifyDiscoveryParams): DiscoveredBusiness[] {
  const city = params.city || params.location || 'Harare';
  const country = params.country || 'Zimbabwe';
  const industry = params.industry || params.query || 'Construction & Services';

  const mockTemplates = [
    {
      name: 'Apex Structural Solutions',
      hasWebsite: false,
      phone: '+263772111222',
      email: null,
      rating: 4.6,
      reviews: 28,
      address: `14 Samora Machel Ave, ${city}`,
      social: { facebook: 'https://facebook.com/apexstructural' },
    },
    {
      name: 'Bespoke Craft Woodworks',
      hasWebsite: false,
      phone: '+263773333444',
      email: null,
      rating: 4.8,
      reviews: 42,
      address: `82 Enterprise Rd, ${city}`,
      social: { instagram: 'https://instagram.com/bespokecraftzw' },
    },
    {
      name: 'Citywide Commercial Logistics',
      hasWebsite: true,
      website: 'https://citywidelogistics-example.co.zw',
      phone: '+263774555666',
      email: 'info@citywidelogistics-example.co.zw',
      rating: 4.2,
      reviews: 19,
      address: `55 Simon Mazorodze Rd, ${city}`,
      social: { linkedin: 'https://linkedin.com/company/citywide-logistics' },
    },
    {
      name: 'Precision Auto Mechanical Works',
      hasWebsite: false,
      phone: '+263775777888',
      email: null,
      rating: 4.5,
      reviews: 35,
      address: `102 Seke Rd, ${city}`,
      social: {},
    },
  ];

  const results: DiscoveredBusiness[] = [];
  const limit = params.resultLimit || 50;

  for (let i = 0; i < Math.min(mockTemplates.length, limit); i++) {
    const t = mockTemplates[i];
    if (params.filterNoWebsite && t.hasWebsite) continue;
    if (params.requireEmail && !t.email) continue;

    const placeId = `ChIJ_mock_place_${i}_${Date.now()}`;
    const oppType: DiscoveredBusiness['opportunityType'] = !t.hasWebsite
      ? t.social && Object.keys(t.social).length
        ? 'social_first'
        : 'no_website'
      : 'standard';

    results.push({
      source: 'apify:google-places',
      sourceId: `apify:places:${placeId}`,
      businessName: t.name,
      website: t.hasWebsite ? t.website : null,
      sourceUrl: `https://maps.google.com/?cid=${placeId}`,
      googleMapsUrl: `https://maps.google.com/?cid=${placeId}`,
      phone: t.phone,
      email: t.email,
      emailSourceUrl: t.email ? t.website : null,
      verificationStatus: t.email ? 'publicly_published' : 'unverified',
      address: t.address,
      city,
      country,
      lat: -17.824858 + i * 0.01,
      lng: 31.053028 + i * 0.01,
      category: industry,
      rating: t.rating,
      reviewsCount: t.reviews,
      socialUrls: t.social,
      apifyPlaceId: placeId,
      hasWebsite: t.hasWebsite,
      opportunityType: oppType,
      opportunitySummary: !t.hasWebsite
        ? 'High opportunity: No public website found on Google Maps directory.'
        : 'Standard business presence.',
      rawData: { mock: true, templateIndex: i },
    });
  }

  return results;
}

/**
 * End-to-end production discovery runner using Apify Google Places.
 * Executes Actor asynchronously, polls dataset, normalizes records,
 * applies target filters (e.g. no-website opportunity filter), and tracks compute cost.
 */
export async function discoverBusinessesWithApify(
  params: ApifyDiscoveryParams
): Promise<ApifyDiscoveryReceipt> {
  const startTime = Date.now();
  const actorId = params.actorId || DEFAULT_DISCOVERY_ACTOR;

  // If token is missing, check if in test mode or provide clear error receipt
  if (!isApifyConfigured()) {
    if (process.env.NODE_ENV === 'test' || process.env.APIFY_MOCK_TEST === 'true') {
      const mockLeads = generateMockDiscoveryResults(params);
      return {
        success: true,
        runId: 'act_run_mock_test_123',
        datasetId: 'dataset_mock_test_123',
        actorId,
        totalFound: mockLeads.length,
        discovered: mockLeads,
        costUsd: 0.05,
        computeUnits: 0.02,
        durationMs: Date.now() - startTime,
        status: 'SUCCEEDED',
      };
    }

    return {
      success: false,
      actorId,
      totalFound: 0,
      discovered: [],
      costUsd: 0,
      computeUnits: 0,
      durationMs: Date.now() - startTime,
      status: 'FAILED',
      error: 'APIFY_NOT_CONFIGURED: APIFY_API_TOKEN is not set in server environment variables.',
    };
  }

  try {
    const actorInput = buildGooglePlacesActorInput(params);

    // 1. Start asynchronous Actor run
    const run = await startApifyActorRun(actorId, actorInput, {
      timeoutSecs: 180,
      memoryMbytes: 1024,
      signal: params.abortSignal,
    });

    // 2. Poll for completion
    const completedRun = await waitForApifyRunCompletion(run.id, {
      maxWaitMs: 120_000,
      checkIntervalMs: 3000,
      signal: params.abortSignal,
    });

    if (completedRun.status !== 'SUCCEEDED') {
      return {
        success: false,
        runId: completedRun.id,
        datasetId: completedRun.defaultDatasetId,
        actorId,
        totalFound: 0,
        discovered: [],
        costUsd: completedRun.usageTotalUsd ?? 0,
        computeUnits: completedRun.usage?.ACTOR_COMPUTE_UNITS ?? 0,
        durationMs: Date.now() - startTime,
        status: completedRun.status,
        error: `Apify run ended with status ${completedRun.status}`,
      };
    }

    // 3. Fetch dataset items
    const rawItems = await fetchApifyDatasetItems<Record<string, unknown>>(
      completedRun.defaultDatasetId,
      {
        offset: 0,
        limit: Math.max(10, Math.min(params.resultLimit || 50, 250)),
        signal: params.abortSignal,
      }
    );

    // 4. Normalize records
    const normalized: DiscoveredBusiness[] = [];
    for (const item of rawItems) {
      const candidate = normalizeApifyPlaceItem(item, params);
      if (!candidate) continue;

      // Filter: No website only (for digital gap prospecting)
      if (params.filterNoWebsite && candidate.hasWebsite) {
        continue;
      }

      // Filter: Require email
      if (params.requireEmail && !candidate.email) {
        continue;
      }

      normalized.push(candidate);
    }

    const costUsd = completedRun.usageTotalUsd ?? Number((normalized.length * 0.0015).toFixed(4));
    const computeUnits = completedRun.usage?.ACTOR_COMPUTE_UNITS ?? 0.03;

    return {
      success: true,
      runId: completedRun.id,
      datasetId: completedRun.defaultDatasetId,
      actorId,
      totalFound: normalized.length,
      discovered: normalized,
      costUsd,
      computeUnits,
      durationMs: Date.now() - startTime,
      status: 'SUCCEEDED',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      actorId,
      totalFound: 0,
      discovered: [],
      costUsd: 0,
      computeUnits: 0,
      durationMs: Date.now() - startTime,
      status: 'FAILED',
      error: message,
    };
  }
}
