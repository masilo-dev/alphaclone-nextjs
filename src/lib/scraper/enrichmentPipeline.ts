/**
 * Enrichment Pipeline
 *
 * Given a business website URL, runs a 5-pass waterfall to extract:
 *   - emails
 *   - phone numbers
 *   - social media links
 *   - tech stack hints
 *
 * Pass 1: got + node-html-parser  (ultra-fast, handles redirects/cookies)
 * Pass 2: got + cheerio            (thorough static HTML parse)
 * Pass 3: JSDOM                    (handles SSR-hydrated HTML)
 * Pass 4: Puppeteer via Browserbase (JS-rendered sites)
 * Pass 5: Playwright via Browserbase (deepest, last resort)
 *
 * robots.txt is checked before any pass — if disallowed, returns empty.
 * Source is NEVER included in the output — internal engine only.
 */

import * as cheerio from 'cheerio';
import { BrowserManager } from '@/lib/scraper/browserManager';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  emails: string[];
  phone: string;
  socialLinks: Record<string, string>;
  techStack: string[];
}

const EMPTY: EnrichmentResult = {
  emails: [],
  phone: '',
  socialLinks: {},
  techStack: [],
};

// ---------------------------------------------------------------------------
// Regexes
// ---------------------------------------------------------------------------

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,}\d{3,4}/g;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  return s.startsWith('http://') || s.startsWith('https://')
    ? s
    : `https://${s}`;
}

function extractFromText(text: string): Pick<EnrichmentResult, 'emails' | 'phone'> {
  const emailMatches = (text.match(EMAIL_RE) || [])
    .map((e) => e.toLowerCase().trim())
    .filter(
      (e) =>
        !e.endsWith('.png') &&
        !e.endsWith('.jpg') &&
        !e.endsWith('.svg') &&
        !e.includes('example.com') &&
        !e.includes('sentry.io')
    );
  const emails = [...new Set(emailMatches)].slice(0, 5);

  const phoneMatches = text.match(PHONE_RE) || [];
  const phone =
    phoneMatches.find((p) => p.replace(/\D/g, '').length >= 10)?.trim() ?? '';

  return { emails, phone };
}

