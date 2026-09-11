import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedUser } from '@/lib/apiAuth';
import { renderAllEmailGallerySamples } from '@/lib/email/emailGallery';
import { validateEmailLogoUrl, resolveEmailLogoUrl } from '@/lib/email/emailConfig';

export async function GET(req: NextRequest) {
  try {
    await requireAuthenticatedUser(req);
    const mode = req.nextUrl.searchParams.get('mode') || 'default';
    const samples = renderAllEmailGallerySamples({
      longContent: mode === 'long',
      blockImages: mode === 'no-images',
    });
    const logoValidation = await validateEmailLogoUrl();

    return NextResponse.json({
      logoUrl: resolveEmailLogoUrl(),
      logoValidation,
      mode,
      samples: samples.map((sample) => ({
        id: sample.id,
        label: sample.label,
        description: sample.description,
        html: sample.html,
        text: sample.text,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gallery unavailable';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
