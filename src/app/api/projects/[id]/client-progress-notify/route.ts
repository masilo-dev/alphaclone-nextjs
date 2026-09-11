import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { notifyProjectClientProgressUpdate } from '@/lib/projects/projectClientNotification';

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  previousProgress: z.number().min(0).max(100).optional().nullable(),
  newProgress: z.number().min(0).max(100),
  trigger: z.enum(['progress_change', 'milestone', 'manual']).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** @deprecated Prefer POST /api/projects/[id]/client-notify with type=progress */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const { tenantId, previousProgress, newProgress, trigger } = parsed.data;
    await requireTenantAccess(tenantId);

    const admin = createSupabaseAdminClient();
    const result = await notifyProjectClientProgressUpdate({
      admin,
      projectId,
      tenantId,
      previousProgress: previousProgress ?? null,
      newProgress,
      origin: req.nextUrl.origin,
      trigger,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to notify client', req);
  }
}
