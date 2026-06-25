import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  origin: z.enum(['tickets', 'support_tickets']),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed', 'reopened', 'waiting']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

const UI_STATUS_TO_SUPPORT: Record<string, string> = {
  open: 'open',
  in_progress: 'in_progress',
  reopened: 'open',
  resolved: 'resolved',
  closed: 'closed',
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, origin, status, priority } = parsed.data;
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const table = origin === 'support_tickets' ? 'support_tickets' : 'tickets';
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status) {
      if (origin === 'support_tickets') {
        update.status = UI_STATUS_TO_SUPPORT[status] || status;
      } else {
        update.status = status;
        if (status === 'resolved') update.resolved_at = new Date().toISOString();
        if (status === 'closed') update.closed_at = new Date().toISOString();
      }
    }

    if (priority) {
      update.priority = priority;
    }

    const { data, error } = await admin
      .from(table)
      .update(update)
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, ticket: data });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
