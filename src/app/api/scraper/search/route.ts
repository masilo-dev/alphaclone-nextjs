import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { BrowserManager } from '@/lib/scraper/browserManager';

// ─── Free & Randomized Scraping Infrastructure ─────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1'
];

const getHeaders = () => ({
  'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
});

const EXCLUDED = ['duckduckgo', 'yelp.', 'yellowpages.', 'bing.com', 'google.com', 'search?', 'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com/search'];
const isValidUrl = (url: string) => url?.startsWith('http') && !EXCLUDED.some(ex => url.includes(ex));
const cleanTitle = (t: string) => t.replace(/[|–-].*/, '').trim();

// ─── Strategy 1: Bing Business Dorks ─────────────────────────────────────────
async function fetchBing(query: string) {
  // We use "Search Dorks" to find direct business contact pages & directories
  const dorkedQuery = `${query} (site:yelp.com OR site:yellowpages.com OR site:linkedin.com/company OR "contact us" OR "about us")`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(dorkedQuery)}&count=20&setlang=en`;
  
  const res = await axios.get(url, { headers: getHeaders(), timeout: 15000 });
  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $('li.b_algo').each((_, el) => {
    if (results.length >= 15) return false;
    const anchor = $(el).find('h2 a');
    const title = anchor.text().trim();
    const href = anchor.attr('href') || '';
    const snippet = $(el).find('.b_caption p, .b_dList li').first().text().trim();
    
    if (title && href.startsWith('http')) {
      results.push({ 
        business_name: cleanTitle(title), 
        website: href, 
        snippet: snippet || 'Business directory listing identified.' 
      });
    }
  });

  return results;
}

// ─── Strategy 2: DuckDuckGo Universal Fallback ────────────────────────────────
async function fetchDuckDuckGo(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' "contact us" business')}`;
  const res = await axios.get(url, { headers: getHeaders(), timeout: 12000 });
  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $('.result, .web-result').each((_, el) => {
    if (results.length >= 12) return false;
    const anchor = $(el).find('a.result__a, h2 a').first();
    const title = anchor.text().trim();
    let href = anchor.attr('href') || $(el).find('.result__url').text().trim();

    if (href.startsWith('//')) href = 'https:' + href;
    if (href.includes('uddg=')) {
      try { 
        const urlParams = new URLSearchParams(href.split('?')[1]);
        href = urlParams.get('uddg') || href;
      } catch {}
    }
    if (!href.startsWith('http')) href = `https://${href}`;

    const snippet = $(el).find('.result__snippet').text().trim();
    if (title && isValidUrl(href)) {
      results.push({ business_name: cleanTitle(title), website: href, snippet });
    }
  });

  return results;
}

async function fetchSocialLeads(query: string) {
  const socialQuery = `${query} site:linkedin.com/company OR site:facebook.com "contact"`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(socialQuery)}&count=10`;
  const res = await axios.get(url, { headers: getHeaders(), timeout: 10000 });
  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $('li.b_algo').each((_, el) => {
    const anchor = $(el).find('h2 a');
    const title = anchor.text().trim();
    const href = anchor.attr('href') || '';
    if (title && href) {
        results.push({ business_name: cleanTitle(title), website: href, snippet: 'Social profile identified.' });
    }
  });
  return results;
}

// ─── Strategy 4: Playwright Browser Search (Power Mode) ─────────────────────
async function fetchWithPlaywright(query: string) {
  const dorkedQuery = `${query} (site:yelp.com OR "contact us" OR "about us")`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(dorkedQuery)}&count=20`;
  
  console.log('[Scraper] Orchestrating Playwright search for:', query);
  
  try {
    const { page } = await BrowserManager.createPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for the results to actually render
    await page.waitForSelector('li.b_algo', { timeout: 10000 }).catch(() => null);
    
    const results = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('li.b_algo').forEach((el) => {
        const anchor = el.querySelector('h2 a') as HTMLAnchorElement;
        const title = anchor?.innerText || '';
        const href = anchor?.href || '';
        const snippet = (el.querySelector('.b_caption p') as HTMLElement)?.innerText || '';
        
        if (title && href && href.startsWith('http')) {
          items.push({ title, href, snippet });
        }
      });
      return items;
    });
    
    return results.map(r => ({
      business_name: r.title.replace(/[|–-].*/, '').trim(),
      website: r.href,
      snippet: r.snippet || 'Business listing identified via browser engine.'
    }));
  } catch (e: any) {
    console.error('[Scraper] Playwright search failed:', e.message);
    return [];
  }
}

export async function POST(request: Request) {
  try {
    const { query, usePlaywright = false } = await request.json();
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    let results: any[] = [];

    // 1. Prioritize Playwright if requested
    if (usePlaywright) {
      results = await fetchWithPlaywright(query);
    }

    // 2. Standard Fallback Sequence if Playwright skipped or returned 0
    if (results.length === 0) {
      try {
        results = await fetchBing(query);
      } catch (e: any) {
        console.warn('Bing Strategy 1 failed:', e.message);
      }
    }

    if (results.length < 5) {
      try {
        const ddgResults = await fetchDuckDuckGo(query);
        results = [...results, ...ddgResults];
      } catch (e: any) {
        console.warn('DDG fallback failed:', e.message);
      }
    }

    if (results.length < 3) {
      try {
        const socialResults = await fetchSocialLeads(query);
        results = [...results, ...socialResults];
      } catch (e: any) {
        console.warn('Social Strategy failed:', e.message);
      }
    }

    // 3. Last Resort: Automatic Playwright Fallback
    if (results.length === 0 && !usePlaywright) {
      console.log('[Scraper] Standard methods failed. Triggering automatic Playwright fallback...');
      results = await fetchWithPlaywright(query);
    }

    // De-duplicate by website
    const uniqueResults = Array.from(new Map(results.map(item => [item.website, item])).values());

    if (uniqueResults.length === 0) {
      return NextResponse.json({
        success: false,
        results: [],
        error: 'Engine temporarily re-routing due to high traffic in this business niche. Please try a more specific industry keyword.',
      });
    }

    return NextResponse.json({ success: true, results: uniqueResults.slice(0, 20) });

  } catch (error: any) {
    console.error('Universal Scraper Error:', error.message);
    return NextResponse.json({
      success: false,
      error: 'Business engine encountered an anomaly. Please retry with a refined niche.',
    }, { status: 500 });
  }
}
