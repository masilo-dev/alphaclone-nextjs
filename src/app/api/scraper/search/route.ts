import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

const EXCLUDED = ['duckduckgo', 'yelp.', 'yellowpages.', 'bing.com', 'google.com', 'search?'];
const isValidUrl = (url: string) => url?.startsWith('http') && !EXCLUDED.some(ex => url.includes(ex));
const cleanTitle = (t: string) => t.replace(/[|–-].*/, '').trim();

// ─── Strategy 1: Bing HTML (most reliable from Vercel/cloud IPs) ─────────────
async function fetchBing(query: string) {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query + ' business contact')}&count=20&setlang=en`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 12000 });
  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $('li.b_algo').each((_, el) => {
    if (results.length >= 12) return false;
    const anchor = $(el).find('h2 a');
    const title = anchor.text().trim();
    const href = anchor.attr('href') || '';
    const snippet = $(el).find('.b_caption p, .b_dList li').first().text().trim();
    if (title && isValidUrl(href)) {
      results.push({ business_name: cleanTitle(title), website: href, snippet });
    }
  });

  return results;
}

// ─── Strategy 2: DuckDuckGo HTML (fallback) ───────────────────────────────────
async function fetchDuckDuckGo(query: string) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + ' business')}`;
  const res = await axios.get(url, { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(res.data);
  const results: any[] = [];

  $('.result, .web-result').each((_, el) => {
    if (results.length >= 12) return false;
    const anchor = $(el).find('a.result__a, h2 a').first();
    const title = anchor.text().trim();
    let href = anchor.attr('href') || $(el).find('.result__url').text().trim();

    if (href.startsWith('//')) href = 'https:' + href;
    // DDG sometimes uses redirect URLs with uddg= param
    if (href.includes('uddg=')) {
      try { href = decodeURIComponent(new URL('https://x.com' + href).searchParams.get('uddg') || href); } catch {}
    }
    if (!href.startsWith('http')) href = `https://${href}`;

    const snippet = $(el).find('.result__snippet').text().trim();
    if (title && isValidUrl(href)) {
      results.push({ business_name: cleanTitle(title), website: href, snippet });
    }
  });

  return results;
}

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query) return NextResponse.json({ error: 'Query is required' }, { status: 400 });

    // Try Bing first (more reliable on cloud IPs), then DDG as fallback
    let results: any[] = [];

    try {
      results = await fetchBing(query);
    } catch (e: any) {
      console.warn('Bing search failed:', e.message, '— trying DuckDuckGo...');
    }

    if (results.length === 0) {
      try {
        results = await fetchDuckDuckGo(query);
      } catch (e: any) {
        console.warn('DuckDuckGo also failed:', e.message);
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        results: [],
        error: 'No results found. Search engines may be throttling this server. Try a more specific query or wait a moment and retry.',
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('Scraping Error:', error.message);
    return NextResponse.json({
      success: false,
      error: 'Search engine temporarily unavailable. Please try again.',
    }, { status: 500 });
  }
}
