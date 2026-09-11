import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string; projectId: string }> }) {
  try {
    const { tenantId, projectId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    if (!(await isExecutionFeatureEnabled(admin, 'PROJECTS_V2', tenantId))) {
      return NextResponse.json({ error: 'Projects V2 is not enabled for this workspace' }, { status: 404 });
    }

    const { data: project, error: projectError } = await admin
      .from('projects')
      .select('id,name,currency_code,budget,budget_total,approved_budget,estimated_value,actual_revenue,estimated_cost,actual_cost,profitability,projected_margin,status')
      .eq('tenant_id', tenantId)
      .eq('id', projectId)
      .is('deleted_at', null)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const [{ data: directInvoices, error: directError }, { data: relationships, error: relationshipError }] = await Promise.all([
      admin.from('business_invoices')
        .select('id,invoice_number,status,total,amount_paid,balance_due,currency,due_date,issue_date,paid_at')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('issue_date', { ascending: true }),
      admin.from('project_relationships')
        .select('target_type,target_id')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId),
    ]);
    if (directError) throw directError;
    if (relationshipError) throw relationshipError;

    const linkedIds = (relationships || [])
      .filter((r: any) => ['invoice', 'business_invoice'].includes(String(r.target_type || '').toLowerCase()))
      .map((r: any) => r.target_id)
      .filter(Boolean);
    let linkedInvoices: any[] = [];
    if (linkedIds.length) {
      const { data, error } = await admin.from('business_invoices')
        .select('id,invoice_number,status,total,amount_paid,balance_due,currency,due_date,issue_date,paid_at')
        .eq('tenant_id', tenantId)
        .in('id', linkedIds);
      if (error) throw error;
      linkedInvoices = data || [];
    }

    const byId = new Map<string, any>();
    for (const invoice of [...(directInvoices || []), ...linkedInvoices]) byId.set(String(invoice.id), invoice);
    const invoices = Array.from(byId.values());

    const invoiceIds = invoices.map((i) => i.id);
    let payments: any[] = [];
    if (invoiceIds.length) {
      const { data, error } = await admin.from('business_invoice_payments')
        .select('id,invoice_id,amount,currency,source,external_reference,created_at')
        .eq('tenant_id', tenantId)
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: true });
      if (error) throw error;
      payments = data || [];
    }

    const invoiced = invoices.reduce((s, i) => s + Number(i.total || 0), 0);
    const paidFromInvoices = invoices.reduce((s, i) => s + Number(i.amount_paid || 0), 0);
    const paidFromLedger = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const paid = Math.max(paidFromInvoices, paidFromLedger);
    const outstanding = invoices.reduce((s, i) => s + Number(i.balance_due ?? Math.max(0, Number(i.total || 0) - Number(i.amount_paid || 0))), 0);
    const estimatedValue = Number(project.estimated_value ?? project.approved_budget ?? project.budget_total ?? project.budget ?? 0) || 0;
    const estimatedCost = Number(project.estimated_cost || 0) || 0;
    const actualCost = Number(project.actual_cost || 0) || 0;
    const actualRevenue = paid;
    const grossProfit = actualRevenue - actualCost;
    const projectedRevenue = Math.max(invoiced, estimatedValue);
    const projectedProfit = projectedRevenue - estimatedCost;
    const projectedMargin = projectedRevenue > 0 ? projectedProfit / projectedRevenue : 0;
    const realizedMargin = actualRevenue > 0 ? grossProfit / actualRevenue : 0;
    const uninvoicedValue = Math.max(0, estimatedValue - invoiced);

    const overdueInvoices = invoices.filter((i) => i.due_date && new Date(i.due_date).getTime() < Date.now() && Number(i.balance_due ?? 0) > 0 && !['paid','void','cancelled'].includes(String(i.status || '').toLowerCase()));

    return NextResponse.json({
      project: { id: project.id, name: project.name, status: project.status },
      financials: {
        currency: invoices.find((i) => i.currency)?.currency || project.currency_code || 'USD',
        estimatedValue,
        invoiced,
        paid,
        outstanding,
        uninvoicedValue,
        estimatedCost,
        actualCost,
        grossProfit,
        projectedProfit,
        projectedMargin,
        realizedMargin,
        invoiceCoverage: estimatedValue > 0 ? invoiced / estimatedValue : null,
      },
      invoices,
      payments,
      alerts: {
        overdueInvoiceCount: overdueInvoices.length,
        overdueInvoices,
        completedWorkPotentiallyUnbilled: ['completed','complete','done','closed'].includes(String(project.status || '').toLowerCase()) && uninvoicedValue > 0,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return routeErrorResponse(error, 'Project financials could not be loaded', req);
  }
}
