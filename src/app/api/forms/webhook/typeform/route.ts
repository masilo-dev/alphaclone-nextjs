import { NextRequest, NextResponse } from 'next/server';
import { intakeExternalFormSubmission } from '@/lib/forms/externalWebhookIntake';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenantSlug = req.nextUrl.searchParams.get('tenantSlug') || '';
    const formSlug = req.nextUrl.searchParams.get('formSlug') || 'contact';
    const payload = await req.json();
    const secretHeader = req.headers.get('x-webhook-secret');

    const result = await intakeExternalFormSubmission({
      provider: 'typeform',
      tenantSlug,
      formSlug,
      payload,
      secretHeader,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, submissionId: result.submissionId });
  } catch (err: unknown) {
    console.error('[forms/webhook/typeform]', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Webhook failed' }, { status: 500 });
  }
}
