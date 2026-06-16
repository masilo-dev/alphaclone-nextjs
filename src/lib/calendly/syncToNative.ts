import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { ENV } from '@/config/env';

export type CalendlyTenantConfig = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  calendlyUserUri: string;
  eventUrl?: string;
  webhookSubscriptionUri?: string;
};

type UpsertInput = {
  tenantId: string;
  hostUserId: string;
  eventUri: string;
  inviteeUri?: string;
  eventName: string;
  inviteeName?: string;
  inviteeEmail?: string;
  inviteePhone?: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  status?: 'confirmed' | 'canceled' | 'missed';
  notes?: string | null;
  extraMetadata?: Record<string, unknown>;
};

export async function refreshCalendlyToken(
  tenantId: string,
  config: CalendlyTenantConfig
): Promise<CalendlyTenantConfig> {
  if (!config.refreshToken || !config.expiresAt) return config;
  if (new Date(config.expiresAt).getTime() >= Date.now() + 5 * 60_000) return config;

  const clientId = ENV.VITE_CALENDLY_CLIENT_ID || '';
  const clientSecret = ENV.CALENDLY_CLIENT_SECRET || '';
  const tokenRes = await fetch('https://auth.calendly.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // OAuth 2.1 / Calendly refresh token rotation requires Basic Auth header
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error('Calendly token expired and refresh failed. Please reconnect.');
  }

  const tokens = await tokenRes.json();
  const updated: CalendlyTenantConfig = {
    ...config,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || config.refreshToken,
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };

  const supabase = createSupabaseAdminClient();
  const { data: tenant } = await supabase.from('tenants').select('settings').eq('id', tenantId).single();
  if (tenant) {
    const settings = { ...(tenant.settings || {}), calendly: { ...(tenant.settings?.calendly || {}), ...updated } };
    await supabase.from('tenants').update({ settings }).eq('id', tenantId);
  }

  return updated;
}

export async function resolveTenantHostUser(tenantId: string): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data: owner } = await supabase
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();
  if (owner?.user_id) return owner.user_id;

  const { data: anyUser } = await supabase
    .from('tenant_users')
    .select('user_id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  return anyUser?.user_id || null;
}

export function resolveCalendlyUserUriFromPayload(payload: Record<string, unknown>): string | null {
  const scheduled = payload.scheduled_event as Record<string, unknown> | undefined;
  const memberships = scheduled?.event_memberships as Array<{ user?: string }> | undefined;
  if (memberships?.[0]?.user) return memberships[0].user;
  if (typeof payload.event_type_owner_uri === 'string') return payload.event_type_owner_uri;
  if (typeof payload.owner_uri === 'string') return payload.owner_uri;
  return null;
}

export async function findTenantByCalendlyUserUri(userUri: string): Promise<{ tenantId: string; config: CalendlyTenantConfig } | null> {
  const supabase = createSupabaseAdminClient();
  const { data: tenants } = await supabase.from('tenants').select('id, settings');
  for (const t of tenants || []) {
    const cal = t.settings?.calendly;
    if (cal?.calendlyUserUri === userUri && cal?.accessToken) {
      return { tenantId: t.id, config: cal as CalendlyTenantConfig };
    }
  }
  return null;
}

