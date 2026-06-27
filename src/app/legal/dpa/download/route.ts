import { NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';

const lines = [
  'Alphaclone Systems, LLC',
  'Data Processing Agreement (DPA)',
  'Effective date: June 10, 2026',
  '',
  '1. Parties',
  'Alphaclone Systems, LLC acts as Processor. The customer acts as Controller.',
  '',
  '2. Subject matter',
  'Processing of personal data through the AlphaClone SaaS platform.',
  '',
  '3. Types of data',
  'Names, email addresses, company information, usage data, and customer-uploaded data.',
  '',
  '4. Processor obligations',
  'Documented instructions, confidentiality, security measures, sub-processor controls, assistance with rights requests, and deletion or return on termination.',
  '',
  '5. Sub-processors',
  'Supabase, Vercel, Anthropic, Stripe, Brevo, Twilio, and Cloudflare.',
  '',
  '6. Transfers',
  'Data may be transferred to the United States subject to Standard Contractual Clauses where required.',
  '',
  '7. Security',
  'Encryption at rest and in transit, access controls, logging, and regular security reviews.',
  '',
  '8. Rights and breaches',
  'Right request assistance within 72 hours and breach notice within 72 hours of awareness.',
  '',
  '9. Governing law',
  'Wyoming, USA.',
  '',
  '10. Signatures',
  'Processor: Alphaclone Systems, LLC, signed by Bornface Masilo.',
];

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/);
  const result: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars) {
      if (current) result.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) result.push(current);
  return result;
}

export async function GET() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  const margin = 48;
  const lineHeight = 16;
  let y = 744;

  const drawLine = (text: string, isBold = false, size = 11) => {
    const fontRef = isBold ? bold : font;
    const wrapped = wrapText(text, isBold ? 70 : 86);
    for (const part of wrapped) {
      if (y < margin) {
        page = pdf.addPage([612, 792]);
        y = 744;
      }
      page.drawText(part, {
        x: margin,
        y,
        size,
        font: fontRef,
        color: rgb(0.11, 0.15, 0.21),
      });
      y -= lineHeight;
    }
  };

  drawLine('Alphaclone Systems, LLC', true, 18);
  y -= 10;
  drawLine('Data Processing Agreement (DPA)', true, 14);
  drawLine('Effective date: June 9, 2025');
  y -= 8;

  for (const line of lines.slice(3)) {
    if (!line) {
      y -= 4;
      continue;
    }
    const isHeading = /^\d+\./.test(line);
    drawLine(line, isHeading, isHeading ? 12 : 11);
  }

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="alphaclone-dpa.pdf"',
    },
  });
}
