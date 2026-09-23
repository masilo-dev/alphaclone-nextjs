import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { researchService } from '@/lib/research/researchService';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId, request);
    const job = await researchService.getResearchJob(tenantId, id);
    if (!job) {
      return NextResponse.json({ error: 'Research job not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, job });
  } catch (error) {
    return routeErrorResponse(error, 'Research job could not be retrieved', request);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const tenantId = body.tenantId || request.nextUrl.searchParams.get('tenantId') || '';

    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId, request);
    const cancelled = await researchService.cancelResearchJob(tenantId, id);

    return NextResponse.json({ success: true, cancelled });
  } catch (error) {
    return routeErrorResponse(error, 'Research job could not be cancelled', request);
  }
}
