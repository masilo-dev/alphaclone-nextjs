import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { requireTenantRole } from '@/lib/apiAuth';
import { z } from 'zod';
import {
  defaultTenantNotificationPolicy,
  mergeTenantNotificationPolicy,
  type CategoryChannelPolicy,
} from '@/lib/notifications/tenantNotificationPolicy';
import { NOTIFICATION_CATEGORIES } from '@/lib/events/businessEventTaxonomy';

const ChannelSchema = z.object({
  in_app: z.boolean().optional(),
  email_owner: z.boolean().optional(),
  email_assignee: z.boolean().optional(),
  email_client: z.boolean().optional(),
  daily_digest: z.boolean().optional(),
  urgent_only: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

const PrefsSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  in_app_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  event_types: z.record(z.string(), z.boolean()).optional(),
  categories: z.record(z.string(), ChannelSchema).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const { user } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'member']);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('notification_preferences')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('email_preferences')
    .eq('id', user.id)
    .maybeSingle();

  const { data: policyRow } = await admin
    .from('tenant_notification_policies')
    .select('categories')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  return NextResponse.json({
    notification_preferences: data,
    email_preferences: profile?.email_preferences || {},
    tenant_policy: mergeTenantNotificationPolicy(policyRow?.categories as Record<string, Partial<CategoryChannelPolicy>> | null),
    categories: NOTIFICATION_CATEGORIES,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const { user, membership } = await requireTenantRole(tenantId, ['owner', 'admin', 'tenant_admin', 'member']);
  const body = PrefsSchema.parse(await req.json());

  const admin = createSupabaseAdminClient();
  const { categories, ...userPrefs } = body;
  const row = {
    tenant_id: tenantId,
    user_id: user.id,
    ...userPrefs,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await admin
    .from('notification_preferences')
    .upsert(row, { onConflict: 'tenant_id,user_id' })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let tenantPolicy = defaultTenantNotificationPolicy();
  if (categories && ['owner', 'admin', 'tenant_admin', 'super_admin'].includes(String(membership.role))) {
    const { data: existing } = await admin
      .from('tenant_notification_policies')
      .select('categories')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    tenantPolicy = mergeTenantNotificationPolicy({
      ...(existing?.categories || {}),
      ...categories,
    } as Record<string, Partial<CategoryChannelPolicy>>);
    const { error: policyError } = await admin.from('tenant_notification_policies').upsert({
      tenant_id: tenantId,
      categories: tenantPolicy,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });
    if (policyError && !/schema cache|column/i.test(policyError.message)) {
      return NextResponse.json({ error: policyError.message }, { status: 500 });
    }
  } else {
    const { data: policyRow } = await admin
      .from('tenant_notification_policies')
      .select('categories')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    tenantPolicy = mergeTenantNotificationPolicy(policyRow?.categories as Record<string, Partial<CategoryChannelPolicy>> | null);
  }

  if (body.email_enabled !== undefined || body.event_types) {
    const { data: profile } = await admin
      .from('profiles')
      .select('email_preferences')
      .eq('id', user.id)
      .maybeSingle();

    const merged = {
      ...(profile?.email_preferences || {}),
      email_notifications: body.email_enabled ?? (profile?.email_preferences as any)?.email_notifications,
      activity_digest: body.event_types?.summaries ?? (profile?.email_preferences as any)?.activity_digest,
      morning_briefing: body.event_types?.morning_briefing ?? (profile?.email_preferences as any)?.morning_briefing,
    };

    await admin.from('profiles').update({ email_preferences: merged }).eq('id', user.id);
  }

  return NextResponse.json({ notification_preferences: data, tenant_policy: tenantPolicy });
}
