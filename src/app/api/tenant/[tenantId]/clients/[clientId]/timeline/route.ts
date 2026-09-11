import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';

function eventTime(value: unknown): number {
  const n = new Date(String(value || 0)).getTime();
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; clientId: string }> }) {
  try {
    const { tenantId, clientId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();

    const { data: client, error: clientError } = await admin
      .from('business_clients')
      .select('id,name,email,phone,created_at,updated_at')
      .eq('tenant_id', tenantId)
      .eq('id', clientId)
      .maybeSingle();
    if (clientError) throw clientError;
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const [{ data: projects, error: projectsError }, { data: invoices, error: invoicesError }, { data: tenantEvents, error: eventsError }] = await Promise.all([
      admin.from('projects')
        .select('id,name,status,current_stage,health_status,created_at,updated_at,completed_at')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId)
        .is('deleted_at', null),
      admin.from('business_invoices')
        .select('id,invoice_number,status,total,amount_paid,balance_due,currency,issue_date,due_date,paid_at,created_at,updated_at,project_id')
        .eq('tenant_id', tenantId)
        .eq('client_id', clientId),
      admin.from('business_automation_events')
        .select('id,event_type,payload,created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(500),
    ]);
    if (projectsError) throw projectsError;
    if (invoicesError) throw invoicesError;
    if (eventsError) throw eventsError;

    const projectIds = (projects || []).map((p: any) => p.id);
    const invoiceIds = (invoices || []).map((i: any) => i.id);

    const [activityResult, approvalsResult, approvalHistoryResult, paymentsResult] = await Promise.all([
      projectIds.length
        ? admin.from('project_activity').select('id,project_id,task_id,actor_user_id,action,target_type,target_id,source,correlation_id,new_value,created_at').eq('tenant_id', tenantId).in('project_id', projectIds).order('created_at', { ascending: false }).limit(500)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? admin.from('project_client_approvals').select('id,project_id,approval_type,title,status,requested_from_name,requested_from_email,requested_at,viewed_at,decided_at,expires_at,version_label,created_at,updated_at').eq('tenant_id', tenantId).in('project_id', projectIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? admin.from('project_client_approval_history').select('id,approval_id,project_id,action,actor_type,actor_name,actor_email,comment,approved_version,correlation_id,created_at').eq('tenant_id', tenantId).in('project_id', projectIds)
        : Promise.resolve({ data: [], error: null }),
      invoiceIds.length
        ? admin.from('business_invoice_payments').select('id,invoice_id,amount,currency,source,external_reference,recorded_by,created_at').eq('tenant_id', tenantId).in('invoice_id', invoiceIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (activityResult.error) throw activityResult.error;
    if (approvalsResult.error) throw approvalsResult.error;
    if (approvalHistoryResult.error) throw approvalHistoryResult.error;
    if (paymentsResult.error) throw paymentsResult.error;

    const projectIdSet = new Set(projectIds.map(String));
    const invoiceIdSet = new Set(invoiceIds.map(String));
    const relevantEvents = (tenantEvents || []).filter((event: any) => {
      const p = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const payloadClient = String(p.clientId || p.client_id || p.customerId || p.customer_id || '');
      const payloadProject = String(p.projectId || p.project_id || '');
      const payloadInvoice = String(p.invoiceId || p.invoice_id || '');
      return payloadClient === clientId || projectIdSet.has(payloadProject) || invoiceIdSet.has(payloadInvoice);
    });

    const timeline: any[] = [
      { id: `client:${client.id}:created`, type: 'client.created', source: 'crm', occurredAt: client.created_at, title: 'Client created', data: { clientId: client.id, name: client.name } },
      ...(projects || []).map((p: any) => ({ id: `project:${p.id}`, type: 'project.created', source: 'projects', occurredAt: p.created_at, title: `Project created: ${p.name}`, projectId: p.id, data: p })),
      ...(activityResult.data || []).map((a: any) => ({ id: `project-activity:${a.id}`, type: `project.${a.action}`, source: a.source || 'projects', occurredAt: a.created_at, title: String(a.action || 'Project activity'), projectId: a.project_id, data: a })),
      ...(approvalsResult.data || []).map((a: any) => ({ id: `approval:${a.id}`, type: 'approval.requested', source: 'approvals', occurredAt: a.requested_at || a.created_at, title: `Approval requested: ${a.title}`, projectId: a.project_id, data: a })),
      ...(approvalHistoryResult.data || []).map((h: any) => ({ id: `approval-history:${h.id}`, type: `approval.${h.action}`, source: 'approvals', occurredAt: h.created_at, title: `Approval ${String(h.action).replace(/_/g, ' ')}`, projectId: h.project_id, data: h })),
      ...(invoices || []).map((i: any) => ({ id: `invoice:${i.id}`, type: 'invoice.created', source: 'finance', occurredAt: i.created_at || i.issue_date, title: `Invoice ${i.invoice_number || i.id}`, projectId: i.project_id, invoiceId: i.id, data: i })),
      ...(paymentsResult.data || []).map((p: any) => ({ id: `payment:${p.id}`, type: 'payment.received', source: 'finance', occurredAt: p.created_at, title: `Payment received: ${p.amount} ${p.currency}`, invoiceId: p.invoice_id, data: p })),
      ...relevantEvents.map((e: any) => ({ id: `event:${e.id}`, type: e.event_type, source: 'automation', occurredAt: e.created_at, title: String(e.event_type || 'Business event').replace(/[._]/g, ' '), data: e.payload || {} })),
    ].filter((item) => item.occurredAt);

    timeline.sort((a, b) => eventTime(b.occurredAt) - eventTime(a.occurredAt));
    const limit = Math.min(500, Math.max(1, Number(new URL(req.url).searchParams.get('limit') || 200)));

    return NextResponse.json({
      client,
      timeline: timeline.slice(0, limit),
      counts: {
        projects: projects?.length || 0,
        invoices: invoices?.length || 0,
        payments: paymentsResult.data?.length || 0,
        approvals: approvalsResult.data?.length || 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Client timeline could not be loaded', req);
  }
}
