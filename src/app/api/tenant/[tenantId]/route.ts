import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';

type Context = { params: Promise<{ tenantId: string }> };
const adminRoles = ['owner', 'admin', 'tenant_admin', 'super_admin'];
const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(3).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
  logo_url: z.string().url().max(2000).nullable().optional(),
  legal_name: z.string().trim().max(300).nullable().optional(),
  tax_id: z.string().trim().max(100).nullable().optional(),
  business_address: z.string().trim().max(1000).nullable().optional(),
  brand_color_primary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  brand_color_secondary: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

export async function PATCH(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, adminRoles);
    const updates = updateSchema.parse(await req.json());
    const admin = createSupabaseAdminClient();
    const { data: current, error: loadError } = await admin.from('tenants').select('settings').eq('id', tenantId).single();
    if (loadError) throw loadError;
    const payload = {
      ...updates,
      ...(updates.settings ? { settings: { ...(current.settings || {}), ...updates.settings } } : {}),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await admin.from('tenants').update(payload).eq('id', tenantId).select('*').single();
    if (error) throw error;
    await admin.from('business_automation_events').insert({
      tenant_id: tenantId,
      event_type: 'tenant_settings_updated',
      payload: { actorUserId: user.id, changedFields: Object.keys(updates) },
    });
    return NextResponse.json({ success: true, tenant: data });
  } catch (error) {
    return routeErrorResponse(error, 'Workspace settings could not be updated', req);
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  try {
    const { tenantId } = await context.params;
    const { user } = await requireTenantRole(tenantId, ['owner', 'tenant_admin', 'super_admin']);
    const admin = createSupabaseAdminClient();
    const now = new Date().toISOString();
    const { error } = await admin.from('tenants').update({ deletion_pending_at: now, subscription_status: 'suspended', updated_at: now }).eq('id', tenantId);
    if (error) throw error;
    await admin.from('business_automation_events').insert({ tenant_id: tenantId, event_type: 'tenant_deletion_scheduled', payload: { actorUserId: user.id, scheduledAt: now } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return routeErrorResponse(error, 'Workspace deletion could not be scheduled', req);
  }
}

