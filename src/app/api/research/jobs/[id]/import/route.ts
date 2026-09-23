import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { researchService } from '@/lib/research/researchService';

const importSchema = z.object({
  tenantId: z.string().uuid(),
  resultIds: z.array(z.string().uuid()).optional(),
  defaultStage: z.string().optional().default('new'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid parameters' }, { status: 400 });
    }

    const auth = await requireTenantAccess(parsed.data.tenantId, request);
    const result = await researchService.importResearchLeadsToCrm(
      parsed.data.tenantId,
      auth.user?.id || null,
      id,
      parsed.data.resultIds,
      { defaultStage: parsed.data.defaultStage }
    );

    return NextResponse.json({
      success: true,
      importedCount: result.importedCount,
      leadIds: result.leadIds,
      errors: result.errors,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Research leads could not be imported to CRM', request);
  }
}