function extractSocialLinks(html: string): Record<string, string> {
  const socials: Record<string, string> = {};
  const patterns: [string, RegExp][] = [
    ['facebook', /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/i],
    ['instagram', /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/i],
    ['linkedin', /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/i],
    ['twitter', /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^\s"'<>]+/i],
    ['youtube', /https?:\/\/(?:www\.)?youtube\.com\/[^\s"'<>]+/i],
  ];
  for (const [name, re] of patterns) {
    const match = html.match(re);
    if (match) socials[name] = match[0];
  }
  return socials;
}

function extractTechHints(html: string): string[] {
  const hints: string[] = [];
  if (/wp-content|wordpress/i.test(html)) hints.push('WordPress');
  if (/shopify/i.test(html)) hints.push('Shopify');
  if (/"next":|_next\//i.test(html)) hints.push('Next.js');
  if (/react(?:dom)?\.production/i.test(html)) hints.push('React');
  if (/vue(?:\.min)?\.js/i.test(html)) hints.push('Vue.js');
  if (/wix\.com/i.test(html)) hints.push('Wix');
  if (/squarespace/i.test(html)) hints.push('Squarespace');
  if (/webflow/i.test(html)) hints.push('Webflow');
  return [...new Set(hints)];
}

function mergeResults(a: EnrichmentResult, b: Partial<EnrichmentResult>): EnrichmentResult {
  return {
    emails: [...new Set([...a.emails, ...(b.emails ?? [])])].slice(0, 5),
    phone: a.phone || b.phone || '',
    socialLinks: { ...a.socialLinks, ...(b.socialLinks ?? {}) },
    techStack: [...new Set([...a.techStack, ...(b.techStack ?? [])])],
  };
}

function isComplete(r: EnrichmentResult): boolean {
  return r.emails.length > 0 && r.phone.length > 0;
}

// ---------------------------------------------------------------------------
// robots.txt guard
// ---------------------------------------------------------------------------

async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const { default: got } = await import('got');
    const { RobotsTxtGuard } = await import('robots-txt-guard');
    const parsed = new URL(url);
    const robotsUrl = `${parsed.origin}/robots.txt`;
    const res = await got(robotsUrl, { timeout: { request: 4000 }, throwHttpErrors: false });
    if (res.statusCode !== 200) return true; // no robots.txt → allowed
    const guard = new RobotsTxtGuard(res.body);
    return guard.isAllowed('AlphaCloneBot', parsed.pathname || '/');
  } catch {
    return true; // on error, assume allowed
  }
}

// ---------------------------------------------------------------------------
// Pass 1: got + node-html-parser (ultra-fast)
// ---------------------------------------------------------------------------

async function passNodeHtmlParser(url: string): Promise<Partial<EnrichmentResult>> {
  try {
    const { default: got } = await import('got');
    const { parse: parseHtml } = await import('node-html-parser');

    const res = await got(url, {
      timeout: { request: 8000 },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      followRedirect: true,
      maxRedirects: 5,
      throwHttpErrors: false,
    });

    const html = res.body;
    const root = parseHtml(html);

    // Mailto links
    const mailtoEmails = root
      .querySelectorAll('a[href^="mailto:"]')
      .map((el) => el.getAttribute('href')?.replace('mailto:', '').split('?')[0].toLowerCase().trim() ?? '')
      .filter(Boolean);

    // Tel links
    const telPhone =
      root.querySelector('a[href^="tel:"]')?.getAttribute('href')?.replace('tel:', '').trim() ?? '';

    const fromText = extractFromText(root.textContent ?? '');

    return {
      emails: [...new Set([...mailtoEmails, ...fromText.emails])].slice(0, 5),
      phone: telPhone || fromText.phone,
      socialLinks: extractSocialLinks(html),
      techStack: extractTechHints(html),
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Pass 2: got + Cheerio (thorough static parse)
// ---------------------------------------------------------------------------

async function passCheerio(url: string): Promise<Partial<EnrichmentResult>> {
  try {
    const { default: got } = await import('got');
    const res = await got(url, {
      timeout: { request: 10000 },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      followRedirect: true,
      maxRedirects: 5,
      throwHttpErrors: false,
    });

    const html = res.body;
    const $ = cheerio.load(html);

    const mailtoEmails: string[] = [];
    $('a[href^="mailto:"]').each((_, el) => {
      const email = $(el).attr('href')?.replace('mailto:', '').split('?')[0].toLowerCase().trim();
      if (email) mailtoEmails.push(email);
    });

    const telPhone = $('a[href^="tel:"]').first().attr('href')?.replace('tel:', '').trim() ?? '';

    const fromText = extractFromText($.text());

    return {
      emails: [...new Set([...mailtoEmails, ...fromText.emails])].slice(0, 5),
      phone: telPhone || fromText.phone,
      socialLinks: extractSocialLinks(html),
      techStack: extractTechHints(html),
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Pass 3: JSDOM (handles SSR-hydrated HTML)
// ---------------------------------------------------------------------------

async function passJSDOM(url: string): Promise<Partial<EnrichmentResult>> {
  try {
    const { default: got } = await import('got');
    // Use dynamic string to bypass Turbopack static analysis
    const libName = 'jsdom';
    const { JSDOM } = await import(libName);
    
    const res = await got(url, {
      timeout: { request: 10000 },
      headers: { 'User-Agent': 'Mozilla/5.0 AlphaCloneBot/1.0' },
      followRedirect: true,
      maxRedirects: 5,
      throwHttpErrors: false,
    });

    const dom = new JSDOM(res.body, { url });
    const doc = dom.window.document;

    const mailtoLinks = [...doc.querySelectorAll<HTMLAnchorElement>('a[href^="mailto:"]')]
      .map((a) => a.href.replace('mailto:', '').split('?')[0].toLowerCase().trim())
      .filter(Boolean);

    const telLink = doc.querySelector<HTMLAnchorElement>('a[href^="tel:"]');
    const phone = telLink?.href.replace('tel:', '').trim() ?? '';

    const bodyText = doc.body?.textContent ?? '';
    const fromText = extractFromText(bodyText);

    return {
      emails: [...new Set([...mailtoLinks, ...fromText.emails])].slice(0, 5),
      phone: phone || fromText.phone,
      socialLinks: extractSocialLinks(res.body),
      techStack: extractTechHints(res.body),
    };
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Pass 4: Puppeteer via Browserbase
// ---------------------------------------------------------------------------

async function passPuppeteer(url: string): Promise<Partial<EnrichmentResult>> {
  if (!BrowserManager.hasRemoteConfigured()) return {};
  let closeSession: (() => Promise<void>) | null = null;
  try {
    const { page, close } = await BrowserManager.createPuppeteerPage();
    closeSession = close;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });
    await page.waitForTimeout(2000);
    const html = await page.content();
    const fromText = extractFromText(html);
    return {
      emails: fromText.emails,
      phone: fromText.phone,
      socialLinks: extractSocialLinks(html),
      techStack: extractTechHints(html),
    };
  } catch {
    return {};
  } finally {
    if (closeSession) await closeSession().catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Pass 5: Playwright via Browserbase
// ---------------------------------------------------------------------------

async function passPlaywright(url: string): Promise<Partial<EnrichmentResult>> {
  if (!BrowserManager.hasRemoteConfigured()) return {};
  let closeSession: (() => Promise<void>) | null = null;
  try {
    const { page, close } = await BrowserManager.createPage();
    closeSession = close;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 22000 });
    await page.waitForTimeout(2500);
    const html = await page.content();
    const fromText = extractFromText(html);
    return {
      emails: fromText.emails,
      phone: fromText.phone,
      socialLinks: extractSocialLinks(html),
      techStack: extractTechHints(html),
    };
  } catch {
    return {};
  } finally {
    if (closeSession) await closeSession().catch(() => null);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Enriches a business website URL through a 5-pass waterfall.
 * Only runs passes until the data is complete (email + phone found).
 * Checks robots.txt before any pass.
 * Never returns source metadata — internal engine only.
 */
export async function enrichLeadWebsite(rawUrl: string, budgetMs = 25000): Promise<EnrichmentResult> {
  const url = normalizeUrl(rawUrl);
  const start = Date.now();
  const remaining = () => budgetMs - (Date.now() - start);

  // robots.txt check
  const allowed = await isAllowedByRobots(url);
  if (!allowed) return { ...EMPTY };

  let result: EnrichmentResult = { ...EMPTY };

  // Pass 1 — fast
  if (remaining() > 3000) {
    result = mergeResults(result, await passNodeHtmlParser(url));
    if (isComplete(result)) return result;
  }

  // Pass 2 — Cheerio
  if (remaining() > 4000) {
    result = mergeResults(result, await passCheerio(url));
    if (isComplete(result)) return result;
  }

  // Pass 3 — JSDOM
  if (remaining() > 5000) {
    result = mergeResults(result, await passJSDOM(url));
    if (isComplete(result)) return result;
  }

  // Pass 4 — Puppeteer (only if remote browser configured)
  if (remaining() > 10000) {
    result = mergeResults(result, await passPuppeteer(url));
    if (isComplete(result)) return result;
  }

  // Pass 5 — Playwright (last resort)
  if (remaining() > 10000) {
    result = mergeResults(result, await passPlaywright(url));
  }

  return result;
}
