
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addMinutes, parse, isValid } from 'date-fns';
import { toZonedTime, fromZonedTime, format as formatZoned } from 'date-fns-tz';


// Helper to get Supabase Admin Client
function getSupabaseAdmin() {
    const url = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

    if (!url || !key) {
        throw new Error('Missing Supabase Service Role credentials');
    }

    return createClient(url, key);
}


const BUFFER_MINUTES = 15;

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenantId');
    const dateStr = searchParams.get('date');
    const duration = parseInt(searchParams.get('duration') || '30');

    if (!tenantId || !dateStr) {
        return NextResponse.json({ error: 'Missing tenantId or date' }, { status: 400 });
    }

    try {
        console.log(`[BookingAPI] Fetching slots for tenant ${tenantId} on ${dateStr}`);

        // 1. Get Tenant Settings (for availability hours)
        const supabaseAdmin = getSupabaseAdmin();
        const { data: tenant, error: tenantError } = await supabaseAdmin
            .from('tenants')
            .select('settings')
            .eq('id', tenantId)
            .single();

        if (tenantError || !tenant) {
            console.error('[BookingAPI] Tenant fetch error:', tenantError);
            return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
        }

        const settings = tenant.settings as any;
        let availability = settings?.booking?.availability;

        // Smart Default
        if (!availability || !availability.days || !availability.hours) {
            availability = {
                days: [1, 2, 3, 4, 5], // Mon-Fri
                hours: { start: '09:00', end: '17:00' },
                timezone: 'UTC'
            };
        }

        const tenantTimeZone = availability.timezone || 'UTC';

        // 2. Parse Date & Check Availability (in Tenant's Timezone)
        // receiving dateStr as "2024-01-29"
        // We need to create a date object that represents the start of that day in the Tenant's timezone.

        // We parse the input date string as a local date (00:00:00 on that day) without timezone
        const inputDate = parse(dateStr, 'yyyy-MM-dd', new Date());

        if (!isValid(inputDate)) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        if (!availability.days.includes(inputDate.getDay())) {
            return NextResponse.json({ slots: [] }); // Closed today (based on day index)
        }

        // 3. Find Host (Admin/Owner) - Bypass RLS
        const { data: users, error: usersError } = await supabaseAdmin
            .from('tenant_users')
            .select('user_id, role')
            .eq('tenant_id', tenantId);

        if (usersError) {
            console.error('[BookingAPI] Tenant users fetch error:', usersError);
            return NextResponse.json({ error: 'Failed to fetch host' }, { status: 500 });
        }

        const host = users.find((u: any) => u.role === 'owner' || u.role === 'admin');
        if (!host) {
            return NextResponse.json({ error: 'No host available' }, { status: 404 });
        }
        const hostId = host.user_id;

        // 4. Calculate Work Hours in UTC
        const startHour = parseInt(availability.hours.start.split(':')[0]);
        const startMin = parseInt(availability.hours.start.split(':')[1]);
        const endHour = parseInt(availability.hours.end.split(':')[0]);
        const endMin = parseInt(availability.hours.end.split(':')[1]);

        // Construct the start and end times in the Tenant's timezone
        // We create a string "YYYY-MM-DD HH:mm" and then parse it with fromZonedTime

        const startStr = `${dateStr} ${availability.hours.start}`; // "2024-01-29 09:00"
        const endStr = `${dateStr} ${availability.hours.end}`;     // "2024-01-29 17:00"

        // Convert strict string to Date object in the specific timezone, then get UTC equivalent
        // Note: fromZonedTime takes a date/string and a timezone, and returns a Date object (which is effectively UTC timestamp)
        // But simply, we can use string construction.

        // Let's manually construct dates for current day in the timezone
        // We need to be careful. Ideally we iterate in the timezone.

        // Correct approach:
        // define start and end as Date objects representing the instant in time.
        // We use a helper utility or string concatenatation + fromZonedTime

        // Using string parsing with date-fns-tz is robust
        const workStart = fromZonedTime(`${dateStr} ${availability.hours.start}`, tenantTimeZone);
        const workEnd = fromZonedTime(`${dateStr} ${availability.hours.end}`, tenantTimeZone);

        // Fetch events overlapping this UTC window
        const { data: events, error: eventsError } = await supabaseAdmin
            .from('calendar_events')
            .select('start_time, end_time')
            .eq('user_id', hostId)
            .or(`and(start_time.lte.${workEnd.toISOString()},end_time.gte.${workStart.toISOString()})`);

        if (eventsError) {
            console.error('[BookingAPI] Events fetch error:', eventsError);
            return NextResponse.json({ error: 'Failed to check calendar' }, { status: 500 });
        }

        // 5. Calculate Slots
        const slots = [];
        let currentSlot = new Date(workStart); // Start at 09:00 Tenant Time (UTC equivalent)

        while (addMinutes(currentSlot, duration) <= workEnd) {
            const slotEnd = addMinutes(currentSlot, duration);

            // Overlap Check (compare UTC timestamps)
            const isBlocked = (events || []).some((e: any) => {
                const eventStart = new Date(e.start_time).getTime();
                const eventEnd = new Date(e.end_time).getTime();
                const slotStartTime = currentSlot.getTime();
                const slotEndTime = slotEnd.getTime();
                return (slotStartTime < eventEnd && slotEndTime > eventStart);
            });

            // Lead time check (1 hour from NOW)
            const leadTimeCutoff = addMinutes(new Date(), 60);

            if (!isBlocked && currentSlot > leadTimeCutoff) {
                // Return start/end in ISO (UTC), frontend handles local display
                // OR we can return it, frontend will convert to user's local time (visitor)
                slots.push({
                    start: currentSlot.toISOString(),
                    end: slotEnd.toISOString(),
                    available: true
                });
            }

            currentSlot = addMinutes(currentSlot, duration + BUFFER_MINUTES);

            // Align to next 15-minute block if needed? 
            // Better to just follow duration + buffer strictly or align?
            // Original code aligned, let's keep alignment but be careful with timezone shifts.
            // Alignment should be based on minutes from hour

            // NOTE: Alignment logic might be tricky with timezone offsets if they are not hour-aligned (e.g. India)
            // But simple minute alignment usually works on the Date object directly.

            const mins = currentSlot.getMinutes();
            const remainder = mins % 15;
            if (remainder !== 0) {
                currentSlot = addMinutes(currentSlot, 15 - remainder);
            }
        }

        return NextResponse.json({ slots });

    } catch (err) {
        console.error('[BookingAPI] Unexpected error:', err);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
