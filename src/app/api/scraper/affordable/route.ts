import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

// Affordable Scraping Tools Integration
// Replaces expensive Apollo/ZoomInfo with cost-effective alternatives

interface HunterResult {
  email: string;
  score: number;
  type: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  phone_number?: string;
  twitter?: string;
  linkedin?: string;
}

interface BuiltWithResult {
  domain: string;
  technologies: string[];
  company_name?: string;
  company_size?: string;
  revenue?: string;
  location?: string;
}

interface GooglePlaceResult {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviews?: number;
  opening_hours?: string[];
  place_id: string;
}

/**
 * HUNTER.IO - Email Finder
 * Cost: ~$49/month for 500 searches (vs Apollo $200+)
 * Best for: Finding email addresses by domain
 */
async function hunterDomainSearch(domain: string): Promise<HunterResult[]> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) {
    console.warn('[AffordableScraper] Hunter API key not configured');
    return [];
  }

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      console.warn('[AffordableScraper] Hunter API error:', res.status);
      return [];
    }

    const data = await res.json();
    return (data.data?.emails || []).map((e: any) => ({
      email: e.value,
      score: e.score,
      type: e.type,
      first_name: e.first_name,
      last_name: e.last_name,
      position: e.position,
      phone_number: e.phone_number,
      twitter: e.twitter,
      linkedin: e.linkedin,
    }));
  } catch (err) {
    console.error('[AffordableScraper] Hunter error:', err);
    return [];
  }
}

/**
 * HUNTER.IO - Email Verifier
 * Validates email deliverability
 */
async function hunterVerifyEmail(email: string): Promise<{ valid: boolean; score: number }> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey) return { valid: false, score: 0 };

  try {
    const res = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) return { valid: false, score: 0 };

    const data = await res.json();
    return {
      valid: data.data?.result === 'deliverable',
      score: data.data?.score || 0,
    };
  } catch {
    return { valid: false, score: 0 };
  }
}

/**
 * BUILTWITH - Technology Lookup
 * Cost: Free tier available, paid ~$29/month
 * Best for: Tech stack intelligence, company sizing
 */
async function builtWithLookup(domain: string): Promise<BuiltWithResult | null> {
  const apiKey = process.env.BUILTWITH_API_KEY;
  if (!apiKey) {
    console.warn('[AffordableScraper] BuiltWith API key not configured');
    return null;
  }

  try {
    const res = await fetch(
      `https://api.builtwith.com/v1/api.json?KEY=${apiKey}&LOOKUP=${encodeURIComponent(domain)}`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) {
      console.warn('[AffordableScraper] BuiltWith API error:', res.status);
      return null;
    }

    const data = await res.json();
    const result = data.Results?.[0]?.Result;
    
    if (!result) return null;

    // Extract technologies
    const technologies = (result.Paths?.flatMap((p: any) => 
      p.Technologies?.map((t: any) => t.Name) || []
    ) || []) as string[];

    // Get company info from first path
    const firstPath = result.Paths?.[0];
    const company = firstPath?.Meta?.[0];

    return {
      domain,
      technologies: [...new Set(technologies)],
      company_name: company?.CompanyName,
      company_size: company?.Employees,
      revenue: company?.Revenue,
      location: company?.City ? `${company.City}, ${company.State}` : undefined,
    };
  } catch (err) {
    console.error('[AffordableScraper] BuiltWith error:', err);
    return null;
  }
}

/**
 * GOOGLE PLACES API - Local Business Data
 * Cost: $200 free tier/month, then pay-per-use (~$17 per 1000 requests)
 * Best for: Local business search with real data
 */
