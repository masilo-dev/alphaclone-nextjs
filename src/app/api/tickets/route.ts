import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({ tenantId: z.string().uuid(), title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(10000), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'), source: z.enum(['lead', 'client', 'project', 'invoice', 'contract', 'general']), sourceId: z.string().trim().max(250).optional(), sourceName: z.string().trim().max(250).optional(), assignedTo: z.string().uuid().optional(), tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]), metadata: z.record(z.string(), z.unknown()).default({}), customerEmail: z.string().email().optional() });

/** Canonical ticket list. Legacy support_tickets are migrated once, never merged at read time. */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const ticketsResult = await admin
      .from('tickets')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false });

    if (ticketsResult.error) throw ticketsResult.error;

    const dashboardTickets = (ticketsResult.data || []).map((t: Record<string, unknown>) => ({
      ...t,
      _origin: 'tickets' as const,
    }));

    return NextResponse.json({ success: true, tickets: dashboardTickets });
  } catch (err) {
    return routeErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid ticket details', details: parsed.error.flatten() }, { status: 400 });
    const value = parsed.data;
    const { user } = await requireTenantAccess(value.tenantId, req);
    const admin = createAdminSupabaseClientOrThrow();
    if (value.assignedTo) {
      const { data: assignee } = await admin.from('tenant_users').select('user_id').eq('tenant_id', value.tenantId).eq('user_id', value.assignedTo).maybeSingle();
      if (!assignee) return NextResponse.json({ error: 'Ticket assignee is not a workspace member' }, { status: 400 });
    }
    const metadata = { ...value.metadata, ...(value.customerEmail ? { customerEmail: value.customerEmail } : {}) };
    const { data, error } = await admin.from('tickets').insert({ tenant_id: value.tenantId, title: value.title, description: value.description, priority: value.priority, status: 'open', source: value.source, source_id: value.sourceId || null, source_name: value.sourceName || null, assigned_to: value.assignedTo || null, created_by: user.id, tags: value.tags, metadata }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: value.tenantId, event_type: 'ticket_created', payload: { ticketId: data.id, actorUserId: user.id } });
    return NextResponse.json({ success: true, ticket: data }, { status: 201 });
  } catch (err) { return routeErrorResponse(err, 'Ticket could not be created', req); }
}
