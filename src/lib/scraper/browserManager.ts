import { chromium, Browser, Page } from 'playwright-core';

/**
 * Universal Browser Manager for Lead Acquisition
 * 
 * Supports:
 * - Multi-provider load balancing (e.g., Browserless & BrowserCat)
 * - Automatic Failover (tries next provider if one fails or hits limits)
 * - Local Chromium fallback for development
 */

export class BrowserManager {
  private static browser: Browser | null = null;

  static async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
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
          
          console.log(`[BrowserManager] Orchestrating connection: ${providerName}`);
          
          this.browser = await chromium.connectOverCDP(url);
          console.log(`[BrowserManager] Active Engine: ${providerName}`);
          return this.browser;
        } catch (e: any) {
          console.warn(`[BrowserManager] Provider ${url} down or limited: ${e.message}. Trying next...`);
        }
      }
      console.warn('[BrowserManager] All remote providers exhausted/down.');
    }

    // 2. Local Fallback Strategy
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
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
