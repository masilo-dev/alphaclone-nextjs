import { BrowserManager } from '@/lib/scraper/browserManager';

/** Render themed HTML to a print-ready PDF buffer (server-side). */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const { page, close } = await BrowserManager.createPage();
  try {
    // Prefer load over networkidle — themed docs may reference remote fonts/images.
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,\n      margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await close().catch(() => undefined);
  }
}
