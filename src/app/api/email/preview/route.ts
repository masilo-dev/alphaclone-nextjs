import { NextRequest, NextResponse } from 'next/server';
import { previewEmailGateway, type EmailGatewayCategory } from '@/lib/email/emailGateway';
import { requireAuthenticatedUser } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser(req);
    const body = await req.json();
    const tenantId = String(body.tenantId || auth.user?.app_metadata?.tenant_id || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const preview = await previewEmailGateway({
      tenantId,
      userId: auth.user.id,
      subject: String(body.subject || 'Preview email'),
      message: String(body.message || body.text || 'This is a preview of your branded email.'),
      category: (body.category as EmailGatewayCategory) || 'transactional',
      headline: body.headline ? String(body.headline) : undefined,
      greeting: body.greeting ? String(body.greeting) : undefined,
      cta:
        body.ctaLabel && body.ctaUrl
          ? { label: String(body.ctaLabel), url: String(body.ctaUrl) }
          : undefined,
      initiationSource: 'email.preview',
    });

    return NextResponse.json(preview);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Preview failed' }, { status: 500 });
  }
}
