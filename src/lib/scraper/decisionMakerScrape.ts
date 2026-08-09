/**
 * Free decision-maker extraction from business websites.
 * Scrapes contact / about / team pages for owner, founder, director names + emails.
 * Works with static HTML first; Playwright on Railway when needed.
 */

import { BrowserManager } from '@/lib/scraper/browserManager';
import { enrichLeadWebsite, type EnrichmentResult } from '@/lib/scraper/enrichmentPipeline';
export { hasReachableContact as hasPhoneOrEmail } from '@/lib/scraper/contactGate';

export type DecisionMaker = {
  name: string;
  title: string;
  email?: string;
  confidence: number;
};

export type EnrichedBusinessLead = {
  email?: string;
  phone?: string;
  emails: string[];
  socialLinks: Record<string, string>;
  techStack: string[];
  decisionMakers: DecisionMaker[];
  primaryDecisionMaker?: DecisionMaker;
  enrichedFrom?: string;
};

const TITLE_RE =
  /\b(owner|founder|co-?founder|ceo|president|director|managing director|principal|partner|general manager|office manager|proprietor)\b/i;

const NAME_TITLE_PATTERNS: RegExp[] = [
  /([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})\s*[,–—|-]\s*((?:Owner|Founder|Co-Founder|CEO|President|Director|Managing Director|Principal|Partner|General Manager|Office Manager)[^\n,<]{0,40})/g,
  /((?:Owner|Founder|Co-Founder|CEO|President|Director|Managing Director|Principal|Partner|General Manager|Office Manager)[^\n:<]{0,40})\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3})/g,
];

function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  return s.startsWith('http://') || s.startsWith('https://') ? s : `https://${s}`;
}

function guessContactPaths(origin: string): string[] {
  const paths = [
    '/',
    '/contact',
    '/contact-us',
    '/contactus',
    '/about',
    '/about-us',
    '/aboutus',
    '/team',
    '/our-team',
    '/leadership',
    '/people',
    '/staff',
  ];
  return paths.map((p) => `${origin.replace(/\/$/, '')}${p}`);
}

function extractDecisionMakers(text: string, emails: string[]): DecisionMaker[] {
  const found: DecisionMaker[] = [];
  const seen = new Set<string>();

  for (const re of NAME_TITLE_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const a = m[1].trim();
      const b = m[2].trim();
      const titleFirst = TITLE_RE.test(a);
      const name = titleFirst ? b : a;
      const title = titleFirst ? a : b;
      if (name.split(/\s+/).length < 2) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const local = name
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter(Boolean);
      const email =
        emails.find((e) => {
          const [user] = e.split('@');
          return local.some((part) => part.length > 2 && user.includes(part));
        }) || emails.find((e) => /^(owner|info|hello|contact|admin)/i.test(e.split('@')[0] || ''));

      found.push({
        name,
        title: title.replace(/\s+/g, ' ').slice(0, 80),
        email,
        confidence: email ? 82 : 62,
      });
      if (found.length >= 5) break;
    }
    if (found.length >= 5) break;
  }

  // Mailto name attributes / nearby text often weak — attach role emails as generic DM
  if (!found.length && emails.length) {
    const role = emails.find((e) => /^(owner|founder|ceo|hello|info|contact)/i.test(e.split('@')[0] || ''));
    if (role) {
      found.push({
        name: role.split('@')[0].replace(/[._]/g, ' '),
        title: /owner|founder|ceo/i.test(role) ? 'Decision maker' : 'Primary contact',
        email: role,
        confidence: 55,
      });
    }
  }

  return found.sort((a, b) => b.confidence - a.confidence);
}

async function fetchHtmlStatic(url: string): Promise<string> {
  try {
    const { default: got } = await import('got');
    const res = await got(url, {
      timeout: { request: 8000 },
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      followRedirect: true,
      maxRedirects: 4,
      throwHttpErrors: false,
    });
    if (res.statusCode >= 400) return '';
    return res.body || '';
  } catch {
    return '';
  }
}

async function fetchHtmlPlaywright(urls: string[]): Promise<string> {
  if (!BrowserManager.canLaunchBrowser()) return '';
  let closeSession: (() => Promise<void>) | null = null;
  try {
    const { page, close } = await BrowserManager.createPage();
    closeSession = close;
    let combined = '';
    for (const url of urls.slice(0, 3)) {
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await new Promise((r) => setTimeout(r, 900));
        combined += `\n${await page.content()}`;
      } catch {
        /* try next */
      }
    }
    return combined;
  } catch {
    return '';
  } finally {
    if (closeSession) await closeSession().catch(() => null);
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Enrich a business website: contact waterfall + decision-maker scrape.
 */
export async function enrichBusinessWithDecisionMakers(
  website: string,
  budgetMs = 28000
): Promise<EnrichedBusinessLead> {
  const empty: EnrichedBusinessLead = {
    emails: [],
    socialLinks: {},
    techStack: [],
    decisionMakers: [],
  };
  const url = normalizeUrl(website);
  if (!url) return empty;

  const start = Date.now();
  let base: EnrichmentResult;
  try {
    base = await enrichLeadWebsite(url, Math.min(budgetMs, 18000));
  } catch {
    base = { emails: [], phone: '', socialLinks: {}, techStack: [] };
  }

  let emails = [...base.emails];
  let phone = base.phone || '';
  let htmlBlob = '';

  try {
    const origin = new URL(url).origin;
    const pages = guessContactPaths(origin);
    for (const pageUrl of pages.slice(0, 6)) {
      if (Date.now() - start > budgetMs - 8000) break;
      const html = await fetchHtmlStatic(pageUrl);
      if (!html) continue;
      htmlBlob += `\n${html}`;
      const mailto = [...html.matchAll(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi)].map(
        (m) => m[1].toLowerCase()
      );
      emails = [...new Set([...emails, ...mailto])].slice(0, 8);
      const tel = html.match(/tel:([+\d\s().-]{8,})/i)?.[1]?.trim();
      if (!phone && tel) phone = tel;
    }
  } catch {
    /* ignore */
  }

  if ((!emails.length || !phone) && BrowserManager.canLaunchBrowser() && Date.now() - start < budgetMs - 10000) {
    try {
      const origin = new URL(url).origin;
      const pwHtml = await fetchHtmlPlaywright([
        url,
        `${origin}/contact`,
        `${origin}/about`,
        `${origin}/team`,
      ]);
      htmlBlob += `\n${pwHtml}`;
    } catch {
      /* ignore */
    }
  }

  const text = htmlToText(htmlBlob || '');
  const fromTextEmails = (text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [])
    .map((e) => e.toLowerCase())
    .filter((e) => !/\.(png|jpg|svg|gif)$/i.test(e) && !e.includes('example.com') && !e.includes('sentry.io'));
  emails = [...new Set([...emails, ...fromTextEmails])].slice(0, 8);

  if (!phone) {
    const phoneMatch = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,}\d{3,4}/);
    if (phoneMatch && phoneMatch[0].replace(/\D/g, '').length >= 10) phone = phoneMatch[0].trim();
  }

  const decisionMakers = extractDecisionMakers(text, emails);
  const primary = decisionMakers[0];
  const bestEmail = primary?.email || emails[0];

  return {
    email: bestEmail,
    phone: phone || undefined,
    emails,
    socialLinks: base.socialLinks,
    techStack: base.techStack,
    decisionMakers,
    primaryDecisionMaker: primary,
    enrichedFrom: url,
  };
}
