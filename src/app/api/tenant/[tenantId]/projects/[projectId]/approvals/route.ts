import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { isExecutionFeatureEnabled } from '@/lib/projects/executionFeatureFlags';
import { emitBusinessEvent } from '@/lib/automation/emit-event';

const createApprovalSchema = z.object({
  approvalType: z.enum(['design', 'document', 'proposal', 'deliverable', 'milestone', 'custom']),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
  milestoneId: z.string().uuid().nullable().optional(),
  deliverableId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  requestedFromName: z.string().trim().max(200).nullable().optional(),
  requestedFromEmail: z.string().email().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  versionLabel: z.string().trim().max(120).nullable().optional(),
  correlationId: z.string().trim().max(200).nullable().optional(),
  idempotencyKey: z.string().trim().min(1).max(240).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const updateApprovalSchema = z.object({
  approvalId: z.string().uuid(),
  action: z.enum(['viewed', 'approved', 'changes_requested', 'expired', 'commented']),
  comment: z.string().trim().max(4000).nullable().optional(),
  actorName: z.string().trim().max(200).nullable().optional(),
  actorEmail: z.string().email().nullable().optional(),
  sessionMetadata: z.record(z.string(), z.unknown()).default({}),
  correlationId: z.string().trim().max(200).nullable().optional(),
});

async function requireApprovalsEnabled(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string) {
  const [projectsEnabled, approvalsEnabled] = await Promise.all([
    isExecutionFeatureEnabled(admin, 'PROJECTS_V2', tenantId),
    isExecutionFeatureEnabled(admin, 'CLIENT_APPROVALS_ENABLED', tenantId),
  ]);
  if (!projectsEnabled || !approvalsEnabled) {
    throw Object.assign(new Error('client_approvals_not_enabled'), { status: 404 });
  }
}

async function requireProject(admin: ReturnType<typeof createSupabaseAdminClient>, tenantId: string, projectId: string) {
  const { data, error } = await admin
    .from('projects')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('id', projectId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error('project_not_found'), { status: 404 });
}

async function validateOptionalReference(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  tenantId: string,
  projectId: string,
  table: 'tasks' | 'project_milestones' | 'project_deliverables',
  id?: string | null,
) {
  if (!id) return;
  const { data, error } = await admin
    .from(table)
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('project_id', projectId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Object.assign(new Error(`${table}_reference_not_found`), { status: 400 });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    await requireApprovalsEnabled(admin, tenantId);
    await requireProject(admin, tenantId, projectId);

    const [{ data: approvals, error: approvalsError }, { data: history, error: historyError }] = await Promise.all([
      admin
        .from('project_client_approvals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false }),
      admin
        .from('project_client_approval_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(200),
    ]);
    if (approvalsError) throw approvalsError;
    if (historyError) throw historyError;
    return NextResponse.json({ approvals: approvals || [], history: history || [] });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = createApprovalSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid approval request', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const input = parsed.data;
    const admin = createSupabaseAdminClient();
    await requireApprovalsEnabled(admin, tenantId);
    await requireProject(admin, tenantId, projectId);
    await Promise.all([
      validateOptionalReference(admin, tenantId, projectId, 'tasks', input.taskId),
      validateOptionalReference(admin, tenantId, projectId, 'project_milestones', input.milestoneId),
      validateOptionalReference(admin, tenantId, projectId, 'project_deliverables', input.deliverableId),
    ]);

    if (input.idempotencyKey) {
      const { data: existing, error: existingError } = await admin
        .from('project_client_approvals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return NextResponse.json({ approval: existing, duplicate: true });
    }

    const correlationId = input.correlationId || globalThis.crypto.randomUUID();
    const { data: approval, error } = await admin
      .from('project_client_approvals')
      .insert({
        tenant_id: tenantId,
        project_id: projectId,
        approval_type: input.approvalType,
        title: input.title,
        description: input.description || null,
        task_id: input.taskId || null,
        milestone_id: input.milestoneId || null,
        deliverable_id: input.deliverableId || null,
        document_id: input.documentId || null,
        requested_from_name: input.requestedFromName || null,
        requested_from_email: input.requestedFromEmail || null,
        requested_by: user.id,
        expires_at: input.expiresAt || null,
        version_label: input.versionLabel || null,
        metadata: input.metadata,
        correlation_id: correlationId,
        idempotency_key: input.idempotencyKey || null,
        last_actor_type: 'user',
        last_actor_user_id: user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    await emitBusinessEvent(tenantId, 'approval.requested', {
      projectId,
      approvalId: approval.id,
      actorUserId: user.id,
      correlation_id: correlationId,
      idempotency_key: input.idempotencyKey || `approval.requested:${approval.id}`,
    }).catch(() => undefined);

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    return routeErrorResponse(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; projectId: string }> },
) {
  try {
    const { tenantId, projectId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = updateApprovalSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid approval action', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const input = parsed.data;
    const admin = createSupabaseAdminClient();
    await requireApprovalsEnabled(admin, tenantId);
    await requireProject(admin, tenantId, projectId);

    const { data: existing, error: existingError } = await admin
      .from('project_client_approvals')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('id', input.approvalId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existing) return NextResponse.json({ error: 'Approval not found' }, { status: 404 });

    const correlationId = input.correlationId || existing.correlation_id || globalThis.crypto.randomUUID();

    if (input.action === 'commented') {
      const { error: historyError } = await admin.from('project_client_approval_history').insert({
        tenant_id: tenantId,
        approval_id: existing.id,
        project_id: projectId,
        action: 'commented',
        actor_type: 'user',
        actor_user_id: user.id,
        actor_name: input.actorName || null,
        actor_email: input.actorEmail || null,
        comment: input.comment || null,
        approved_version: existing.version_label || null,
        session_metadata: input.sessionMetadata,
        correlation_id: correlationId,
      });
      if (historyError) throw historyError;
      return NextResponse.json({ approval: existing, commented: true });
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      status: input.action,
      updated_at: now,
      correlation_id: correlationId,
      last_actor_type: 'user',
      last_actor_user_id: user.id,
      last_actor_name: input.actorName || null,
      last_actor_email: input.actorEmail || null,
      metadata: {
        ...(existing.metadata || {}),
        last_comment: input.comment || null,
        last_session_metadata: input.sessionMetadata,
      },
    };
    if (input.action === 'viewed') updates.viewed_at = existing.viewed_at || now;
    if (input.action === 'approved' || input.action === 'changes_requested') updates.decided_at = now;

    const { data: approval, error } = await admin
      .from('project_client_approvals')
      .update(updates)
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .eq('id', input.approvalId)
      .select('*')
      .single();
    if (error) throw error;

    const eventType =
      input.action === 'approved'
        ? 'approval.approved'
        : input.action === 'changes_requested'
          ? 'approval.changes_requested'
          : null;
    if (eventType) {
      await emitBusinessEvent(tenantId, eventType, {
        projectId,
        approvalId: approval.id,
        actorUserId: user.id,
        correlation_id: correlationId,
        idempotency_key: `${eventType}:${approval.id}:${approval.updated_at}`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ approval });
  } catch (error) {
    return routeErrorResponse(error);
  }
}
