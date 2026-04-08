import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { BrowserManager } from '@/lib/scraper/browserManager';
import {
  RouteAuthError,
  createAdminSupabaseClientOrThrow,
  requireTenantAccess,
  routeErrorResponse,
} from '@/lib/apiAuth';

// Client-friendly error messages
const CLIENT_ERRORS = {
  NETWORK_ERROR: {
    title: 'Connection Issue',
    message: 'We cannot reach the website right now.',
    suggestion: 'Please check if the website URL is correct and try again in a few minutes.',
    type: 'warning'
  },
  TIMEOUT_ERROR: {
    title: 'Website Slow to Respond',
    message: 'The website is taking too long to load.',
    suggestion: 'Try again later or contact support if this continues.',
    type: 'warning'
  },
  NOT_FOUND: {
    title: 'Website Not Found',
    message: 'The website address does not exist.',
    suggestion: 'Please double-check the URL and try again.',
    type: 'error'
  },
  FORBIDDEN: {
    title: 'Access Restricted',
    message: 'The website does not allow automated access.',
    suggestion: 'This website may have anti-scraping protection. Try a different source.',
    type: 'warning'
  },
  CAPTCHA_ERROR: {
    title: 'Security Check Detected',
    message: 'The website has security measures in place.',
    suggestion: 'Please try a different website or contact support for assistance.',
    type: 'warning'
  },
  NO_LEADS_FOUND: {
    title: 'No Leads Found',
    message: 'We could not find any business leads on this page.',
    suggestion: 'Try a different page or check if this website contains business information.',
    type: 'info'
  },
  TECHNICAL_ERROR: {
    title: 'Scraping System Error',
    message: 'Our lead discovery system encountered an issue.',
    suggestion: 'Please try again. If the problem continues, our team will investigate.',
    type: 'error'
  },
  UNKNOWN_ERROR: {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected issue while finding leads.',
    suggestion: 'Please try again. If this continues, contact our support team.',
    type: 'error'
  }
};

function translateErrorToClient(error: any): typeof CLIENT_ERRORS[keyof typeof CLIENT_ERRORS] {
  const errorMessage = error?.message || error?.toString() || 'Unknown error';
  
  // Network and connection errors
  if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('network') || errorMessage.includes('ENOTFOUND')) {
    return CLIENT_ERRORS.NETWORK_ERROR;
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT') || errorMessage.includes('ETIMEDOUT')) {
    return CLIENT_ERRORS.TIMEOUT_ERROR;
  }
  
  // HTTP status errors
  if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
    return CLIENT_ERRORS.NOT_FOUND;
  }
  
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('401')) {
    return CLIENT_ERRORS.FORBIDDEN;
  }
  
  // CAPTCHA and security errors
  if (errorMessage.includes('captcha') || errorMessage.includes('CAPTCHA') || errorMessage.includes('challenge')) {
    return CLIENT_ERRORS.CAPTCHA_ERROR;
  }
  
  // No leads found
  if (errorMessage.includes('No leads found') || errorMessage.includes('empty') || errorMessage.includes('no data')) {
    return CLIENT_ERRORS.NO_LEADS_FOUND;
  }
  
  // Puppeteer/Playwright specific errors
  if (errorMessage.includes('puppeteer') || errorMessage.includes('playwright') || errorMessage.includes('browser')) {
    return CLIENT_ERRORS.TECHNICAL_ERROR;
  }
  
  // Default to unknown error
  return CLIENT_ERRORS.UNKNOWN_ERROR;
}

type ScrapedLead = {
  businessName: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  category: string;
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s()]*)?(?:\d{2,4}[-.\s()]*){2,4}\d{2,4}/g;

function extractFirstEmail(html: string, $: cheerio.CheerioAPI) {
  const mailto = $('a[href^="mailto:"]').first().attr('href')?.replace('mailto:', '').split('?')[0].trim();
  if (mailto) return mailto.toLowerCase();

  const matches = html.match(EMAIL_REGEX) || [];
  return matches
    .map((match) => match.toLowerCase())
    .find((match) => !match.includes('example.com') && !match.endsWith('.png') && !match.endsWith('.jpg'))
    || '';
}

