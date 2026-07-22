import { BrowserManager } from '@/lib/scraper/browserManager';

/** Render themed HTML to a print-ready PDF buffer (server-side). */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const { page, close } = await BrowserManager.createPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 30000 });
    await page.emulateMedia({ media: 'print' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await close().catch(() => undefined);
  }
}
