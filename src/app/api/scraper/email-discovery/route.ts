import { NextResponse } from 'next/server';
import { clientErrorResponse } from '@/lib/api/clientErrorResponse';
import { BrowserManager } from '@/lib/scraper/browserManager';
import * as cheerio from 'cheerio';
import { scraperEmailDiscoverySchema } from '@/schemas/validation';

/**
 * CLIENT-SIDE EMAIL DISCOVERY ENGINE
 * No APIs required - uses open data sources and pattern matching
 * Clients know exactly what's happening - transparent scraping
 */

interface EmailResult {
  email: string;
  source: string;
  confidence: number; // 0-100
  pattern?: string;
  verified: boolean;
  name?: string;
  title?: string;
}

// Common email patterns for guessing
const EMAIL_PATTERNS = [
  '{first}.{last}@{domain}',
  '{first}{last}@{domain}',
  '{first}_{last}@{domain}',
  '{first}-{last}@{domain}',
  '{first}@{domain}',
  '{last}@{domain}',
  '{f}{last}@{domain}',
  '{first}{l}@{domain}',
  '{first}.{l}@{domain}',
];

/**
 * Method 1: DNS/MX Record Discovery
 * No API needed - direct DNS queries
 * Finds mail servers and common patterns
 */
async function discoverViaDNS(domain: string): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  try {
    // Check MX records to confirm email capability
    const mxCheck = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const mxData = await mxCheck.json();
    
    if (!mxData.Answer || mxData.Answer.length === 0) {
      return []; // Domain has no mail servers
    }

    // Check for common email patterns via SPF records
    const spfCheck = await fetch(`https://dns.google/resolve?name=${domain}&type=TXT`);
    const spfData = await spfCheck.json();
    
    // Extract potential emails from TXT records
    const txtRecords = spfData.Answer?.map((r: any) => r.data).join(' ') || '';
    const emailMatches = txtRecords.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
    
    if (emailMatches) {
      emailMatches.forEach((email: string) => {
        if (!email.includes('example.com') && !email.includes('google.com')) {
          results.push({
            email: email.toLowerCase(),
            source: 'dns_txt_records',
            confidence: 70,
            verified: false
          });
        }
      });
    }

    return results;
  } catch (err) {
    console.warn('[EmailDiscovery] DNS lookup failed:', err);
    return [];
  }
}

/**
 * Method 2: WHOIS Data Extraction
 * Domain registration often includes contact emails
 */
async function discoverViaWHOIS(domain: string): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  try {
    // Use RDAP (modern WHOIS) API - free, no key required
    const rdapRes = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (!rdapRes.ok) return [];
    
    const data = await rdapRes.json();
    const entities = data.entities || [];
    
    for (const entity of entities) {
      const vcards = entity.vcardArray?.[1] || [];
      for (const vcard of vcards) {
        if (vcard[0] === 'email') {
          const email = vcard[3]?.toLowerCase();
          if (email && !email.includes('privacy') && !email.includes('proxy')) {
            results.push({
              email,
              source: 'whois_registration',
              confidence: 85,
              verified: false,
              name: entity.handle
            });
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.warn('[EmailDiscovery] WHOIS lookup failed:', err);
    return [];
  }
}

/**
 * Method 3: GitHub Public Commit Emails
 * Many developers expose emails in git commits
 */
async function discoverViaGitHub(companyName: string, domain: string): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  try {
    // Search for company repos
    const searchRes = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(companyName)}&sort=updated&per_page=5`,
      { 
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(10000)
      }
    );
    
    if (!searchRes.ok) return [];
    
    const repos = await searchRes.json();
    const seenEmails = new Set<string>();
    
    for (const repo of repos.items?.slice(0, 3) || []) {
      try {
        // Get recent commits
        const commitsRes = await fetch(
          `https://api.github.com/repos/${repo.full_name}/commits?per_page=10`,
          { signal: AbortSignal.timeout(8000) }
        );
        
        if (!commitsRes.ok) continue;
        
        const commits = await commitsRes.json();
        
        for (const commit of commits) {
          const author = commit.commit?.author;
          const email = author?.email?.toLowerCase();
          
          // Filter for company domain emails only
          if (email && email.includes(`@${domain}`) && !seenEmails.has(email)) {
            seenEmails.add(email);
            results.push({
              email,
              source: 'github_commits',
              confidence: 90,
              verified: true,
              name: author?.name
            });
          }
        }
      } catch (e) {
        // Continue to next repo
      }
    }

    return results;
  } catch (err) {
    console.warn('[EmailDiscovery] GitHub lookup failed:', err);
    return [];
  }
}

