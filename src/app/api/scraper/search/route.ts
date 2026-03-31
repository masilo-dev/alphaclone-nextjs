import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // We use DuckDuckGo HTML version for free, lightweight search extraction
    // Format: https://html.duckduckgo.com/html/?q=plumbers+in+austin+site:.com
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " business")}`;
    
    // Sometimes scrapers get blocked. Provide a realistic User-Agent.
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      timeout: 10000 // 10 second timeout
    });

    const $ = cheerio.load(response.data);
    
    const results: any[] = [];
    
    // DuckDuckGo HTML structure
    $('.result').each((i, element) => {
      if (i >= 15) return false; // Max 15 per batch to avoid overload
      
      const titleElement = $(element).find('.result__title .result__a');
      const snippetElement = $(element).find('.result__snippet');
      const urlElement = $(element).find('.result__url');
      
      const title = titleElement.text().trim();
      const rawUrl = urlElement.attr('href') || urlElement.text().trim();
      const snippet = snippetElement.text().trim();
      
      // Clean up URL (DuckDuckGo sometimes prefixes with /url?q=)
      let cleanUrl = rawUrl;
      if (cleanUrl.startsWith('//')) {
          cleanUrl = 'https:' + cleanUrl;
      }
      
      if (title && cleanUrl && cleanUrl.startsWith('http') && !cleanUrl.includes('duckduckgo') && !cleanUrl.includes('yelp.') && !cleanUrl.includes('yellowpages.') && !cleanUrl.includes('facebook.') && !cleanUrl.includes('instagram.')) {
        results.push({
          business_name: title.replace(/\|.*/, '').trim(), // Remove SEO titles
          website: cleanUrl,
          snippet: snippet
        });
      }
    });

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Scraping Error:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to extract directory leads. Please try a different query.',
      details: error.message 
    }, { status: 500 });
  }
}
