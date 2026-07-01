import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { refreshLinkedInCompanyPages } from '@/services/linkedin/linkedinIntegrationService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    const linkedinMemberId =
      typeof body.linkedinMemberId === 'string' && body.linkedinMemberId.trim()
        ? body.linkedinMemberId.trim()
        : null;

    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    const { user } = await requireTenantAccess(tenantId);
    const result = await refreshLinkedInCompanyPages({
      tenantId,
      userId: user.id,
      linkedinMemberId,
    });

    if (result.error && result.companyPages.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          companyPages: [],
          companyPagesCount: 0,
          scopes: result.scopes,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      companyPages: result.companyPages,
      companyPagesCount: result.companyPages.length,
      scopes: result.scopes,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Could not refresh LinkedIn company pages.', request);
  }
}
