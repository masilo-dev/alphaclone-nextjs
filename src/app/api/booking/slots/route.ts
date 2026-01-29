
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { addMinutes, parse, isValid } from 'date-fns';

// Init Supabase Admin Client (Service Role)
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY!
);

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
                hours: { start: '09:00', end: '17:00' }
            };
        }

        // 2. Parse Date & Check Availability
        const targetDate = parse(dateStr, 'yyyy-MM-dd', new Date());
        if (!isValid(targetDate)) {
            return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
        }

        if (!availability.days.includes(targetDate.getDay())) {
            return NextResponse.json({ slots: [] }); // Closed today
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

        // 4. Fetch Calendar Events for Host - Bypass RLS
        const startHour = parseInt(availability.hours.start.split(':')[0]);
        const startMin = parseInt(availability.hours.start.split(':')[1]);
        const endHour = parseInt(availability.hours.end.split(':')[0]);
        const endMin = parseInt(availability.hours.end.split(':')[1]);

        const workStart = new Date(targetDate);
        workStart.setHours(startHour, startMin, 0, 0);

        const workEnd = new Date(targetDate);
        workEnd.setHours(endHour, endMin, 0, 0);

        // Fetch events overlapping the work day
        const { data: events, error: eventsError } = await supabaseAdmin
            .from('calendar_events')
            .select('start_time, end_time')
            .eq('user_id', hostId) // We only check the primary host for now.
            // Ideally we check tenant_id too, but hostId is stronger.
            .or(`and(start_time.lte.${workEnd.toISOString()},end_time.gte.${workStart.toISOString()})`);

        if (eventsError) {
            console.error('[BookingAPI] Events fetch error:', eventsError);
            return NextResponse.json({ error: 'Failed to check calendar' }, { status: 500 });
        }

        // 5. Calculate Slots
        const slots = [];
        let currentSlot = new Date(workStart);

        while (addMinutes(currentSlot, duration) <= workEnd) {
            const slotEnd = addMinutes(currentSlot, duration);

            // Overlap Check
            const isBlocked = (events || []).some((e: any) => {
                const eventStart = new Date(e.start_time).getTime();
                const eventEnd = new Date(e.end_time).getTime();
                const slotStartTime = currentSlot.getTime();
                const slotEndTime = slotEnd.getTime();
                return (slotStartTime < eventEnd && slotEndTime > eventStart);
            });

            // Lead time check (1 hour)
            const leadTimeCutoff = addMinutes(new Date(), 60);

            if (!isBlocked && currentSlot > leadTimeCutoff) {
                slots.push({
                    start: currentSlot.toISOString(),
                    end: slotEnd.toISOString(),
                    available: true
                });
            }

            currentSlot = addMinutes(currentSlot, duration + BUFFER_MINUTES);
            // Align to next 15-minute block
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