function extractFirstPhone(html: string, $: cheerio.CheerioAPI) {
  const tel = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '').trim();
  if (tel) return tel;

  const matches = html.match(PHONE_REGEX) || [];
  return matches.find((match) => match.replace(/\D/g, '').length >= 7) || '';
}

async function loadPageHtml(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      },
      timeout: 10000,
    });

    if (typeof response.data === 'string' && response.data.length > 1000) {
      return response.data;
    }
  } catch (error) {
    console.warn('[Playwright Scrape] Static fetch failed, falling back to browser engine:', error);
  }

  const { page } = await BrowserManager.createPage();

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    return await page.content();
  } finally {
    await page.context().close().catch(() => undefined);
  }
}

async function scrapeLead(url: string): Promise<{ leadsFound: number; leads: ScrapedLead[] }> {
  const html = await loadPageHtml(url);
  const $ = cheerio.load(html);
  const hostname = new URL(url).hostname.replace(/^www\./, '');

  const businessName =
    $('meta[property="og:site_name"]').attr('content')?.trim()
    || $('h1').first().text().trim()
    || $('title').text().split(/[-|:]/)[0].trim()
    || hostname;

  const email = extractFirstEmail(html, $);
  const phone = extractFirstPhone(html, $);
  const address = $('address').first().text().replace(/\s+/g, ' ').trim();
  const category =
    $('meta[name="description"]').attr('content')?.trim()
    || $('meta[property="og:description"]').attr('content')?.trim()
    || 'Website lead';

  if (!email && !phone) {
    return { leadsFound: 0, leads: [] };
  }

  return {
    leadsFound: 1,
    leads: [{
      businessName,
      website: url,
      email,
      phone,
      address,
      category,
    }],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantId = (body.tenant_id || body.tenantId || '').trim();
    const url = body.url;

    if (!tenantId || !url) {
      return NextResponse.json(
        { error: 'Missing tenantId or url' },
        { status: 400 }
      );
    }

    await requireTenantAccess(tenantId);

    // Basic URL validation
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Unsupported protocol');
      }
    } catch {
      const clientError = CLIENT_ERRORS.NOT_FOUND;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 400 });
    }

    // Create a scraping job record
    const supabase = createAdminSupabaseClientOrThrow();
    const { data: job, error: jobError } = await supabase
      .from('scraping_jobs')
      .insert({
        tenant_id: tenantId,
        url,
        status: 'pending',
        leads_found: 0,
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    if (jobError) {
      const clientError = CLIENT_ERRORS.TECHNICAL_ERROR;
      return NextResponse.json({
        error: clientError,
        clientFriendly: true
      }, { status: 500 });
    }

    try {
      const scrapingResult = await scrapeLead(url);
      
      // Update job with results
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'completed',
          leads_found: scrapingResult.leadsFound,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      // If leads were found, save them to the leads table
      if (scrapingResult.leadsFound > 0 && scrapingResult.leads) {
        for (const lead of scrapingResult.leads) {
          await supabase
            .from('leads')
            .insert({
              tenant_id: tenantId,
              business_name: lead.businessName,
              website: lead.website,
              email: lead.email,
              phone: lead.phone,
              address: lead.address,
              category: lead.category,
              source: 'playwright_scraping',
              created_at: new Date().toISOString()
            });
        }
      }

      return NextResponse.json({
        success: true,
        jobId: job.id,
        leadsFound: scrapingResult.leadsFound,
        message: scrapingResult.leadsFound > 0
          ? `Successfully found ${scrapingResult.leadsFound} leads`
          : 'No contactable leads were found on this page'
      });

    } catch (scrapingError) {
      // Update job with error
      const clientError = translateErrorToClient(scrapingError);
      
      await supabase
        .from('scraping_jobs')
        .update({
          status: 'failed',
          error_message: clientError.message,
          completed_at: new Date().toISOString()
        })
        .eq('id', job.id);

      return NextResponse.json({
        error: clientError,
        clientFriendly: true,
        jobId: job.id
      }, { status: 500 });
    }

  } catch (error) {
    if (error instanceof RouteAuthError) {
      return routeErrorResponse(error);
    }

    console.error('Playwright scraping error:', error);
    const clientError = translateErrorToClient(error);
    
    return NextResponse.json({
      error: clientError,
      clientFriendly: true
    }, { status: 500 });
  }
}
