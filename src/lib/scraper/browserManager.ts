import Browserbase from '@browserbasehq/sdk';
import { chromium, Browser, Page } from 'playwright-core';

/**
 * Universal Browser Manager for Lead Acquisition
 *
 * Supports:
 * - Multi-provider load balancing (e.g., Browserless & BrowserCat)
 * - Browserbase managed sessions (BROWSERBASE_API_KEY)
 * - Automatic Failover (tries next provider if one fails or hits limits)
 * - Local Chromium fallback for development
 */

export class BrowserManager {
  private static browser: Browser | null = null;
  private static browserbaseSessionId: string | null = null;

  static async getBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      return this.browser;
    }
    if (this.browser) {
      await this.browser.close().catch(() => null);
      this.browser = null;
      this.browserbaseSessionId = null;
    }

    const endpointString = process.env.BROWSER_WS_ENDPOINT || '';
    const endpoints = endpointString.split(',').map(u => u.trim()).filter(Boolean);
    
    // 1. Remote Multi-Provider Strategy (shuffled for load balancing)
    if (endpoints.length > 0) {
      const shuffledEndpoints = endpoints.sort(() => Math.random() - 0.5);
      console.log(`[BrowserManager] Initializing connection to ${shuffledEndpoints.length} providers...`);
      
      for (const url of shuffledEndpoints) {
        try {
          const providerName = url.includes('browserless') ? 'Browserless' : 
                               url.includes('browsercat') ? 'BrowserCat' : 'Remote Hub';
          
          console.log(`[BrowserManager] Orchestrating connection: ${providerName}...`);
          
          // Using 60s timeout for remote cluster establishment
          this.browser = await chromium.connectOverCDP(url, { timeout: 60000 });
          console.log(`[BrowserManager] Active Engine: ${providerName}`);
          return this.browser;
        } catch (e: any) {
          console.warn(`[BrowserManager] Provider ${url} connection failed: ${e.message}. Trying next...`);
        }
      }
      console.warn('[BrowserManager] All remote providers exhausted/down.');
    }

    // 1b. Browserbase (managed CDP session)
    const browserbaseKey = process.env.BROWSERBASE_API_KEY?.trim();
    if (browserbaseKey) {
      try {
        const bb = new Browserbase({ apiKey: browserbaseKey });
        const projectId = process.env.BROWSERBASE_PROJECT_ID?.trim();
        const session = await bb.sessions.create({
          projectId: projectId || undefined,
          timeout: 900,
        });
        this.browserbaseSessionId = session.id;
        this.browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 60000 });
        console.log(`[BrowserManager] Browserbase session ${session.id}`);
        return this.browser;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[BrowserManager] Browserbase connection failed: ${msg}`);
        this.browserbaseSessionId = null;
        this.browser = null;
      }
    }

    // 2. Local Fallback Strategy (Dev only)
    const isDev = process.env.NODE_ENV === 'development' || !process.env.VERCEL;
    
    if (!isDev) {
      const msg =
        'Fatal: Local browser fallback is disabled in production. Set BROWSERBASE_API_KEY, BROWSER_WS_ENDPOINT, or another remote CDP endpoint.';
      console.error(`[BrowserManager] ${msg}`);
      throw new Error(msg);
    }

    console.log('[BrowserManager] Reverting to Local Browser Cluster...');
    try {
      this.browser = await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
      });
      return this.browser;
    } catch (e: any) {
      const msg = 'Fatal: No browser engine cluster available (Remote or Local)';
      console.error(`[BrowserManager] ${msg}:`, e.message);
      throw new Error(msg);
    }

  }

  static async createPage(): Promise<{ page: Page, browser: Browser }> {
    const browser = await this.getBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    return { page, browser };
  }

  static async close() {
    const sessionId = this.browserbaseSessionId;
    this.browserbaseSessionId = null;
    if (sessionId && process.env.BROWSERBASE_API_KEY?.trim()) {
      try {
        const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY.trim() });
        await bb.sessions.update(sessionId, { status: 'REQUEST_RELEASE' });
      } catch {
        /* session may already be completed */
      }
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } finally {
        this.browser = null;
      }
    }
  }
}
