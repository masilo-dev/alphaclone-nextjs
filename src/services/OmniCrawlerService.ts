import { enhancedMapService } from './enhancedLeadFinderServices';
import { googlePlacesService } from './googlePlacesService';
import { ENV } from '@/config/env';
import { leadService, Lead } from './leadService';

export interface CrawlerResult {
  source: 'osm' | 'google_maps';
  leads: Partial<Lead>[];
}

export class OmniCrawlerService {
  /**
   * Run simultaneous discovery across multiple sources
   */
  async discoverLeads(params: {
    niche: string;
    location: string;
    limit?: number;
  }): Promise<Partial<Lead>[]> {
    const limit = params.limit || 50;
    const googleApiKey = ENV.VITE_GOOGLE_API_KEY || ENV.GOOGLE_API_KEY;

    console.log(`[OmniCrawler] Starting simultaneous discovery for "${params.niche}" in "${params.location}"`);

    const [osmResults, googleResults] = await Promise.all([
      // Source 1: OpenStreetMap (OSM)
      enhancedMapService.getBusinessData(params.niche, params.location, limit),
      
      // Source 2: Google Maps (Places API)
      googleApiKey 
        ? googlePlacesService.searchPlaces(`${params.niche} in ${params.location}`, googleApiKey)
        : Promise.resolve({ places: [], error: 'Google API key missing' })
    ]);

    const allLeads: Partial<Lead>[] = [];

    // Process OSM Results
    if (Array.isArray(osmResults)) {
      osmResults.forEach(item => {
        allLeads.push({
          businessName: item.business_name,
          industry: item.category,
          location: item.address,
          phone: item.phone,
          email: item.email,
          website: item.website,
          lat: item.lat,
          lng: item.lng,
          source: 'OpenStreetMap',
          notes: `OSM ID: ${item.id}`
        });
      });
    }

    // Process Google Results
    if (googleResults && !googleResults.error && Array.isArray(googleResults.places)) {
      googleResults.places.forEach(item => {
        allLeads.push({
          businessName: item.businessName,
          industry: item.industry,
          location: item.location,
          phone: item.phone,
          website: item.website,
          lat: item.lat,
          lng: item.lng,
          source: 'Google Maps'
        });
      });
    }

    // Deduplicate leads by business name + location (basic)
    const uniqueLeads = this.deduplicateLeads(allLeads);

    console.log(`[OmniCrawler] Discovery complete. Found ${uniqueLeads.length} unique leads from dual-source crawl.`);
    
    return uniqueLeads;
  }

  /**
   * Deduplicate leads based on business name and approximate location
   */
  private deduplicateLeads(leads: Partial<Lead>[]): Partial<Lead>[] {
    const seen = new Set<string>();
    return leads.filter(lead => {
      const key = `${(lead.businessName || '').toLowerCase()}|${(lead.location || '').toLowerCase().substring(0, 15)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Auto-crawl and save to database
   */
  async runAutoCrawl(niche: string, location: string): Promise<number> {
    const leads = await this.discoverLeads({ niche, location });
    
    if (leads.length === 0) return 0;

    const { count, error } = await leadService.addBulkLeads(leads);
    
    if (error) {
      console.error('[OmniCrawler] Failed to save discovered leads:', error);
      throw new Error(error);
    }

    return count;
  }
}

export const omniCrawlerService = new OmniCrawlerService();
export default omniCrawlerService;
