import PptxGenJS from 'pptxgenjs';

export type PresentationSlide = { title: string; body?: string; bullets?: string[] };

/** Generate a clean, editable client deck. Content is provided by a reviewed AI draft. */
export async function generateBrandedPresentation(input: { title: string; subtitle?: string; tenantName: string; slides: PresentationSlide[] }) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'AlphaClone Systems';
  pptx.subject = input.title;
  pptx.title = input.title;
  pptx.company = input.tenantName;
  pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'en-US' };
  const background = '071421'; const teal = '14B8A6'; const white = 'F8FAFC'; const muted = '94A3B8';
  const cover = pptx.addSlide(); cover.background = { color: background };
  cover.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: 7.5, fill: { color: teal }, line: { color: teal } });
  cover.addText(input.tenantName, { x: 0.8, y: 0.75, w: 10, h: 0.3, fontFace: 'Aptos', fontSize: 12, color: teal, bold: true, charSpacing: 1.5 });
  cover.addText(input.title, { x: 0.8, y: 2.2, w: 10.8, h: 1.2, fontFace: 'Aptos Display', fontSize: 36, color: white, bold: true, breakLine: false });
  if (input.subtitle) cover.addText(input.subtitle, { x: 0.8, y: 3.65, w: 9.5, h: 0.5, fontSize: 16, color: muted });
  cover.addText('Prepared with AlphaClone', { x: 0.8, y: 6.55, w: 4, h: 0.25, fontSize: 9, color: muted });
  for (const item of input.slides.slice(0, 30)) {
    const slide = pptx.addSlide(); slide.background = { color: background };
    slide.addText(input.tenantName, { x: 0.65, y: 0.42, w: 5, h: 0.25, fontSize: 9, color: teal, bold: true, charSpacing: 1 });
    slide.addText(item.title, { x: 0.65, y: 1.0, w: 11.4, h: 0.65, fontSize: 27, color: white, bold: true });
    const lines = item.bullets?.length ? item.bullets.map((text) => ({ text, options: { bullet: { indent: 14 }, hanging: 4 } })) : [{ text: item.body || '', options: {} }];
    slide.addText(lines as any, { x: 0.85, y: 2.0, w: 10.7, h: 3.8, fontSize: 16, color: 'D9E3EE', breakLine: false, paraSpaceAfterPt: 14, valign: 'mid' });
    slide.addText('AlphaClone Systems', { x: 0.65, y: 6.85, w: 3, h: 0.2, fontSize: 8, color: muted });
  }
  return pptx.write({ outputType: 'nodebuffer' }) as Promise<Buffer>;
}
