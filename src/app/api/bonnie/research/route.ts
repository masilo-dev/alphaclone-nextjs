import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  buildBonnieResearchBriefing,
  formatResearchBriefingForBonnie,
} from '@/lib/bonnie/research/researchEvaluator';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, req);

    const briefing = buildBonnieResearchBriefing();
    return NextResponse.json({
      success: true,
      briefing,
      bonnieDigest: formatResearchBriefingForBonnie(briefing),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Bonnie research briefing failed', req);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body.tenantId || '').trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }
    const { user } = await requireTenantAccess(tenantId, req);

    const briefing = buildBonnieResearchBriefing();
    return NextResponse.json({
      success: true,
      refreshedBy: user.id,
      briefing,
      bonnieDigest: formatResearchBriefingForBonnie(briefing),
      message: 'Research catalog re-scored. Bonnie can use this briefing for architecture decisions.',
    });
  } catch (error) {
    return routeErrorResponse(error, 'Bonnie research refresh failed', req);
  }
}