export async function upsertCalendlyEvent(input: UpsertInput): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const status = input.status || 'confirmed';
  const title = input.inviteeName
    ? `Calendly: ${input.inviteeName}`
    : `Calendly: ${input.eventName}`;

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, metadata')
    .eq('tenant_id', input.tenantId)
    .filter('metadata->>calendly_event_uri', 'eq', input.eventUri)
    .maybeSingle();

  let bookingId = existingBooking?.id as string | undefined;

  if (status === 'canceled' || status === 'missed') {
    if (bookingId) {
      await supabase.from('bookings').update({ status }).eq('id', bookingId);
    }
    await supabase
      .from('video_calls')
      .update({ status: status === 'canceled' ? 'cancelled' : 'missed' })
      .eq('tenant_id', input.tenantId)
      .filter('metadata->>calendly_event_uri', 'eq', input.eventUri);
    await supabase
      .from('calendar_events')
      .update({ metadata: { calendly_status: status } })
      .eq('tenant_id', input.tenantId)
      .filter('metadata->>calendly_event_uri', 'eq', input.eventUri);
    return;
  }

  const bookingPayload = {
    tenant_id: input.tenantId,
    client_name: input.inviteeName || 'Calendly Guest',
    client_email: input.inviteeEmail || null,
    client_phone: input.inviteePhone || null,
    client_notes: input.notes,
    start_time: input.startTime,
    end_time: input.endTime,
    status: 'confirmed' as const,
    metadata: {
      calendly_event_uri: input.eventUri,
      calendly_invitee_uri: input.inviteeUri || null,
      ...(input.extraMetadata || {}),
    },
  };

  if (bookingId) {
    await supabase.from('bookings').update(bookingPayload).eq('id', bookingId);
  } else {
    const { data: created } = await supabase.from('bookings').insert(bookingPayload).select('id').single();
    bookingId = created?.id;
  }

  const { data: existingCall } = await supabase
    .from('video_calls')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .filter('metadata->>calendly_event_uri', 'eq', input.eventUri)
    .maybeSingle();

  const callPayload = {
    tenant_id: input.tenantId,
    host_id: input.hostUserId,
    title,
    status: 'scheduled',
    scheduled_at: input.startTime,
    daily_room_url: input.location || null,
    description: input.notes,
    metadata: {
      booking_id: bookingId,
      calendly_event_uri: input.eventUri,
      calendly_invitee_uri: input.inviteeUri || null,
    },
  };

  if (existingCall?.id) {
    await supabase.from('video_calls').update(callPayload).eq('id', existingCall.id);
  } else {
    await supabase.from('video_calls').insert(callPayload);
  }

  const { data: existingCal } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .filter('metadata->>calendly_event_uri', 'eq', input.eventUri)
    .maybeSingle();

  const calPayload = {
    tenant_id: input.tenantId,
    user_id: input.hostUserId,
    title,
    description: input.notes || `Calendly meeting with ${input.inviteeName || 'Guest'}`,
    start_time: input.startTime,
    end_time: input.endTime,
    type: 'meeting',
    location: input.location || 'Calendly Video Link',
    is_all_day: false,
    reminder_minutes: 15,
    metadata: {
      booking_id: bookingId,
      calendly_event_uri: input.eventUri,
      calendly_invitee_uri: input.inviteeUri || null,
      calendly_status: 'active',
    },
  };

  if (existingCal?.id) {
    await supabase.from('calendar_events').update(calPayload).eq('id', existingCal.id);
  } else {
    await supabase.from('calendar_events').insert(calPayload);
  }
}

export async function registerCalendlyWebhook(
  accessToken: string,
  calendlyUserUri: string,
  callbackUrl: string
): Promise<string | null> {
  const res = await fetch('https://api.calendly.com/webhook_subscriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: callbackUrl,
      events: [
        'invitee.created',
        'invitee.canceled',
        'invitee.no_show.created',
        // New events: meeting recap (Oct 2025), contacts (May 2026), routing forms
        'meeting_recap.created',
        'routing_form_submission.created',
        'contact.created',
        'contact.updated',
        'contact.deleted',
      ],
      user: calendlyUserUri,
      scope: 'user',
    }),
  });

  if (!res.ok) {
    console.error('[Calendly] Webhook registration failed:', await res.text());
    return null;
  }

  const data = await res.json();
  return data.resource?.uri || null;
}

