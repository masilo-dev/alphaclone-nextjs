import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

const idSchema = z.string().uuid();
const stepSchema = z.object({
  action_type: z.string().trim().min(1).max(100),
  action_order: z.coerce.number().int().min(0).max(1000),
  action_config: z.record(z.string(), z.unknown()).default({}),
  delay_minutes: z.coerce.number().int().min(0).max(525600).default(0),
  is_active: z.boolean().default(true),
});
const workflowSchema = z.object({
  workflowId: idSchema.optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  trigger_type: z.string().trim().min(1).max(100).default('manual_trigger'),
  trigger_conditions: z.record(z.string(), z.unknown()).default({}),
  is_active: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).default({}),
  steps: z.array(stepSchema).max(100).default([]),
});
const executionStartSchema = z.object({
  operation: z.literal('start_execution'),
  workflowId: idSchema,
  context: z.record(z.string(), z.unknown()).default({}),
});
const executionFinishSchema = z.object({
  operation: z.literal('finish_execution'),
  executionId: idSchema,
  status: z.enum(['completed', 'failed', 'cancelled']),
  context: z.record(z.string(), z.unknown()).default({}),
  errorMessage: z.string().max(10_000).nullable().optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const workflowId = req.nextUrl.searchParams.get('workflowId');
    const view = req.nextUrl.searchParams.get('view') || 'workflows';

    if (view === 'templates') {
      const { data, error } = await admin.from('workflow_templates').select('*').is('tenant_id', null).order('name');
      if (error) throw error;
      return NextResponse.json({ templates: data || [] });
    }
    if (view === 'executions') {
      if (!workflowId || !idSchema.safeParse(workflowId).success) return NextResponse.json({ error: 'Valid workflowId required' }, { status: 400 });
      const { data, error } = await admin.from('automation_workflow_executions').select('*').eq('tenant_id', tenantId).eq('workflow_id', workflowId).order('executed_at', { ascending: false }).limit(50);
      if (error) throw error;
      return NextResponse.json({ executions: data || [] });
    }

    let query = admin.from('workflows').select('*, workflow_actions(*)').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (workflowId) {
      if (!idSchema.safeParse(workflowId).success) return NextResponse.json({ error: 'Valid workflowId required' }, { status: 400 });
      query = query.eq('id', workflowId);
    }
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data || []).map((item: any) => ({ ...item, steps: (item.workflow_actions || []).sort((a: any, b: any) => a.action_order - b.action_order) }));
    if (workflowId && !rows[0]) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    return NextResponse.json(workflowId ? { workflow: rows[0] } : { workflows: rows });
  } catch (error) { return routeErrorResponse(error, 'Workflows could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const body = await req.json().catch(() => ({}));
    const execution = executionStartSchema.safeParse(body);
    const admin = createSupabaseAdminClient();
    if (execution.success) {
      const { data: workflow, error: lookupError } = await admin.from('workflows').select('id').eq('tenant_id', tenantId).eq('id', execution.data.workflowId).eq('is_active', true).maybeSingle();
      if (lookupError) throw lookupError;
      if (!workflow) return NextResponse.json({ error: 'Workflow not found or disabled' }, { status: 404 });
      const { data, error } = await admin.from('automation_workflow_executions').insert({ workflow_id: workflow.id, tenant_id: tenantId, context: execution.data.context, status: 'running', executed_at: new Date().toISOString() }).select('*').single();
      if (error) throw error;
      return NextResponse.json({ execution: data }, { status: 201 });
    }

    const parsed = workflowSchema.omit({ workflowId: true }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid workflow', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const { steps, ...value } = parsed.data;
    const { data: workflow, error } = await admin.from('workflows').insert({ ...value, tenant_id: tenantId, created_by: user.id }).select('*').single();
    if (error) throw error;
    if (steps.length) {
      const { error: stepError } = await admin.from('workflow_actions').insert(steps.map((step) => ({ ...step, workflow_id: workflow.id, tenant_id: tenantId })));
      if (stepError) { await admin.from('workflows').delete().eq('tenant_id', tenantId).eq('id', workflow.id); throw stepError; }
    }
    return NextResponse.json({ workflow: { ...workflow, steps } }, { status: 201 });
  } catch (error) { return routeErrorResponse(error, 'Workflow could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const body = await req.json().catch(() => ({}));
    const finish = executionFinishSchema.safeParse(body);
    const admin = createSupabaseAdminClient();
    if (finish.success) {
      const { data, error } = await admin.from('automation_workflow_executions').update({ status: finish.data.status, context: finish.data.context, error_message: finish.data.errorMessage || null }).eq('tenant_id', tenantId).eq('id', finish.data.executionId).eq('status', 'running').select('id').maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: 'Running execution not found' }, { status: 404 });
      return NextResponse.json({ success: true });
    }

    const parsed = workflowSchema.safeParse(body);
    if (!parsed.success || !parsed.data.workflowId) return NextResponse.json({ error: 'Invalid workflow update', fields: parsed.success ? undefined : parsed.error.flatten().fieldErrors }, { status: 400 });
    const { workflowId, steps, ...value } = parsed.data;
    const { data: existing, error: lookupError } = await admin.from('workflows').select('*, workflow_actions(*)').eq('tenant_id', tenantId).eq('id', workflowId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    const { error: updateError } = await admin.from('workflows').update({ ...value, updated_at: new Date().toISOString() }).eq('tenant_id', tenantId).eq('id', workflowId);
    if (updateError) throw updateError;
    const { error: deleteError } = await admin.from('workflow_actions').delete().eq('tenant_id', tenantId).eq('workflow_id', workflowId);
    if (deleteError) throw deleteError;
    if (steps.length) {
      const { error: stepError } = await admin.from('workflow_actions').insert(steps.map((step) => ({ ...step, workflow_id: workflowId, tenant_id: tenantId })));
      if (stepError) {
        const old = (existing.workflow_actions || []).map(({ id: _id, created_at: _created, updated_at: _updated, ...step }: any) => step);
        if (old.length) await admin.from('workflow_actions').insert(old);
        throw stepError;
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Workflow could not be updated', req); }
}
