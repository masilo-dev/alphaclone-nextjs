import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { listICPs, createICP, updateICP, deleteICP } from '@/lib/outbound/icpService';

const icpSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  description: z.string().optional(),
  is_default: z.boolean().default(false),
  industries: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  company_size_min: z.number().int().nonnegative().optional(),
  company_size_max: z.number().int().nonnegative().optional(),
  revenue_min: z.number().nonnegative().optional(),
  revenue_max: z.number().nonnegative().optional(),
  business_types: z.array(z.string()).default([]),
  job_titles: z.array(z.string()).default([]),
  seniority_levels: z.array(z.string()).default([]),
  technology_signals: z.array(z.string()).default([]),
  website_required: z.boolean().default(false),
  social_required: z.boolean().default(false),
  pain_points: z.array(z.string()).default([]),
  excluded_industries: z.array(z.string()).default([]),
  excluded_keywords: z.array(z.string()).default([]),
  excluded_domains: z.array(z.string()).default([]),
  custom_criteria: z.record(z.string(), z.unknown()).default({}),
});

const updateSchema = icpSchema.partial().required({ tenantId: true }).extend({
  icpId: z.string().uuid(),
});

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json({ error: 'Valid tenantId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);
    const icps = await listICPs(tenantId);
    return NextResponse.json({ success: true, icps });
  } catch (error) {
    return routeErrorResponse(error, 'ICPs could not be loaded', request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = icpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ICP data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { user } = await requireTenantAccess(parsed.data.tenantId, request);
    const icp = await createICP(parsed.data.tenantId, user.id, parsed.data);
    return NextResponse.json({ success: true, icp }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error, 'ICP could not be created', request);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ICP update data', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await requireTenantAccess(parsed.data.tenantId, request);
    const { tenantId, icpId, ...updates } = parsed.data;
    const icp = await updateICP(tenantId, icpId, updates);
    return NextResponse.json({ success: true, icp });
  } catch (error) {
    return routeErrorResponse(error, 'ICP could not be updated', request);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const tenantId = request.nextUrl.searchParams.get('tenantId') || '';
    const icpId = request.nextUrl.searchParams.get('icpId') || '';
    if (!z.string().uuid().safeParse(tenantId).success || !z.string().uuid().safeParse(icpId).success) {
      return NextResponse.json({ error: 'Valid tenantId and icpId required' }, { status: 400 });
    }
    await requireTenantAccess(tenantId, request);
    await deleteICP(tenantId, icpId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'ICP could not be deleted', request);
  }
}
