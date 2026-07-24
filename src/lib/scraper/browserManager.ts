import Browserbase from '@browserbasehq/sdk';
import { isRailwayHost } from '@/config/railwayWorkload';
import { chromium, Browser, Page } from 'playwright-core';
import puppeteer, { Browser as PuppeteerBrowser, Page as PuppeteerPage } from 'puppeteer-core';

/**
 * Universal Browser Manager for Lead Acquisition
 *
 * Serverless-safe: creates a fresh session per call (no singleton).
 *
 * Priority order:
 *  1. Browserbase managed session (BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID)
 *  2. Generic CDP endpoint (BROWSER_WS_ENDPOINT) — comma-separated for load balancing
 *  3. Local Chromium — Railway or local development when remote browsers are unavailable
 */

export interface BrowserSession {
  page: Page;
  /** Call this when you are done — closes context and releases the Browserbase session */
  close: () => Promise<void>;
}

async function launchViaBrowserbase(): Promise<{ browser: Browser; sessionId: string }> {
  const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
  const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();

  if (!apiKey) throw new Error('BROWSERBASE_API_KEY not set');

  try {
    const bb = new Browserbase({ apiKey });
    const session = await bb.sessions.create({
      projectId: projectId || undefined,
      timeout: 900, // 15 min max
    });

    const browser = await chromium.connectOverCDP(session.connectUrl, {
      timeout: 20_000, // Faster timeout for connection
    });

    console.log(`[BrowserManager] Browserbase session ${session.id}`);
    return { browser, sessionId: session.id };
  } catch (e: any) {
    if (e.status === 402 || (e.message && e.message.includes('402'))) {
      console.error('[BrowserManager] Browserbase ERROR: 402 Payment Required. Check subscription.');
    }
    throw e;
  }
}

async function launchViaCDP(endpoints: string[]): Promise<Browser> {
  const shuffled = [...endpoints].sort(() => Math.random() - 0.5);
  for (const url of shuffled) {
    try {
      const browser = await chromium.connectOverCDP(url, { timeout: 20_000 });
      console.log(`[BrowserManager] Connected to remote CDP: ${url}`);
      return browser;
    } catch (e: any) {
      if (e.message?.includes('503') || e.message?.includes('Service Unavailable')) {
        console.error(`[BrowserManager] CDP ERROR 503 (Service Unavailable) for ${url}`);
      } else {
        console.warn(`[BrowserManager] CDP endpoint failed (${url}): ${e.message}`);
      }
    }
  }
  throw new Error('All remote CDP endpoints failed');
}

