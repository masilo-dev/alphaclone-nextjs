import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { BrowserManager } from '@/lib/scraper/browserManager';

// Regex for extracting emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export async function POST(request: Request) {
  let browserInstance = null;
  try {
    const { url, usePlaywright = false } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;
    let html = '';
    let usedBrowser = false;

    // 1. Fetch the Page Content (Strategy: Axios -> Playwright Fallback)
    try {
      if (usePlaywright) {
          throw new Error('Forced Power Mode'); // Skip to Playwright
      }
      
      const response = await axios.get(cleanUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 15000,
        maxRedirects: 5,
      });
      html = response.data;
      
      // Heuristic: If content is too small or looks like a JS challenge, try Playwright
      if (html.length < 1500 || html.includes('javascript') && !html.includes('<body')) {
          throw new Error('Minimal content detected, switching to Browser Engine');
      }
    } catch (e: any) {
      console.log(`[Scraper] Static extraction failed or skipped: ${e.message}. Launching Browser Engine...`);
      try {
          const { page, browser } = await BrowserManager.createPage();
          browserInstance = browser;
          await page.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
          // Wait a bit for JS to render
          await page.waitForTimeout(2000); 
          html = await page.content();
          usedBrowser = true;
      } catch (browserError: any) {
          console.error(`[Scraper] Browser Engine also failed:`, browserError.message);
          if (!html) throw browserError; // Only throw if we have NOTHING
      }
    }

    if (!html) throw new Error('Failed to retrieve page content from any engine');

    const $ = cheerio.load(html);
    
    // 2. Extract Data
    const emails = new Set<string>();
    const socialLinks: any = {
      facebook: '',
      instagram: '',
      linkedin: '',
      twitter: '',
      youtube: ''
    };
    let phone = '';

    // Match emails in text
    const textMatches = String(html).match(EMAIL_REGEX) || [];
    textMatches.forEach((email: string) => {
        const lower = email.toLowerCase();
        if (!lower.endsWith('.png') && !lower.endsWith('.jpg') && !lower.endsWith('.sentry.io') && !lower.includes('example.com')) {
            emails.add(lower);
        }
    });

    // Check mailto links specifically
    $('a[href^="mailto:"]').each((_, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email && !email.includes('example.com')) emails.add(email);
    });

    // Extract Social Links
    $('a[href*="facebook.com/"], a[href*="fb.com/"]').each((_, el) => { 
        const href = $(el).attr('href');
        if (href && !href.includes('sharer')) socialLinks.facebook = href; 
    });
    $('a[href*="instagram.com/"]').each((_, el) => { socialLinks.instagram = $(el).attr('href') || socialLinks.instagram; });
    $('a[href*="linkedin.com/company/"], a[href*="linkedin.com/in/"]').each((_, el) => { socialLinks.linkedin = $(el).attr('href') || socialLinks.linkedin; });
    $('a[href*="twitter.com/"], a[href*="x.com/"]').each((_, el) => { socialLinks.twitter = $(el).attr('href') || socialLinks.twitter; });
    $('a[href*="youtube.com/"]').each((_, el) => { socialLinks.youtube = $(el).attr('href') || socialLinks.youtube; });

    // Extract Phone Numbers
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
        phone = telLink.replace('tel:', '').trim();
    } else {
        const phoneRegex = /(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})/g;
        const phoneMatch = html.match(phoneRegex);
        if (phoneMatch && phoneMatch.length > 0) {
            phone = phoneMatch[0].trim();
        }
    }

    return NextResponse.json({
      success: true,
      engine: usedBrowser ? 'playwright' : 'axios',
      emails: Array.from(emails).slice(0, 5), 
      phone,
      social_links: socialLinks
    });

  } catch (error: any) {
    console.error(`Deep Crawl Error:`, error.message);
    return NextResponse.json({ 
      success: false, 
      emails: [],
      phone: '',
      social_links: {}
    }, { status: 200 });
  } finally {
    if (browserInstance) {
      try { await browserInstance.close(); } catch {}
    }
  }
}
