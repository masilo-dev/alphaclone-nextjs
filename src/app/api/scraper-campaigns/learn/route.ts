import { NextRequest, NextResponse } from 'next/server';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  buildIntentFromProfile,
  getLeadFinderProfile,
  recordLeadFinderFeedback,
  recordLeadFinderSearch,
} from '@/lib/scraper/leadFinderLearning';

export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId');
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);
    const profile = await getLeadFinderProfile(tenantId);
    const intent = buildIntentFromProfile(profile);
    return NextResponse.json({ profile, intent });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to load Lead Finder profile');
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, action } = body as {
      tenantId: string;
      action: 'record_search' | 'feedback';
      niche?: string;
      location?: string;
      leadCount?: number;
      campaignId?: string;
      intent?: Record<string, unknown>;
      feedbackAction?: 'save' | 'qualify' | 'contact' | 'reject';
      count?: number;
      grades?: string[];
    };

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenantId' }, { status: 400 });
    }
    await requireTenantAccess(tenantId);

    if (action === 'record_search') {
      await recordLeadFinderSearch(tenantId, {
        niche: body.niche || '',
        location: body.location || '',
        leadCount: body.leadCount ?? 0,
        campaignId: body.campaignId,
        intent: body.intent as import('@/lib/scraper/parseLeadIntent').ParsedLeadIntent | undefined,
      });
      return NextResponse.json({ success: true });
    }

    if (action === 'feedback') {
      await recordLeadFinderFeedback(tenantId, {
        action: body.feedbackAction || 'save',
        count: body.count ?? 0,
        grades: body.grades,
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return routeErrorResponse(error, 'Lead Finder learn failed');
  }
}