function resolveLocalChromeExecutable(): string | undefined {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH?.trim() || process.env.PUPPETEER_EXECUTABLE_PATH?.trim();
  if (fromEnv) return fromEnv;

  const candidates = [
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require('fs') as typeof import('fs');
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

async function launchLocal(): Promise<Browser> {
  if (!isRailwayHost() && process.env.NODE_ENV === 'production') {
    throw new Error(
      'Local browser fallback requires Railway or development. ' +
        'Set BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID.'
    );
  }
  const executablePath = resolveLocalChromeExecutable();
  console.log(
    `[BrowserManager] Using local Chromium${executablePath ? ` (${executablePath})` : ' (Playwright bundled)'}`
  );
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class BrowserManager {
  /**
   * Creates a **per-request** browser session and returns a page + a close()
   * function that properly releases all resources including the Browserbase
   * session.
   *
   * Usage:
   *   const { page, close } = await BrowserManager.createPage();
   *   try { ... } finally { await close(); }
   */
  static async createPage(): Promise<BrowserSession> {
    const wsEndpointString = process.env.BROWSER_WS_ENDPOINT || '';
    const cdpEndpoints = wsEndpointString
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean);

    let browser: Browser;
    let sessionId: string | null = null;
    let apiKey: string | null = null;

    // 1. Browserbase (primary for Vercel)
    if (process.env.BROWSERBASE_API_KEY?.trim()) {
      try {
        const result = await launchViaBrowserbase();
        browser = result.browser;
        sessionId = result.sessionId;
        apiKey = process.env.BROWSERBASE_API_KEY.trim();
      } catch (e: any) {
        console.warn(`[BrowserManager] Browserbase failed, trying CDP: ${e.message}`);
        if (cdpEndpoints.length === 0) {
          // No CDP either — fall through to local
          browser = await launchLocal();
        } else {
          browser = await launchViaCDP(cdpEndpoints);
        }
      }
    } else if (cdpEndpoints.length > 0) {
      // 2. Generic CDP (Browserless, BrowserCat, etc.)
      browser = await launchViaCDP(cdpEndpoints);
    } else {
      // 3. Local dev fallback
      browser = await launchLocal();
    }

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    const close = async (): Promise<void> => {
      // 1. Close the context first (closes all pages)
      await context.close().catch(() => null);

      // 2. Release the Browserbase session so it doesn't count against your quota
      if (sessionId && apiKey) {
        try {
          const bb = new Browserbase({ apiKey });
          await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' });
          console.log(`[BrowserManager] Released Browserbase session ${sessionId}`);
        } catch {
          /* session may already be auto-completed */
        }
      }

      // 3. Close the browser connection
      await browser.close().catch(() => null);
    };

    return { page, close };
  }

  /**
   * @deprecated Use createPage() — the returned close() handles everything.
   * Kept for backward compat; calling it is a no-op.
   */
  static async close(): Promise<void> {
    // No-op: sessions are now per-request. close() is returned from createPage().
  }

  /**
   * Whether a remote browser is configured (Browserbase or CDP endpoint).
   * Used by freeLeadSearch to decide whether to attempt the browser step.
   */
  static hasRemoteConfigured(): boolean {
    return Boolean(
      process.env.BROWSERBASE_API_KEY?.trim() ||
        process.env.BROWSER_WS_ENDPOINT?.trim()
    );
  }

  /**
   * True when we can launch a browser on this host:
   * remote Browserbase/CDP, Railway local Chromium, or local development.
   */
  static canLaunchBrowser(): boolean {
    if (BrowserManager.hasRemoteConfigured()) return true;
    if (isRailwayHost()) return true;
    if (process.env.NODE_ENV !== 'production') return true;
    if (process.env.CHROME_EXECUTABLE_PATH?.trim() || process.env.PUPPETEER_EXECUTABLE_PATH?.trim()) {
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Puppeteer variant — second engine, different fingerprint vs Playwright
  // ---------------------------------------------------------------------------

  /**
   * Same as createPage() but uses puppeteer-core instead of playwright-core.
   * Connects to Browserbase via CDP. Returns { page, close }.
   */
  static async createPuppeteerPage(): Promise<{ page: PuppeteerPage; close: () => Promise<void> }> {
    const apiKey = process.env.BROWSERBASE_API_KEY?.trim();
    const wsEndpoint = process.env.BROWSER_WS_ENDPOINT?.split(',')[0]?.trim();

    let pBrowser: PuppeteerBrowser;
    let sessionId: string | null = null;
    let bbApiKey: string | null = null;

    if (apiKey) {
      const bb = new Browserbase({ apiKey });
      const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
      const session = await bb.sessions.create({
        projectId: projectId || undefined,
        timeout: 900,
      });
      sessionId = session.id;
      bbApiKey = apiKey;
      pBrowser = await puppeteer.connect({ browserWSEndpoint: session.connectUrl });
      console.log(`[BrowserManager:Puppeteer] Browserbase session ${session.id}`);
    } else if (wsEndpoint) {
      pBrowser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    } else {
      // Dev fallback
      if (!isRailwayHost() && process.env.NODE_ENV === 'production') {
        throw new Error('No remote browser configured for production. Set BROWSERBASE_API_KEY.');
      }
      const executablePath = resolveLocalChromeExecutable();
      pBrowser = await puppeteer.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {}),
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
    }

    const page = await pBrowser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 800 });

    const close = async (): Promise<void> => {
      await page.close().catch(() => null);
      if (sessionId && bbApiKey) {
        try {
          const bb = new Browserbase({ apiKey: bbApiKey });
          await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' });
        } catch { /* already completed */ }
      }
      await pBrowser.close().catch(() => null);
    };

    return { page, close };
  }
}
