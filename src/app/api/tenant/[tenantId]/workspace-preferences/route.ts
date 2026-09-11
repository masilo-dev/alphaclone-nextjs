import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { loadWorkspacePreferences, patchWorkspacePreferences } from '@/lib/workspacePreferencesServer';

const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];

const patchSchema = z.object({
  periodClose: z
    .object({
      periodId: z.string().uuid(),
      checked: z.record(z.string(), z.boolean()),
    })
    .optional(),
  executiveKpiGoals: z
    .object({
      revenue: z.number().min(0).max(10_000_000),
      clients: z.number().int().min(0).max(10_000),
      projects: z.number().int().min(0).max(10_000),
    })
    .optional(),
  dashboardHomeLayout: z.enum(['operating_system', 'attention_first']).optional(),
});

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    await requireTenantAccess(tenantId, req);
    const admin = createSupabaseAdminClient();
    const preferences = await loadWorkspacePreferences(admin, tenantId);
    return NextResponse.json(preferences);
  } catch (error) {
    return routeErrorResponse(error, 'Workspace preferences could not be loaded', req);
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles, req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid workspace preferences', fields: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    if (!parsed.data.periodClose && !parsed.data.executiveKpiGoals && !parsed.data.dashboardHomeLayout) {
      return NextResponse.json({ error: 'No preferences to update' }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const preferences = await patchWorkspacePreferences(admin, tenantId, user.id, parsed.data);

    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'workspace_preferences_updated',
      payload: {
        actorUserId: user.id,
        changed: Object.keys(parsed.data),
      },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    return routeErrorResponse(error, 'Workspace preferences could not be saved', req);
  }
}
