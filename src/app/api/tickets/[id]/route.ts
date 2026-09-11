import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  tenantId: z.string().uuid(),
  origin: z.literal('tickets').default('tickets'),
  status: z.enum([
    'new', 'open', 'in_progress', 'waiting_on_customer', 'waiting_on_business',
    'escalated', 'resolved', 'closed', 'reopened'
  ]).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});
const commentSchema = z.object({ tenantId: z.string().uuid(), content: z.string().trim().min(1).max(10000), isInternal: z.boolean().default(false) });

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

    const { tenantId, status, priority } = parsed.data;
    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (status) {
      update.status = status;
      update.waiting_on = status === 'waiting_on_customer'
        ? 'customer'
        : ['new', 'open', 'in_progress', 'waiting_on_business', 'escalated', 'reopened'].includes(status)
          ? 'business'
          : null;
      if (status === 'resolved') update.resolved_at = new Date().toISOString();
      if (status === 'closed') update.closed_at = new Date().toISOString();
    }

    if (priority) {
      update.priority = priority;
    }

    const { data, error } = await admin
      .from('tickets')
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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = commentSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid ticket comment' }, { status: 400 });
    const { user } = await requireTenantAccess(parsed.data.tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();
    const { data: ticket, error: ticketError } = await admin.from('tickets').select('*').eq('id', id).eq('tenant_id', parsed.data.tenantId).maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    const { data: comment, error } = await admin.from('ticket_comments').insert({ ticket_id: id, user_id: user.id, content: parsed.data.content, is_internal: parsed.data.isInternal }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: parsed.data.tenantId, event_type: 'ticket_comment_added', payload: { ticketId: id, commentId: comment.id, internal: parsed.data.isInternal, actorUserId: user.id } });
    return NextResponse.json({ success: true, comment, ticket }, { status: 201 });
  } catch (err) { return routeErrorResponse(err, 'Ticket comment could not be added', req); }
}
