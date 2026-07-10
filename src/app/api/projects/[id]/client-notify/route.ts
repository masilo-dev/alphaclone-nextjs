import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import {
  notifyProjectClientNote,
  notifyProjectClientProgressUpdate,
  notifyProjectClientStageUpdate,
} from '@/lib/projects/projectClientNotification';

const bodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('progress'),
    tenantId: z.string().uuid(),
    previousProgress: z.number().min(0).max(100).optional().nullable(),
    newProgress: z.number().min(0).max(100),
    trigger: z.enum(['progress_change', 'milestone', 'manual']).optional(),
  }),
  z.object({
    type: z.literal('stage'),
    tenantId: z.string().uuid(),
    previousStage: z.string().min(1),
    newStage: z.string().min(1),
  }),
  z.object({
    type: z.literal('note'),
    tenantId: z.string().uuid(),
    noteContent: z.string().min(1).max(8000),
    authorName: z.string().max(200).optional(),
  }),
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 422 });
    }

    const payload = parsed.data;
    await requireTenantAccess(payload.tenantId);

    const admin = createSupabaseAdminClient();
    const origin = req.nextUrl.origin;

    if (payload.type === 'progress') {
      const result = await notifyProjectClientProgressUpdate({
        admin,
        projectId,
        tenantId: payload.tenantId,
        previousProgress: payload.previousProgress ?? null,
        newProgress: payload.newProgress,
        origin,
        trigger: payload.trigger,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (payload.type === 'stage') {
      const result = await notifyProjectClientStageUpdate({
        admin,
        projectId,
        tenantId: payload.tenantId,
        previousStage: payload.previousStage,
        newStage: payload.newStage,
        origin,
      });
      return NextResponse.json({ success: true, ...result });
    }

    const result = await notifyProjectClientNote({
      admin,
      projectId,
      tenantId: payload.tenantId,
      noteContent: payload.noteContent,
      authorName: payload.authorName,
      origin,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return routeErrorResponse(error, 'Failed to notify client', req);
  }
}