export async function pullAndSyncCalendlyEvents(
  tenantId: string,
  userId: string,
  config: CalendlyTenantConfig
): Promise<{ syncedCount: number; totalActive: number }> {
  const refreshed = await refreshCalendlyToken(tenantId, config);
  const hostUserId = (await resolveTenantHostUser(tenantId)) || userId;
  const minStartTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let allEvents: Array<Record<string, unknown>> = [];
  let nextPage = `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(refreshed.calendlyUserUri)}&min_start_time=${encodeURIComponent(minStartTime)}&status=active`;
  let pages = 0;

  while (nextPage && pages < 10) {
    const response = await fetch(nextPage, {
      headers: { Authorization: `Bearer ${refreshed.accessToken}`, 'Content-Type': 'application/json' },
    });
    if (!response.ok) break;
    const data = await response.json();
    allEvents = [...allEvents, ...(data.collection || [])];
    nextPage = data.pagination?.next_page;
    pages++;
  }

  let syncedCount = 0;
  for (const event of allEvents) {
    const eventUri = String(event.uri || '');
    if (!eventUri) continue;

    let inviteeName: string | undefined;
    let inviteeEmail: string | undefined;
    let inviteeUri: string | undefined;
    const eventUuid = eventUri.split('/').pop();

    try {
      const inviteesRes = await fetch(`https://api.calendly.com/scheduled_events/${eventUuid}/invitees`, {
        headers: { Authorization: `Bearer ${refreshed.accessToken}` },
      });
      if (inviteesRes.ok) {
        const inviteeData = await inviteesRes.json();
        const invitee = inviteeData.collection?.[0];
        if (invitee) {
          inviteeName = invitee.name;
          inviteeEmail = invitee.email;
          inviteeUri = invitee.uri;
        }
      }
    } catch {
      /* non-fatal */
    }

    const location = (event.location as { location?: string } | undefined)?.location || null;
    await upsertCalendlyEvent({
      tenantId,
      hostUserId,
      eventUri,
      inviteeUri,
      eventName: String(event.name || 'Meeting'),
      inviteeName,
      inviteeEmail,
      startTime: String(event.start_time),
      endTime: String(event.end_time),
      location,
      notes: inviteeName ? `Calendly meeting with ${inviteeName}` : String(event.name || ''),
    });
    syncedCount++;
  }

  return { syncedCount, totalActive: allEvents.length };
}

// ── Calendly Contacts API (May 2026) ──────────────────────────────────────────

export interface CalendlyContact {
  uri: string;
  name: string;
  email: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Fetch all Calendly contacts for the authenticated user
 */
export async function getCalendlyContacts(
  tenantId: string,
  config: CalendlyTenantConfig
): Promise<CalendlyContact[]> {
  const refreshed = await refreshCalendlyToken(tenantId, config);
  const contacts: CalendlyContact[] = [];
  let nextPage: string | null =
    `https://api.calendly.com/contacts?user=${encodeURIComponent(refreshed.calendlyUserUri)}&count=100`;
  let pages = 0;

  while (nextPage && pages < 20) {
    const res: Response = await fetch(nextPage, {
      headers: { Authorization: `Bearer ${refreshed.accessToken}` },
    });
    if (!res.ok) break;
    const data: { collection?: CalendlyContact[]; pagination?: { next_page?: string } } = await res.json();
    contacts.push(...(data.collection || []));
    nextPage = data.pagination?.next_page || null;
    pages++;
  }

  return contacts;
}

/**
 * Create or update a Calendly contact
 */
export async function upsertCalendlyContact(
  tenantId: string,
  config: CalendlyTenantConfig,
  contact: { name: string; email: string }
): Promise<CalendlyContact | null> {
  const refreshed = await refreshCalendlyToken(tenantId, config);
  const res = await fetch('https://api.calendly.com/contacts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${refreshed.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user: refreshed.calendlyUserUri,
      name: contact.name,
      email: contact.email,
    }),
  });

  if (!res.ok) {
    console.warn('[Calendly Contacts] upsert failed:', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  return data.resource || null;
}

/**
 * Delete a Calendly contact by its URI
 */
export async function deleteCalendlyContact(
  tenantId: string,
  config: CalendlyTenantConfig,
  contactUri: string
): Promise<boolean> {
  const refreshed = await refreshCalendlyToken(tenantId, config);
  const uuid = contactUri.split('/').pop();
  const res = await fetch(`https://api.calendly.com/contacts/${uuid}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${refreshed.accessToken}` },
  });
  return res.ok || res.status === 404;
}

/**
 * Sync CRM clients into Calendly Contacts — bidirectional bridge.
 * Reads all business_clients for the tenant and pushes them to Calendly.
 */
export async function syncCRMClientsToCalendlyContacts(
  tenantId: string,
  config: CalendlyTenantConfig
): Promise<{ synced: number; failed: number }> {
  const supabase = createSupabaseAdminClient();
  const { data: clients } = await supabase
    .from('business_clients')
    .select('id, name, email')
    .eq('tenant_id', tenantId)
    .not('email', 'is', null);

  if (!clients || clients.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const client of clients) {
    if (!client.email) continue;
    const result = await upsertCalendlyContact(tenantId, config, {
      name: client.name,
      email: client.email,
    });
    if (result) {
      // Store the Calendly contact URI back on the client record
      await supabase
        .from('business_clients')
        .update({ custom_fields: { calendly_contact_uri: result.uri } })
        .eq('id', client.id);
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}
