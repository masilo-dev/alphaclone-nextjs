import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { researchService } from '@/lib/research/researchService';
import type { ReviewStatus } from '@/lib/research/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const url = request.nextUrl;
    const tenantId = url.searchParams.get('tenantId') || '';

    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId, request);

    const isQualifiedParam = url.searchParams.get('isQualified');
    const reviewStatus = url.searchParams.get('reviewStatus') as ReviewStatus | undefined;
    const search = url.searchParams.get('search') || undefined;
    const limit = Number(url.searchParams.get('limit') || 100);
    const offset = Number(url.searchParams.get('offset') || 0);

    const { results, total } = await researchService.getResearchResults(tenantId, id, {
      isQualified: isQualifiedParam !== null ? isQualifiedParam === 'true' : undefined,
      reviewStatus,
      search,
      limit,
      offset,
    });

    return NextResponse.json({ success: true, results, total });
  } catch (error) {
    return routeErrorResponse(error, 'Research results could not be loaded', request);
  }
}
