import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { searchEmailContext } from '@/lib/scraper/emailLeadAutoSearch';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);

    const from = String(body.from || body.email || '').trim();
    if (!from) {
      return NextResponse.json({ error: 'from or email is required' }, { status: 400 });
    }

    const result = await searchEmailContext(tenantId, from, {
      subject: body.subject ? String(body.subject) : undefined,
      queueEnrichment: body.queueEnrichment !== false,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
