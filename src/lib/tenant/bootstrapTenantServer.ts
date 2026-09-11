import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

function sanitizeSlug(input: string, fallback: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
  return base || fallback;
}

async function uniqueSlug(admin: SupabaseClient, slugBase: string): Promise<string> {
  let slug = slugBase;
  let attempt = 0;
  while (attempt < 60) {
    const { data } = await admin.from('tenants').select('id').eq('slug', slug).limit(1).maybeSingle();
    if (!data?.id) return slug;
    attempt += 1;
    slug = `${slugBase.slice(0, Math.max(8, 72 - String(attempt).length - 1))}-${attempt}`;
  }
  return `${slugBase}-${Date.now().toString(36)}`;
}

async function ensureNativeBookingDefaults(admin: SupabaseClient, tenantId: string, slug: string) {
  const publicUrl = `https://alphaclonesystems.com/book/${slug}`;

  const { data: tenant } = await admin
    .from('tenants')
    .select('settings')
    .eq('id', tenantId)
    .maybeSingle();

  const settings = (tenant?.settings || {}) as Record<string, any>;
  const booking = {
    enabled: true,
    provider: 'native',
    publicUrl,
    customDomain: null,
    availability: {
      days: [1, 2, 3, 4, 5],
      hours: { start: '09:00', end: '17:00' },
      timezone: 'UTC',
      ...(settings.booking?.availability || {}),
    },
    ...(settings.booking || {}),
  };

  await admin
    .from('tenants')
    .update({
      booking_slug: slug,
      booking_provider: settings.booking?.provider || 'native',
      settings: {
        ...settings,
        booking,
      },
    })
    .eq('id', tenantId);

  const { data: existingType } = await admin
    .from('booking_types')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();

  if (!existingType?.id) {
    await admin.from('booking_types').insert({
      tenant_id: tenantId,
      name: 'Discovery Call',
      slug: 'discovery-call',
      description: 'A first conversation to understand the work and next steps.',
      duration: 30,
      price: 0,
      currency: 'USD',
      is_active: true,
    });
  }

  const defaultRules = [
    {
      name: 'Client confirmation',
      trigger_event: 'booking.confirmed',
      recipient: 'client',
      offset_minutes: 0,
      timing: 'after_event',
      subject_template: 'Confirmed: {{service_name}} on {{start_time}}',
      body_template: '<p>Hi {{client_name}},</p><p>Your booking for <strong>{{service_name}}</strong> is confirmed.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      metadata: { system_default: true },
    },
    {
      name: 'Host new booking notification',
      trigger_event: 'booking.confirmed',
      recipient: 'host',
      offset_minutes: 0,
      timing: 'after_event',
      subject_template: 'New booking: {{client_name}} - {{service_name}}',
      body_template: '<p><strong>{{client_name}}</strong> ({{client_email}}) booked <strong>{{service_name}}</strong>.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}<p>{{client_notes}}</p>',
      metadata: { system_default: true },
    },
    {
      name: 'Client 24 hour reminder',
      trigger_event: 'booking.confirmed',
      recipient: 'client',
      offset_minutes: 1440,
      timing: 'before_start',
      subject_template: 'Reminder: {{service_name}} tomorrow',
      body_template: '<p>Hi {{client_name}},</p><p>This is a reminder for your upcoming booking with {{tenant_name}}.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      metadata: { system_default: true },
    },
    {
      name: 'Client 1 hour reminder',
      trigger_event: 'booking.confirmed',
      recipient: 'client',
      offset_minutes: 60,
      timing: 'before_start',
      subject_template: 'Starting soon: {{service_name}}',
      body_template: '<p>Hi {{client_name}},</p><p>Your booking starts soon.</p><p><strong>When:</strong> {{start_time}}</p>{{meeting_link_html}}',
      metadata: { system_default: true },
    },
    {
      name: 'Client follow-up',
      trigger_event: 'booking.confirmed',
      recipient: 'client',
      offset_minutes: 60,
      timing: 'after_end',
      subject_template: 'Thanks for meeting with {{tenant_name}}',
      body_template: '<p>Hi {{client_name}},</p><p>Thanks for meeting with {{tenant_name}}. Reply to this email if you have any follow-up questions.</p>',
      metadata: { system_default: true },
    },
  ];

  for (const rule of defaultRules) {
    const { data: existingRule, error: lookupError } = await admin
      .from('booking_automation_rules')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', rule.name)
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.warn('[tenant/bootstrap] Booking automation defaults skipped:', lookupError.message);
      break;
    }
    if (!existingRule?.id) {
      await admin.from('booking_automation_rules').insert({ tenant_id: tenantId, ...rule });
    }
  }
}

export async function ensureUserProfile(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }
) {
  const name =
    String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim();
  const { data: existing } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle();

  if (existing?.id) {
    // Google OAuth / first login: promote placeholder roles so BusinessDashboard mounts.
    // DashboardClientPage only renders BusinessDashboard for tenant_admin (and aliases).
    const role = String(existing.role || '').toLowerCase();
    const needsBusinessRole =
      !role ||
      role === 'visitor' ||
      role === 'client' ||
      role === 'user' ||
      role === 'authenticated';
    await admin
      .from('profiles')
      .update({
        email: user.email,
        name,
        ...(needsBusinessRole ? { role: 'tenant_admin' } : {}),
      })
      .eq('id', user.id);
  } else {
    await admin.from('profiles').insert({
      id: user.id,
      email: user.email,
      name,
      role: 'tenant_admin',
    });
  }
}

export async function bootstrapTenantForUser(
  admin: SupabaseClient,
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  options?: {
    name?: string;
    slug?: string;
    plan?: string;
    referralCode?: string;
    mode?: 'ensure' | 'create';
    idempotencyKey?: string;
  }
): Promise<{ tenantId: string; created: boolean }> {
  await ensureUserProfile(admin, user);

  if (options?.mode !== 'create') {
    const { data: memberships } = await admin
      .from('tenant_users')
      .select('tenant_id')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: false })
      .limit(1);

    const existingId = memberships?.[0]?.tenant_id;
    if (existingId) {
      const { data: existingTenant } = await admin
        .from('tenants')
        .select('slug, booking_slug')
        .eq('id', existingId)
        .maybeSingle();
      if (existingTenant?.slug && !existingTenant?.booking_slug) {
        await ensureNativeBookingDefaults(admin, existingId, String(existingTenant.slug));
      }
      return { tenantId: existingId, created: false };
    }
  }

  const displayName =
    options?.name?.trim() ||
    String(user.user_metadata?.business_name || user.user_metadata?.workspace_name || '').trim() ||
    `${String(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User').trim()}'s Organization`;

  const slugBase = sanitizeSlug(
    options?.slug || displayName,
    `org-${user.id.slice(0, 8)}`
  );
  const slug = await uniqueSlug(admin, slugBase);
  const plan = options?.plan || 'free';

  const { data: tenantId, error: rpcError } = await admin.rpc('create_tenant_idempotent', {
    p_name: displayName,
    p_slug: slug,
    p_admin_user_id: user.id,
    p_plan: plan,
    p_idempotency_key: options?.idempotencyKey || 'initial-workspace-v1',
  });

  if (!rpcError && tenantId) {
    await ensureNativeBookingDefaults(admin, String(tenantId), slug);
    return { tenantId: String(tenantId), created: true };
  }

  throw new Error(`Workspace creation is unavailable: ${rpcError?.message || 'required migration missing'}`);
}
