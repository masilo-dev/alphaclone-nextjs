import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { researchService } from '@/lib/research/researchService';

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(['staged', 'approved', 'rejected', 'in_review']),
  rejectionReason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, { status: 400 });
    }

    await requireTenantAccess(parsed.data.tenantId, request);
    const updated = await researchService.updateResultReviewStatus(
      parsed.data.tenantId,
      id,
      parsed.data.status,
      parsed.data.rejectionReason
    );

    return NextResponse.json({ success: updated });
  } catch (error) {
    return routeErrorResponse(error, 'Lead status could not be updated', request);
  }
}
