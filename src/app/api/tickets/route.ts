import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClientOrThrow, requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import type { TicketPriority, TicketStatus } from '@/services/ticketService';

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
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({ success: true, tickets: merged });
  } catch (err) {
    return routeErrorResponse(err);
  }
}
