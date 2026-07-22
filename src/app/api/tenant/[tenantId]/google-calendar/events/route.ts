import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireTenantAccess, routeErrorResponse } from '@/lib/apiAuth';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { getValidGoogleAccessToken } from '@/services/google/googleAccessTokenService';

const eventTime = z.object({ dateTime: z.string().datetime().optional(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), timeZone: z.string().max(100).optional() }).refine((value) => value.dateTime || value.date, 'Event time is required');
const eventSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  description: z.string().max(20_000).optional(),
  start: eventTime,
  end: eventTime,
  colorId: z.string().max(10).optional(),
  extendedProperties: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

async function contextFor(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const { user, admin } = await requireTenantAccess(tenantId, req);
  const accessToken = await getValidGoogleAccessToken({ admin, userId: user.id, tenantId });
  if (!accessToken) return { tenantId, user, accessToken: null };
  return { tenantId, user, accessToken };
}

async function googleResponse(response: Response) {
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || `Google Calendar request failed (${response.status})`);
  return payload;
}

export async function GET(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { accessToken } = await contextFor(req, context);
    if (!accessToken) return NextResponse.json({ connected: false, events: [] });
    const input = new URL(req.url).searchParams;
    const query = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '250' });
    query.set('timeMin', input.get('timeMin') || new Date().toISOString());
    if (input.get('timeMax')) query.set('timeMax', input.get('timeMax')!);
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const payload = await googleResponse(response);
    return NextResponse.json({ connected: true, events: payload.items || [] });
  } catch (error) { return routeErrorResponse(error, 'Google Calendar events could not be loaded', req); }
}

export async function POST(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { accessToken } = await contextFor(req, context);
    if (!accessToken) return NextResponse.json({ error: 'Connect Google Calendar first' }, { status: 409 });
    const parsed = eventSchema.safeParse((await req.json().catch(() => ({}))).event);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid calendar event', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
    return NextResponse.json({ event: await googleResponse(response) });
  } catch (error) { return routeErrorResponse(error, 'Google Calendar event could not be created', req); }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { accessToken } = await contextFor(req, context);
    if (!accessToken) return NextResponse.json({ error: 'Connect Google Calendar first' }, { status: 409 });
    const body = await req.json().catch(() => ({}));
    const eventId = z.string().trim().min(1).max(1000).safeParse(body.eventId);
    const event = eventSchema.safeParse(body.event);
    if (!eventId.success || !event.success) return NextResponse.json({ error: 'Invalid calendar event update' }, { status: 400 });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId.data)}`, { method: 'PATCH', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event.data) });
    return NextResponse.json({ event: await googleResponse(response) });
  } catch (error) { return routeErrorResponse(error, 'Google Calendar event could not be updated', req); }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ tenantId: string }> }) {
  try {
    const { accessToken } = await contextFor(req, context);
    if (!accessToken) return NextResponse.json({ error: 'Connect Google Calendar first' }, { status: 409 });
    const eventId = new URL(req.url).searchParams.get('eventId') || '';
    if (!eventId || eventId.length > 1000) return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
    await googleResponse(response);
    return NextResponse.json({ success: true });
  } catch (error) { return routeErrorResponse(error, 'Google Calendar event could not be deleted', req); }
}