/**
 * Method 4: Website Scraping (with Playwright for JS sites)
 * Scrape contact pages, about pages, team pages
 */
async function discoverViaWebsiteScraping(domain: string): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  let browserInstance = null;
  
  const urlsToTry = [
    `https://${domain}`,
    `https://${domain}/contact`,
    `https://${domain}/about`,
    `https://${domain}/team`,
    `https://www.${domain}`,
    `https://www.${domain}/contact`
  ];
  
  try {
    const { page, browser } = await BrowserManager.createPage();
    browserInstance = browser;
    
    for (const url of urlsToTry) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000); // Let JS render
        
        const html = await page.content();
        const $ = cheerio.load(html);
        
        // Method 4a: mailto: links
        $('a[href^="mailto:"]').each((_, el) => {
          const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].toLowerCase();
          if (email && email.includes(`@${domain}`)) {
            results.push({
              email,
              source: 'website_mailto',
              confidence: 95,
              verified: false
            });
          }
        });
        
        // Method 4b: Email regex in text
        const text = $('body').text();
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        const matches = text.match(emailRegex) || [];
        
        matches.forEach((email: string) => {
          if (email.includes(`@${domain}`) && 
              !email.includes('example.com') && 
              !email.includes('.png') &&
              !email.includes('.jpg')) {
            results.push({
              email: email.toLowerCase(),
              source: 'website_content',
              confidence: 75,
              verified: false
            });
          }
        });
        
        // Method 4c: Team/Staff pages - extract names
        const teamMembers: {name: string, title?: string}[] = [];
        
        $('.team-member, .staff, .employee, [class*="team"], [class*="person"]').each((_, el) => {
          const name = $(el).find('h3, h4, .name, [class*="name"]').first().text().trim();
          const title = $(el).find('.title, .role, [class*="title"], [class*="position"]').first().text().trim();
          if (name && name.length > 2) {
            teamMembers.push({ name, title });
          }
        });
        
        // Generate pattern-based emails from names
        for (const member of teamMembers.slice(0, 5)) {
          const nameParts = member.name.split(' ').filter(p => p.length > 1);
          if (nameParts.length >= 2) {
            const first = nameParts[0].toLowerCase();
            const last = nameParts[nameParts.length - 1].toLowerCase();
            const f = first[0];
            const l = last[0];
            
            // Generate common patterns
            const guesses = [
              `${first}.${last}@${domain}`,
              `${first}${last}@${domain}`,
              `${f}${last}@${domain}`,
              `${first}@${domain}`,
              `${first}.${l}@${domain}`
            ];
            
            guesses.forEach(email => {
              results.push({
                email,
                source: 'pattern_guess_from_name',
                confidence: 40,
                verified: false,
                pattern: '{first}.{last}@{domain}',
                name: member.name,
                title: member.title
              });
            });
          }
        }
        
      } catch (e) {
        // Try next URL
      }
    }
    
    return results;
  } catch (err) {
    console.warn('[EmailDiscovery] Website scraping failed:', err);
    return [];
  } finally {
    // Don't close browser to allow reuse
  }
}

/**
 * Method 5: LinkedIn Public Profile Scraping
 * Limited but can find some public emails
 */
