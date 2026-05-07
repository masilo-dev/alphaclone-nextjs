import Browserbase from '@browserbasehq/sdk';
import { chromium, Browser, Page } from 'playwright-core';

/**
 * Universal Browser Manager for Lead Acquisition
 *
 * Serverless-safe: creates a fresh session per call (no singleton).
 *
 * Priority order:
 *  1. Browserbase managed session (BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID)
 *  2. Generic CDP endpoint (BROWSER_WS_ENDPOINT) — comma-separated for load balancing
 *  3. Local Chromium — development only (never runs on Vercel)
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

  const bb = new Browserbase({ apiKey });
  const session = await bb.sessions.create({
    projectId: projectId || undefined,
    timeout: 900, // 15 min max — Vercel functions cut off at ~800 s on Pro
  });

  const browser = await chromium.connectOverCDP(session.connectUrl, {
    timeout: 60_000,
  });

  console.log(`[BrowserManager] Browserbase session ${session.id}`);
  return { browser, sessionId: session.id };
}

async function launchViaCDP(endpoints: string[]): Promise<Browser> {
  const shuffled = [...endpoints].sort(() => Math.random() - 0.5);
  for (const url of shuffled) {
    try {
      const browser = await chromium.connectOverCDP(url, { timeout: 60_000 });
      console.log(`[BrowserManager] Connected to remote CDP: ${url}`);
      return browser;
    } catch (e: any) {
      console.warn(`[BrowserManager] CDP endpoint failed (${url}): ${e.message}`);
    }
  }
  throw new Error('All remote CDP endpoints failed');
}

async function launchLocal(): Promise<Browser> {
  if (process.env.VERCEL) {
    throw new Error(
      'Local browser fallback is disabled on Vercel. ' +
        'Set BROWSERBASE_API_KEY + BROWSERBASE_PROJECT_ID.'
    );
  }
  console.log('[BrowserManager] Using local Chromium (dev only)');
  return chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
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
}
