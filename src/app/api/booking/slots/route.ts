
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addMinutes, parse, isValid } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { microsoftServerService } from '@/services/server/microsoftServerService';
import { getValidGoogleAccessToken } from '@/services/google/googleAccessTokenService';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const BUFFER_MINUTES = 15;

type TimeWindow = { start: string; end: string };

function getSupabaseAdmin() {
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase Service Role credentials');
    }

    return createClient(url, key);
}

async function resolveAvailabilityWindows(
    supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
    tenantId: string,
    dateStr: string,
    settings: Record<string, unknown> | null | undefined,
): Promise<{ windows: TimeWindow[]; timezone: string }> {
    const inputDate = parse(dateStr, 'yyyy-MM-dd', new Date());
    const dayKey = DAY_KEYS[inputDate.getDay()];
    const bookingSettings = (settings?.booking as Record<string, unknown> | undefined)?.availability as
        | { days?: number[]; hours?: { start: string; end: string }; timezone?: string }
        | undefined;

    const { data: scheduleRow } = await supabaseAdmin
        .from('availability_schedules')
        .select('schedule_json, timezone')
        .eq('tenant_id', tenantId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

    if (scheduleRow?.schedule_json && typeof scheduleRow.schedule_json === 'object') {
        const schedule = scheduleRow.schedule_json as Record<string, TimeWindow[]>;
        const daySlots = Array.isArray(schedule[dayKey]) ? schedule[dayKey] : [];
        return {
            windows: daySlots,
            timezone:
                (scheduleRow.timezone as string | null) ||
                bookingSettings?.timezone ||
                'UTC',
        };
    }

    if (bookingSettings?.days && bookingSettings.hours) {
        if (!bookingSettings.days.includes(inputDate.getDay())) {
            return { windows: [], timezone: bookingSettings.timezone || 'UTC' };
        }
        return {
            windows: [{ start: bookingSettings.hours.start, end: bookingSettings.hours.end }],
            timezone: bookingSettings.timezone || 'UTC',
        };
    }

    if (!bookingSettings?.days || bookingSettings.days.includes(inputDate.getDay())) {
        return {
            windows: [{ start: bookingSettings?.hours?.start || '09:00', end: bookingSettings?.hours?.end || '17:00' }],
            timezone: bookingSettings?.timezone || 'UTC',
        };
    }

    return { windows: [], timezone: 'UTC' };
}

function generateSlotsForWindow(
    dateStr: string,
    window: TimeWindow,
    tenantTimeZone: string,
    duration: number,
    blockedRanges: Array<{ start: number; end: number }>,
): Array<{ start: string; end: string; available: boolean }> {
    const slots: Array<{ start: string; end: string; available: boolean }> = [];
    const workStart = fromZonedTime(`${dateStr} ${window.start}`, tenantTimeZone);
    const workEnd = fromZonedTime(`${dateStr} ${window.end}`, tenantTimeZone);
    let currentSlot = new Date(workStart);
    const leadTimeCutoff = addMinutes(new Date(), 60);

    while (addMinutes(currentSlot, duration) <= workEnd) {
        const slotEnd = addMinutes(currentSlot, duration);
        const slotStartTime = currentSlot.getTime();
        const slotEndTime = slotEnd.getTime();

        const isBlocked = blockedRanges.some(
            (range) => slotStartTime < range.end && slotEndTime > range.start,
        );

        if (!isBlocked && currentSlot > leadTimeCutoff) {
            slots.push({
                start: currentSlot.toISOString(),
                end: slotEnd.toISOString(),
                available: true,
            });
        }

        currentSlot = addMinutes(currentSlot, duration + BUFFER_MINUTES);
        const mins = currentSlot.getMinutes();
        const remainder = mins % 15;
        if (remainder !== 0) {
            currentSlot = addMinutes(currentSlot, 15 - remainder);
        }
    }

    return slots;
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const dateStr = searchParams.get('date');
    const duration = Number(searchParams.get('duration') || '30');

    if (!tenantId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: 'Missing tenantId or date' }, { status: 400 });
    }
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) {
        return NextResponse.json({ error: 'Duration must be between 5 and 480 minutes' }, { status: 400 });
    }

    try {
        const supabaseAdmin = getSupabaseAdmin();
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const inputDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        if (!isValid(inputDate)) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        const { windows, timezone: tenantTimeZone } = await resolveAvailabilityWindows(
            supabaseAdmin,
            tenantId,
            dateStr,
            tenant.settings as Record<string, unknown>,
        );

        if (windows.length === 0) {
            return NextResponse.json({ slots: [] });
        }

        const { data: users, error: usersError } = await supabaseAdmin
            .from('tenant_users')
            .select('user_id, role')
            .eq('tenant_id', tenantId);

        if (usersError) {
            return NextResponse.json({ error: 'Failed to fetch host' }, { status: 500 });
        }

        const host = users.find((u: { role: string }) =>
            ['owner', 'admin', 'tenant_admin', 'super_admin'].includes(u.role),
        );
        if (!host) {
            return NextResponse.json({ error: 'No host available' }, { status: 404 });
        }
        const hostId = host.user_id;

        const dayStart = fromZonedTime(`${dateStr} 00:00`, tenantTimeZone);
        const dayEnd = fromZonedTime(`${dateStr} 23:59`, tenantTimeZone);

        const [{ data: events, error: eventsError }, { data: bookings }, { data: videoCalls }] =
            await Promise.all([
                supabaseAdmin
                    .from('calendar_events')
                    .select('start_time, end_time')
                    .eq('user_id', hostId)
                    .or(`and(start_time.lte.${dayEnd.toISOString()},end_time.gte.${dayStart.toISOString()})`),
                supabaseAdmin
                    .from('bookings')
                    .select('start_time, end_time')
                    .eq('tenant_id', tenantId)
                    .neq('status', 'cancelled')
                    .or(`and(start_time.lte.${dayEnd.toISOString()},end_time.gte.${dayStart.toISOString()})`),
                supabaseAdmin
                    .from('video_calls')
                    .select('scheduled_at, duration_limit_minutes')
                    .eq('host_id', hostId)
                    .eq('status', 'scheduled')
                    .or(`and(scheduled_at.lte.${dayEnd.toISOString()},scheduled_at.gte.${dayStart.toISOString()})`),
            ]);

        if (eventsError) {
            return NextResponse.json({ error: 'Failed to check calendar' }, { status: 500 });
        }

        const blockedRanges: Array<{ start: number; end: number }> = [
            ...(events || []).map((event: { start_time: string; end_time: string }) => ({
                start: new Date(event.start_time).getTime(),
                end: new Date(event.end_time).getTime(),
            })),
            ...(bookings || []).map((booking: { start_time: string; end_time: string }) => ({
                start: new Date(booking.start_time).getTime(),
                end: new Date(booking.end_time).getTime(),
            })),
            ...(videoCalls || []).map((call: { scheduled_at: string; duration_limit_minutes?: number }) => {
                const start = new Date(call.scheduled_at).getTime();
                return {
                    start,
                    end: start + (call.duration_limit_minutes || 30) * 60_000,
                };
            }),
        ];

        const googleAccessToken = await getValidGoogleAccessToken({
            admin: supabaseAdmin,
            userId: hostId,
            tenantId,
        });
        if (googleAccessToken) {
            try {
                const googleQuery = new URLSearchParams({
                    timeMin: dayStart.toISOString(),
                    timeMax: dayEnd.toISOString(),
                    singleEvents: 'true',
                    maxResults: '250',
                });
                const response = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${googleQuery}`,
                    { headers: { Authorization: `Bearer ${googleAccessToken}` } },
                );
                const data = await response.json().catch(() => ({}));
                if (response.ok) {
                    blockedRanges.push(
                        ...(data.items || []).map((item: { start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }) => ({
                            start: new Date(item.start.dateTime || item.start.date || '').getTime(),
                            end: new Date(item.end.dateTime || item.end.date || '').getTime(),
                        })),
                    );
                } else {
                    console.warn('[BookingAPI] Google Calendar skipped:', data.error?.message || response.status);
                }
            } catch (err) {
                console.warn('[BookingAPI] Google Calendar fetch failed (non-fatal):', err);
            }
        }

        const microsoftConnection = await microsoftServerService.getConnection(hostId).catch(() => null);
        if (microsoftConnection) {
            try {
                const microsoftEvents = await microsoftServerService.getCalendarBusyWindows(
                    hostId,
                    dayStart.toISOString(),
                    dayEnd.toISOString(),
                );
                blockedRanges.push(...microsoftEvents.map((event) => ({ start: event.start, end: event.end })));
            } catch (err) {
                console.warn('[BookingAPI] Microsoft Calendar fetch failed (non-fatal):', err);
            }
        }

        const slots = windows.flatMap((window) =>
            generateSlotsForWindow(dateStr, window, tenantTimeZone, duration, blockedRanges),
        );

        return NextResponse.json({ slots });
    } catch (err) {
        console.error('[BookingAPI] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