async function googlePlacesSearch(
  query: string, 
  location: string, 
  radius: number = 5000
): Promise<GooglePlaceResult[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.warn('[AffordableScraper] Google Places API key not configured');
    return [];
  }

  try {
    // Step 1: Geocode the location
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`,
      { signal: AbortSignal.timeout(8000) }
    );
    
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]?.geometry?.location) {
      console.warn('[AffordableScraper] Could not geocode location:', location);
      return [];
    }
    
    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Search places
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&keyword=${encodeURIComponent(query)}&key=${apiKey}`,
      { signal: AbortSignal.timeout(10000) }
    );

    const searchData = await searchRes.json();
    if (searchData.status !== 'OK') {
      console.warn('[AffordableScraper] Google Places error:', searchData.status);
      return [];
    }

    // Step 3: Get details for each place
    const results: GooglePlaceResult[] = [];
    
    for (const place of searchData.results.slice(0, 10)) {
      try {
        const detailsRes = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,opening_hours&key=${apiKey}`,
          { signal: AbortSignal.timeout(8000) }
        );

        const details = await detailsRes.json();
        if (details.status === 'OK' && details.result) {
          results.push({
            name: details.result.name,
            address: details.result.formatted_address,
            phone: details.result.formatted_phone_number,
            website: details.result.website,
            rating: details.result.rating,
            reviews: details.result.user_ratings_total,
            opening_hours: details.result.opening_hours?.weekday_text,
            place_id: place.place_id,
          });
        }
      } catch (e) {
        console.warn('[AffordableScraper] Failed to get place details:', e);
      }
    }

    return results;
  } catch (err) {
    console.error('[AffordableScraper] Google Places error:', err);
    return [];
  }
}

/**
 * MAIN POST HANDLER
 * Combines affordable tools for comprehensive lead enrichment
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      action,
      domain,
      email,
      query,
      location,
      tenant_id 
    } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action required' }, { status: 400 });
    }

    let results: any = {};

    switch (action) {
      case 'hunter_domain': {
        if (!domain) {
          return NextResponse.json({ error: 'Domain required' }, { status: 400 });
        }
        const emails = await hunterDomainSearch(domain);
        results = { 
          success: true, 
          source: 'hunter.io',
          emails,
          count: emails.length,
          cost_estimate: '$0.10 (1 credit)'
        };
        break;
      }

      case 'hunter_verify': {
        if (!email) {
          return NextResponse.json({ error: 'Email required' }, { status: 400 });
        }
        const verification = await hunterVerifyEmail(email);
        results = {
          success: true,
          source: 'hunter.io',
          email,
          ...verification,
          cost_estimate: '$0.02 (1/5 credit)'
        };
        break;
      }

      case 'builtwith': {
        if (!domain) {
          return NextResponse.json({ error: 'Domain required' }, { status: 400 });
        }
        const techData = await builtWithLookup(domain);
        results = {
          success: !!techData,
          source: 'builtwith.com',
          data: techData,
          cost_estimate: 'Free tier'
        };
        break;
      }

      case 'google_places': {
        if (!query || !location) {
          return NextResponse.json({ error: 'Query and location required' }, { status: 400 });
        }
        const places = await googlePlacesSearch(query, location);
        results = {
          success: true,
          source: 'google.places',
          places,
          count: places.length,
          cost_estimate: `$${(places.length * 0.017).toFixed(2)}`
        };
        break;
      }

      case 'enrich_lead': {
        // Full enrichment pipeline using ALL affordable tools
        if (!domain) {
          return NextResponse.json({ error: 'Domain required for enrichment' }, { status: 400 });
        }

        const [emails, techData] = await Promise.all([
          hunterDomainSearch(domain),
          builtWithLookup(domain)
        ]);

        // Verify top emails
        const verifiedEmails = await Promise.all(
          emails.slice(0, 3).map(async (e) => {
            const v = await hunterVerifyEmail(e.email);
            return { ...e, ...v };
          })
        );

        results = {
          success: true,
          domain,
          emails: verifiedEmails,
          technology: techData,
          cost_estimate: {
            hunter: '$0.50-1.00',
            builtwith: 'Free tier',
            total: '~$1.00 vs Apollo $5-10'
          },
          savings: '80-90% vs premium tools'
        };
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Log the search if tenant_id provided
    if (tenant_id) {
      try {
        const supabase = createSupabaseAdminClient();
        await supabase.from('scraping_jobs').insert({
          tenant_id,
          source: results.source || action,
          action,
          status: results.success ? 'completed' : 'failed',
          metadata: { 
            query: domain || email || query,
            location,
            results_count: results.count || results.emails?.length || results.places?.length,
            cost_estimate: results.cost_estimate
          },
        });
      } catch (e) {
        console.warn('[AffordableScraper] Failed to log job:', e);
      }
    }

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('[AffordableScraper] Fatal error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal error' 
    }, { status: 500 });
  }
}
