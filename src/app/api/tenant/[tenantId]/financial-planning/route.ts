import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const cashSchema = z.object({ kind: z.literal('cash'), date: z.string().date(), type: z.enum(['inflow', 'outflow']), amount: z.coerce.number().positive().max(1_000_000_000_000), category: z.string().trim().min(1).max(200), description: z.string().trim().max(3000).optional(), status: z.enum(['estimated', 'confirmed']) });
const taxSchema = z.object({ kind: z.literal('tax'), taxYear: z.coerce.number().int().min(2000).max(2200), quarter: z.coerce.number().int().min(1).max(4), income: z.coerce.number().min(0).max(1_000_000_000_000), expenses: z.coerce.number().min(0).max(1_000_000_000_000), deductions: z.coerce.number().min(0).max(1_000_000_000_000), taxRate: z.coerce.number().min(0).max(100), status: z.enum(['draft', 'paid']) });
const createSchema = z.discriminatedUnion('kind', [cashSchema, taxSchema]);

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { admin } = await requireTenantAccess(tenantId, req);
    const [cash, tax, accounts] = await Promise.all([
      admin.from('cash_flow_projections').select('*').eq('tenant_id', tenantId).order('forecast_date', { ascending: true }),
      admin.from('tax_records').select('*').eq('tenant_id', tenantId).order('tax_year', { ascending: false }).order('quarter', { ascending: false }),
      admin.from('bank_accounts').select('current_balance').eq('tenant_id', tenantId).eq('is_active', true),
    ]);
    if (cash.error) throw cash.error;
    if (tax.error) throw tax.error;
    if (accounts.error) throw accounts.error;
    const openingCash = (accounts.data || []).reduce((sum: number, account: any) => sum + Number(account.current_balance || 0), 0);
    const projections = (cash.data || []).map((row: any) => ({ id: row.id, tenant_id: row.tenant_id, projection_date: row.forecast_date, type: Number(row.projected_inflow || 0) > 0 ? 'inflow' : 'outflow', amount: Number(row.projected_inflow || row.projected_outflow || 0), category: row.category || (Number(row.projected_inflow || 0) > 0 ? 'Revenue' : 'Expenses'), description: row.description, status: row.status, created_at: row.created_at }));
    const taxRecords = (tax.data || []).map((row: any) => ({ id: row.id, tenant_id: row.tenant_id, tax_year: row.tax_year, quarter: row.quarter, estimated_income: Number(row.estimated_income || 0), estimated_expenses: Number(row.estimated_expenses || 0), deduction_amount: Number(row.deduction_amount || 0), tax_rate: Number(row.tax_rate || 0), estimated_tax_due: Number(row.tax_owed || 0), status: row.status, created_at: row.created_at }));
    return NextResponse.json({ projections, taxRecords, openingCash });
  } catch (error) { return routeErrorResponse(error, 'Financial planning data could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid financial planning entry', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    if (parsed.data.kind === 'cash') {
      const value = parsed.data;
      const { data, error } = await admin.from('cash_flow_projections').insert({ tenant_id: tenantId, forecast_date: value.date, projected_inflow: value.type === 'inflow' ? value.amount : 0, projected_outflow: value.type === 'outflow' ? value.amount : 0, category: value.category, description: value.description || null, status: value.status, confidence_score: value.status === 'confirmed' ? 100 : 0 }).select('*').single();
      if (error) throw error;
      await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'cash_projection_created', payload: { projectionId: data.id, actorUserId: user.id } });
      return NextResponse.json({ success: true }, { status: 201 });
    }
    const value = parsed.data;
    const taxableProfit = Math.max(0, value.income - value.expenses - value.deductions);
    const taxOwed = Number((taxableProfit * value.taxRate / 100).toFixed(2));
    const { data, error } = await admin.from('tax_records').upsert({ tenant_id: tenantId, tax_year: value.taxYear, quarter: value.quarter, estimated_income: value.income, estimated_expenses: value.expenses, deduction_amount: value.deductions, tax_rate: value.taxRate, tax_owed: taxOwed, tax_paid: value.status === 'paid' ? taxOwed : 0, status: value.status, calculated_at: new Date().toISOString() }, { onConflict: 'tenant_id,tax_year,quarter' }).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tax_estimate_saved', payload: { taxRecordId: data.id, actorUserId: user.id, taxRate: value.taxRate } });
    return NextResponse.json({ success: true, taxOwed }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Financial planning entry could not be saved', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
    const id = req.nextUrl.searchParams.get('id') || '';
    const kind = req.nextUrl.searchParams.get('kind');
    if (!z.string().uuid().safeParse(id).success || (kind !== 'cash' && kind !== 'tax')) return NextResponse.json({ error: 'Valid id and kind required' }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const table = kind === 'cash' ? 'cash_flow_projections' : 'tax_records';
    const { data, error } = await admin.from(table).delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'financial_planning_entry_deleted', payload: { id, kind, actorUserId: user.id } });
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Financial planning entry could not be deleted', req); }
}
