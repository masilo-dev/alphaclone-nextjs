import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import type { TicketPriority, TicketStatus } from '@/services/ticketService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

type SupportTicketRow = {
  id: string;
  tenant_id: string;
  ticket_number: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
  source: string | null;
  contact_id: string | null;
  client_id: string | null;
  assigned_to: string | null;
  sla_due_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

const SUPPORT_STATUS_TO_UI: Record<string, TicketStatus> = {
  open: 'open',
  in_progress: 'in_progress',
  waiting: 'in_progress',
  resolved: 'resolved',
  closed: 'closed',
};

const createSchema = z.object({ tenantId: z.string().uuid(), title: z.string().trim().min(1).max(250), description: z.string().trim().min(1).max(10000), priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'), source: z.enum(['lead', 'client', 'project', 'invoice', 'contract', 'general']), sourceId: z.string().trim().max(250).optional(), sourceName: z.string().trim().max(250).optional(), assignedTo: z.string().uuid().optional(), tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]), metadata: z.record(z.string(), z.unknown()).default({}), customerEmail: z.string().email().optional() });

function mapSupportTicket(row: SupportTicketRow) {
  const channel = row.source || 'api';
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: row.title,
    description: row.description || '',
    status: SUPPORT_STATUS_TO_UI[row.status] || 'open',
    priority: row.priority as TicketPriority,
    source: 'general',
    source_id: row.contact_id || row.client_id || undefined,
    source_name: row.ticket_number ? `${row.ticket_number} · ${channel}` : channel,
    assigned_to: row.assigned_to || undefined,
    created_by: row.assigned_to || '00000000-0000-0000-0000-000000000000',
    created_at: row.created_at,
    updated_at: row.updated_at,
    resolved_at: row.resolved_at || undefined,
    closed_at: row.closed_at || undefined,
    sla_due_at: row.sla_due_at || undefined,
    tags: row.category ? [row.category] : [],
    metadata: {
      ...(row.metadata || {}),
      fromSupportTable: true,
      ticketNumber: row.ticket_number,
      channel,
      slaDueAt: row.sla_due_at,
      supportStatus: row.status,
    },
    _origin: 'support_tickets' as const,
  };
}

/** Unified ticket list: dashboard tickets + WhatsApp/MCP support_tickets */
export async function GET(req: NextRequest) {
  try {
    const tenantId = req.nextUrl.searchParams.get('tenantId')?.trim();
    if (!tenantId) {
      return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });
    }

    await requireTenantAccess(tenantId);
    const admin = createAdminSupabaseClientOrThrow();

    const [ticketsResult, supportResult] = await Promise.all([
      admin
        .from('tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
      admin
        .from('support_tickets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false }),
    ]);

    if (ticketsResult.error) throw ticketsResult.error;

    const dashboardTickets = (ticketsResult.data || []).map((t: Record<string, unknown>) => ({
      ...t,
      _origin: 'tickets' as const,
    }));

    const supportTickets = supportResult.error
      ? []
      : (supportResult.data || []).map((row: SupportTicketRow) => mapSupportTicket(row));

    const merged = [...dashboardTickets, ...supportTickets].sort(
      (a, b) =>
        new Date(String((b as { created_at?: string }).created_at || 0)).getTime() -
        new Date(String((a as { created_at?: string }).created_at || 0)).getTime()
    );

    return NextResponse.json({ success: true, tickets: merged });
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
