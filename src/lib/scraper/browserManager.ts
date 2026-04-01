import { chromium, Browser, Page } from 'playwright-core';

/**
 * Universal Browser Manager for Lead Acquisition
 * 
 * Supports:
 * - Local Chromium (for local dev and power scraping)
 * - Remote CDP Connection (for Vercel/Production safety)
 */

export class BrowserManager {
  private static browser: Browser | null = null;

  static async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    const remoteUrl = process.env.BROWSER_WS_ENDPOINT; // e.g., wss://chrome.browserless.io?token=...
    
    if (remoteUrl) {
      console.log('Connecting to remote browser engine (Vercel Safe Mode)...');
      this.browser = await chromium.connectOverCDP(remoteUrl);
    } else {
      // Local fallback - Requires playwright to be installed locally
      console.log('Launching local browser engine (Power Mode)...');
      try {
        // We use playwright-core but need a valid executable path or a global install
        // On local Windows, this usually works if playwright is installed.
        this.browser = await chromium.launch({ 
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
      } catch (e: any) {
        console.error('Failed to launch local browser. Ensure playwright is installed or BROWSER_WS_ENDPOINT is set.', e.message);
        throw e;
      }
    }

    return this.browser;
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
