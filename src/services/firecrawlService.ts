import { LeadResult } from '@/lib/scraper/freeLeadSearch';

export const firecrawlService = {
  /**
   * Search for leads using Firecrawl's /search endpoint
   */
  async searchLeads(query: string, limit: number = 20): Promise<LeadResult[]> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      console.warn('[Firecrawl] API key not configured');
      return [];
    }

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: query,
          limit: limit,
          lang: 'en',
          location: 'United States', // Can be customized
          scrapeOptions: {
            formats: ['markdown'],
            // Extract structured data if possible
          }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[Firecrawl] API error: ${response.status}`, error);
        return [];
      }

      const data = await response.json();
      const results = data.data || [];

      return results.map((item: any): LeadResult => ({
        business_name: item.title || 'Unknown Business',
        website: item.url || '',
        snippet: item.description || item.snippet || 'Found via AI web search',
        phone: '', // Firecrawl search doesn't usually provide phone directly
        email: '', // Needs deeper scraping
        address: '',
        rating: undefined,
        category: 'Lead',
        source: 'firecrawl',
        lat: undefined,
        lng: undefined,
        hasContact: !!(item.url),
      }));
    } catch (err) {
      console.error('[Firecrawl] Search failed:', err);
      return [];
    }
  },

  /**
   * Scrape a specific URL to extract contact info
   */
  async extractContactInfo(url: string): Promise<{ email?: string; phone?: string; socials?: string[] }> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) return {};

    try {
      const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: url,
          formats: ['extract'],
          extract: {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                phone: { type: 'string' },
                socials: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }),
      });

      if (!response.ok) return {};

      const data = await response.json();
      return data.data?.extract || {};
    } catch (err) {
      console.error('[Firecrawl] Extraction failed:', err);
      return {};
    }
  }
};
