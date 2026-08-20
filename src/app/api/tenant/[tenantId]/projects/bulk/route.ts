import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { normalizeProjectStage, normalizeProjectStatus } from '@/lib/projects/projectEnums';

const MAX_BULK_PROJECTS = 200;

const bulkProjectSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_BULK_PROJECTS),
  changes: z.object({
    status: z.string().trim().min(1).max(80).optional(),
    currentStage: z.string().trim().min(1).max(120).optional(),
  }).refine((changes) => Object.keys(changes).length > 0, 'At least one change is required'),
});

/**
 * PATCH /api/tenant/:tenantId/projects/bulk
 *
 * Applies one validated status and/or stage to a bounded group of projects.
 * Notification delivery is intentionally not triggered by a bulk state change;
 * a workspace user can review the affected projects and communicate deliberately.
 */
export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantAccess(tenantId, req);
    const parsed = bulkProjectSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid bulk project update', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const ids = [...new Set(parsed.data.ids)];
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (parsed.data.changes.status !== undefined) {
      const status = normalizeProjectStatus(parsed.data.changes.status);
      if (!status) return NextResponse.json({ error: `Invalid project status: ${parsed.data.changes.status}` }, { status: 400 });
      patch.status = status;
    }
    if (parsed.data.changes.currentStage !== undefined) {
      const stage = normalizeProjectStage(parsed.data.changes.currentStage);
      if (!stage) return NextResponse.json({ error: `Invalid project stage: ${parsed.data.changes.currentStage}` }, { status: 400 });
      patch.current_stage = stage;
    }

    const admin = createSupabaseAdminClient();
    const { data: current, error: currentError } = await admin
      .from('projects')
      .select('id, name, status, current_stage')
      .eq('tenant_id', tenantId)
      .in('id', ids);
    if (currentError) throw currentError;
    if ((current || []).length !== ids.length) {
      return NextResponse.json({ error: 'One or more projects were not found in this workspace' }, { status: 404 });
    }

    const { data: updated, error: updateError } = await admin
      .from('projects')
      .update(patch)
      .eq('tenant_id', tenantId)
      .in('id', ids)
      .select('id');
    if (updateError) throw updateError;
    if ((updated || []).length !== ids.length) {
      return NextResponse.json({ error: 'One or more projects could not be updated' }, { status: 409 });
    }

    const now = new Date().toISOString();
    const changes = {
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.current_stage ? { currentStage: patch.current_stage } : {}),
    };
    const [{ error: eventError }, { error: auditError }] = await Promise.all([
      admin.from('business_automation_events').insert({
        tenant_id: tenantId,
        event_type: 'projects_bulk_updated',
        payload: { projectIds: ids, actorUserId: user.id, changes, notifications_dispatched: false },
      }),
      admin.from('audit_logs').insert({
        tenant_id: tenantId,
        user_id: user.id,
        action: 'projects_bulk_updated',
        entity_type: 'project',
        entity_id: null,
        new_values: { project_ids: ids, changes, count: ids.length, notifications_dispatched: false },
        created_at: now,
      }),
    ]);
    if (eventError) console.error('[projects/bulk] automation event could not be recorded:', eventError.message);
    if (auditError) console.error('[projects/bulk] audit event could not be recorded:', auditError.message);

    return NextResponse.json({
      success: true,
      updated: updated?.length || 0,
      changes,
      notificationsDispatched: false,
    });
  } catch (error) {
    return routeErrorResponse(error, 'Projects could not be updated in bulk', req);
  }
}
