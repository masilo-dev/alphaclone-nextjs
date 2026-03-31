import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Regex for extracting emails
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const cleanUrl = url.startsWith('http') ? url : `https://${url}`;

    // 1. Fetch the Homepage
    const response = await axios.get(cleanUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 8000 // 8 second timeout to prevent hanging on bad sites
    });

    const html = response.data;
    const $ = cheerio.load(html);
    
    // 2. Extract Data
    const emails = new Set<string>();
    const socialLinks = {
      facebook: '',
      instagram: '',
      linkedin: '',
      twitter: ''
    };
    let phone = '';

    // Match emails in text
    const textMatches = html.match(EMAIL_REGEX) || [];
    textMatches.forEach((email: string) => {
        // filter out common image extensions or fake emails
        if (!email.endsWith('.png') && !email.endsWith('.jpg') && !email.endsWith('.sentry.io')) {
            emails.add(email.toLowerCase());
        }
    });

    // Check mailto links specifically
    $('a[href^="mailto:"]').each((i, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].trim();
      if (email) emails.add(email.toLowerCase());
    });

    // Extract Social Links
    $('a[href*="facebook.com"], a[href*="fb.me"]').each((i, el) => { socialLinks.facebook = $(el).attr('href') || socialLinks.facebook; });
    $('a[href*="instagram.com"]').each((i, el) => { socialLinks.instagram = $(el).attr('href') || socialLinks.instagram; });
    $('a[href*="linkedin.com/company"]').each((i, el) => { socialLinks.linkedin = $(el).attr('href') || socialLinks.linkedin; });
    $('a[href*="twitter.com"], a[href*="x.com"]').each((i, el) => { socialLinks.twitter = $(el).attr('href') || socialLinks.twitter; });

    // Extract Phone Numbers (tel: links as highly accurate source)
    const telLink = $('a[href^="tel:"]').first().attr('href');
    if (telLink) {
        phone = telLink.replace('tel:', '');
    }

    return NextResponse.json({
      success: true,
      emails: Array.from(emails).slice(0, 3), // Return up to 3 emails
      phone,
      social_links: socialLinks
    });

  } catch (error: any) {
    console.error(`Deep Crawl Error (${request.url}):`, error.message);
    // Return empty results rather than throwing, so batch processing doesn't crash
    return NextResponse.json({ 
      success: false, 
      emails: [],
      phone: '',
      social_links: {}
    }, { status: 200 });
  }
}
