import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { evaluateConditions, resolveTemplate } from '@/services/engine/WorkflowExecutor';

const condition = z.object({ field: z.string().min(1).max(200), operator: z.string().min(1).max(50), value: z.unknown().optional() });
const action = z.object({ type: z.string().min(1).max(100), config: z.record(z.string(), z.unknown()) });
const workflow = z.object({ name: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(), trigger_type: z.string().min(1).max(100), conditions: z.array(condition).max(50), actions: z.array(action).min(1).max(50) });
const idSchema = z.string().uuid();

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params; const { user } = await requireTenantAccess(tenantId, req);
    const body = await req.json().catch(() => ({})); const rows = z.array(workflow).min(1).max(20).safeParse(body.workflows || [body]);
    if (!rows.success) return NextResponse.json({ error: 'Invalid workflow definition', fields: rows.error.flatten().fieldErrors }, { status: 400 });
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin.from('workflow_definitions').insert(rows.data.map((item) => ({ ...item, tenant_id: tenantId, created_by: user.id, is_active: false }))).select('*');
    if (error) throw error; return NextResponse.json({ workflows: data || [] }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Workflow could not be created', req); }
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try { const { tenantId } = await context.params; await requireTenantAccess(tenantId, req); const body = await req.json().catch(() => ({}));
    const parsed = z.object({ workflowId: idSchema, isActive: z.boolean() }).safeParse(body); if (!parsed.success) return NextResponse.json({ error: 'Invalid workflow update' }, { status: 400 });
    const admin = createSupabaseAdminClient(); const { data, error } = await admin.from('workflow_definitions').update({ is_active: parsed.data.isActive, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', parsed.data.workflowId).select('id').maybeSingle();
    if (error) throw error; if (!data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 }); return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Workflow could not be updated', req); }
}
export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try { const { tenantId } = await context.params; await requireTenantAccess(tenantId, req); const id = req.nextUrl.searchParams.get('workflowId') || ''; if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Valid workflowId required' }, { status: 400 });
    const admin = createSupabaseAdminClient(); const { data, error } = await admin.from('workflow_definitions').delete().eq('tenant_id', tenantId).eq('id', id).select('id').maybeSingle(); if (error) throw error; if (!data) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 }); return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Workflow could not be deleted', req); }
}
export async function PUT(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try { const { tenantId } = await context.params; await requireTenantAccess(tenantId, req); const body = await req.json().catch(() => ({})); const id = String(body.workflowId || ''); if (!idSchema.safeParse(id).success) return NextResponse.json({ error: 'Valid workflowId required' }, { status: 400 });
    const admin = createSupabaseAdminClient(); const { data: row } = await admin.from('workflow_definitions').select('conditions, actions').eq('tenant_id', tenantId).eq('id', id).maybeSingle(); if (!row) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    const sample = z.record(z.string(), z.unknown()).parse(body.sample || {}); const conditionsMet = evaluateConditions(row.conditions || [], sample); const previews = (row.actions || []).map((entry: any) => ({ type: entry.type, resolvedConfig: Object.fromEntries(Object.entries(entry.config || {}).map(([key, value]) => [key, typeof value === 'string' ? resolveTemplate(value, sample) : value])) }));
    return NextResponse.json({ success: true, dryRun: true, conditionsMet, actions: previews });
  } catch (error) { return routeErrorResponse(error, 'Workflow test could not be completed', req); }
}
