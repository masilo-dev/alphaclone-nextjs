import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, createAdminSupabaseClientOrThrow, routeErrorResponse } from '@/lib/apiAuth';
import { quantumDealIntelligenceService } from '@/services/intelligence/quantumDealIntelligenceService';

export const dynamic = 'force-dynamic';

const schema = z.object({
  tenantId: z.string().uuid(),
  dealId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, dealId } = parsed.data;
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    if (dealId) {
      const state = await quantumDealIntelligenceService.recomputeDeal(admin, tenantId, dealId);
      return NextResponse.json({ success: true, tenantId, dealId, updatedAt: state.updated_at });
    }

    const result = await quantumDealIntelligenceService.recomputeTenant(admin, tenantId);
    return NextResponse.json({ success: true, tenantId, ...result });
  } catch (error: any) {
    return routeErrorResponse(error, 'Failed to recompute deal intelligence');
  }
}

