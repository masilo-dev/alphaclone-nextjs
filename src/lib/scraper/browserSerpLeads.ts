import { isRailwayHost } from '@/config/railwayWorkload';

export interface BrowserSerpLeadRow {
  business_name: string;
  website: string;
  snippet: string;
  source_id: string;
  source_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  category?: string;
  source: 'browser';
  lat?: number;
  lng?: number;
}

const PHONE_PATTERNS: RegExp[] = [
  /\+?\d{1,3}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/,
  /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
];

function firstPhoneFromText(text: string): string {
  const t = text.replace(/\u00a0/g, ' ');
  for (const re of PHONE_PATTERNS) {
    const m = t.match(re);
    if (m) {
      const digits = m[0].replace(/\D/g, '');
      if (digits.length >= 10) return m[0].trim();
    }
  }
  return '';
}

function firstEmailFromText(text: string): string {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase().trim() : '';
}

export function hasRemoteBrowserConfigured(): boolean {
  return Boolean(
    process.env.BROWSERBASE_API_KEY?.trim() ||
      process.env.BROWSER_WS_ENDPOINT?.trim()
  );
}

/** Remote Browserbase/CDP or Railway/local Chromium. */
export function canUseBrowserScraper(): boolean {
  if (hasRemoteBrowserConfigured()) return true;
  if (isRailwayHost()) return true;
  if (process.env.NODE_ENV !== 'production') return true;
  if (process.env.CHROME_EXECUTABLE_PATH?.trim() || process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
    return true;
  }
  return false;
}

/**
 * Supplemental lead discovery using a headless browser (Browserbase or CDP).
 * Parses organic web results for visible phone numbers or emails.
 */
export async function fetchSerpLeadsViaBrowser(
  niche: string,
  location: string,
  limit: number,
  options?: { searchQuery?: string }
): Promise<BrowserSerpLeadRow[]> {
  const { BrowserManager } = await import('@/lib/scraper/browserManager');
  const { page, close } = await BrowserManager.createPage();

  try {
    const q = options?.searchQuery?.trim() || `${niche} ${location}`.trim() || niche;
    const queries = [
      options?.searchQuery?.trim(),
      `${q} business contact`,
      `${q} phone email`,
      `${q} official website`,
    ]
      .filter(Boolean)
      .map((value) => String(value).trim())
      .filter(Boolean);

    const out: BrowserSerpLeadRow[] = [];
    const seen = new Set<string>();

    for (const query of queries) {
      if (out.length >= limit) break;

      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 22000 });
      await page.waitForSelector('.b_algo, #b_results', { timeout: 12000 }).catch(() => null);
      await new Promise((r) => setTimeout(r, 1200));

      const raw = await page.$$eval('.b_algo', (nodes) =>
        nodes.slice(0, 20).map((n) => {
          const block = n as HTMLElement;
          const titleEl = block.querySelector('h2') as HTMLElement | null;
          const title = titleEl?.innerText?.trim() || '';
          const link = titleEl?.querySelector('a')?.getAttribute('href') || '';
          const citeEl = block.querySelector('cite') as HTMLElement | null;
          const cite = citeEl?.innerText?.trim() || '';
          const capEl = block.querySelector('.b_caption, .b_snippet') as HTMLElement | null;
          const caption = capEl?.innerText?.trim() || '';
          const body = block.innerText || '';
          return { title, link, cite, caption, body };
        })
      );

      for (const row of raw) {
        if (out.length >= limit) break;
        const name = row.title.replace(/\s+[-|].*$/, '').trim();
        if (!name || name.length < 2) continue;

        const textBlob = `${row.caption}\n${row.body}`;
        const phone = firstPhoneFromText(textBlob);
        const email = firstEmailFromText(textBlob);

        let website = '';
        if (row.link.startsWith('http')) {
          try {
            website = new URL(row.link).origin;
          } catch {
            website = row.link;
          }
        } else if (row.cite) {
          const host = row.cite.replace(/^https?:\/\//i, '').split('/')[0];
          if (host && host.includes('.')) website = `https://${host}`;
        }

        const key = `${name.toLowerCase()}::${website.toLowerCase()}`;
        if (seen.has(key)) continue;
        if (!phone && !email && !website) continue;
        seen.add(key);

        out.push({
          business_name: name,
          website: website || row.cite || '',
          snippet: row.caption || row.body.slice(0, 200),
          source_id: `browser:${encodeURIComponent((website || row.cite || name).toLowerCase())}`,
          source_url: website || row.link || row.cite || '',
          phone,
          email,
          source: 'browser',
        });
      }
    }

    return out;
  } finally {
    await close().catch(() => null);
  }
}
