import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { linkLinkedInCompanyPageManually } from '@/services/linkedin/linkedinIntegrationService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const companyInput = String(body.companyInput || body.vanityName || body.companyUrl || '').trim();
    const linkedinMemberId =
      typeof body.linkedinMemberId === 'string' && body.linkedinMemberId.trim()
        ? body.linkedinMemberId.trim()
        : null;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    if (!companyInput) {
      return NextResponse.json({ error: 'companyInput is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const result = await linkLinkedInCompanyPageManually({
      tenantId,
      userId: user.id,
      linkedinMemberId,
      companyInput,
    });

    if (!result.companyPage) {
      return NextResponse.json(
        { success: false, error: result.error || 'Could not link that LinkedIn company page.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      companyPage: result.companyPage,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not link LinkedIn company page.', request);
  }
}