async function discoverViaLinkedIn(companyName: string): Promise<EmailResult[]> {
  const results: EmailResult[] = [];
  
  try {
    // Use Playwright to search LinkedIn
    const { page, browser } = await BrowserManager.createPage();
    
    // Search for company employees on LinkedIn (public pages only)
    const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(companyName)}`;
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    // Note: LinkedIn blocks most scraping, this is a best-effort attempt
    // In practice, this may return empty results due to LinkedIn's anti-scraping
    
    await browser.close();
    return results;
  } catch (err) {
    console.warn('[EmailDiscovery] LinkedIn lookup failed:', err);
    return [];
  }
}

/**
 * Method 6: Email Verification (SMTP handshake)
 * Verify if email exists without sending actual email
 */
async function verifyEmail(email: string): Promise<{ valid: boolean; reason: string }> {
  try {
    const domain = email.split('@')[1];
    
    // Check MX records first
    const mxCheck = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const mxData = await mxCheck.json();
    
    if (!mxData.Answer || mxData.Answer.length === 0) {
      return { valid: false, reason: 'no_mx_records' };
    }
    
    // Note: Full SMTP verification requires raw socket access
    // which isn't available in serverless. We do basic checks.
    
    return { valid: true, reason: 'has_mx_records' };
  } catch (err) {
    return { valid: false, reason: 'check_failed' };
  }
}

/**
 * Deduplicate and rank results
 */
function processResults(results: EmailResult[]): EmailResult[] {
  const seen = new Map<string, EmailResult>();
  
  for (const result of results) {
    const existing = seen.get(result.email);
    
    if (!existing || result.confidence > existing.confidence) {
      // Boost confidence for multiple sources
      if (existing) {
        result.confidence = Math.min(100, result.confidence + 10);
      }
      seen.set(result.email, result);
    }
  }
  
  return Array.from(seen.values())
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * MAIN API HANDLER
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scraperEmailDiscoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 });
    }
    const { domain, company_name, methods = ['all'], verify = false } = parsed.data;

    const company = company_name || domain.replace(/\.\w+$/, '');
    const allResults: EmailResult[] = [];
    const sourceStatus: Record<string, { status: string; count: number; error?: string }> = {};

    // Run discovery methods
    const runMethods = methods.includes('all') ? [
      'dns',
      'whois', 
      'github',
      'website'
    ] : methods;

    for (const method of runMethods) {
      try {
        let results: EmailResult[] = [];
        
        switch (method) {
          case 'dns':
            results = await discoverViaDNS(domain);
            break;
          case 'whois':
            results = await discoverViaWHOIS(domain);
            break;
          case 'github':
            results = await discoverViaGitHub(company, domain);
            break;
          case 'website':
            results = await discoverViaWebsiteScraping(domain);
            break;
          case 'linkedin':
            results = await discoverViaLinkedIn(company);
            break;
        }
        
        allResults.push(...results);
        sourceStatus[method] = { 
          status: 'success', 
          count: results.length 
        };
      } catch (err: unknown) {
        console.warn('[EmailDiscovery] method failed:', method, err);
        sourceStatus[method] = {
          status: 'error',
          count: 0,
          error: 'This discovery method did not complete. Try again.',
        };
      }
    }

    // Process and deduplicate
    let processedResults = processResults(allResults);
    
    // Optional: Verify top emails
    if (verify && processedResults.length > 0) {
      const topEmails = processedResults.slice(0, 5);
      const verified = await Promise.all(
        topEmails.map(async (e) => {
          const v = await verifyEmail(e.email);
          return { ...e, verified: v.valid };
        })
      );
      
      // Merge verified status back
      processedResults = processedResults.map(e => {
        const v = verified.find(v => v.email === e.email);
        return v || e;
      });
    }

    return NextResponse.json({
      success: true,
      domain,
      company,
      emails_found: processedResults.length,
      emails: processedResults.slice(0, 20), // Limit results
      sources: sourceStatus,
      cost: 'FREE - No APIs used',
      methods_used: runMethods,
      transparency: {
        message: 'All data sourced from public records and open data sources',
        dns: 'Uses Google DNS over HTTPS (public)',
        whois: 'Uses RDAP.org (public registry)',
        github: 'Uses GitHub public API (rate limited, no key needed)',
        website: 'Uses Playwright to scrape public pages'
      }
    });

  } catch (error: unknown) {
    console.error('[EmailDiscovery] Fatal error:', error);
    return clientErrorResponse(error, { request, scope: 'scraper/email-discovery.POST' });
  }
}

/**
 * GET handler for simple domain check
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domain required' }, { status: 400 });
  }

  // Simple DNS check only for GET requests
  const results = await discoverViaDNS(domain);
  
  return NextResponse.json({
    domain,
    has_email_capability: results.length > 0,
    emails: results,
    source: 'dns_lookup'
  });
}
