import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ENV } from '@/config/env';

function getSupabaseAdmin() {
    return createClient(
        ENV.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        ENV.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
    );
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { bookingId, status, newStartTime, newEndTime, reason, tenantId } = body;

        if (!bookingId) {
            return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();

        // 1. Fetch existing booking
        const { data: existing, error: fetchErr } = await supabase
            .from('bookings')
            .select('*')
            .eq('id', bookingId)
            .single();

        if (fetchErr || !existing) {
            return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
        }

        const effectiveTenantId = tenantId || existing.tenant_id;
        const currentMeta = existing.metadata || {};

        const updates: Record<string, any> = {
            updated_at: new Date().toISOString()
        };

        if (status) {
            const validStatuses = ['scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show'];
            if (!validStatuses.includes(status)) {
                return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
            }
            updates.status = status;
        }

        // Reschedule logic: update timing, preserve history, do not duplicate record
        if (newStartTime && newEndTime) {
            const rescheduleHistory = Array.isArray(currentMeta.reschedule_history)
                ? currentMeta.reschedule_history
                : [];

            rescheduleHistory.push({
                previous_start: existing.start_time,
                previous_end: existing.end_time,
                new_start: newStartTime,
                new_end: newEndTime,
                rescheduled_at: new Date().toISOString(),
                reason: reason || 'User requested reschedule'
            });

            updates.start_time = newStartTime;
            updates.end_time = newEndTime;
            updates.status = status || 'rescheduled';
            updates.metadata = {
                ...currentMeta,
                reschedule_history: rescheduleHistory,
                last_rescheduled_at: new Date().toISOString()
            };
        } else if (reason || status) {
            updates.metadata = {
                ...currentMeta,
                status_notes: reason || currentMeta.status_notes
            };
        }

        // 2. Update existing booking record
        const { data: updatedBooking, error: updateErr } = await supabase
            .from('bookings')
            .update(updates)
            .eq('id', bookingId)
            .select('*')
            .single();

        if (updateErr) {
            console.error('[BookingStatusAPI] Error updating booking:', updateErr);
            return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
        }

        // 3. Update associated calendar event if exists
        if (existing.video_call_id || existing.id) {
            const calUpdates: Record<string, any> = {};
            if (newStartTime) calUpdates.start_time = newStartTime;
            if (newEndTime) calUpdates.end_time = newEndTime;

            if (Object.keys(calUpdates).length > 0) {
                await supabase
                    .from('calendar_events')
                    .update(calUpdates)
                    .or(`video_room_id.eq.${existing.video_call_id},id.eq.${existing.id}`);
            }
        }

        // 4. Create Notification
        try {
            const title = updates.status === 'rescheduled' ? 'Booking Rescheduled' : `Booking ${updates.status || 'Updated'}`;
            const message = `Booking with ${existing.client_name || 'Client'} set to ${updates.status || 'updated'}.`;

            await supabase.from('notifications').insert({
                tenant_id: effectiveTenantId,
                title,
                message,
                type: 'booking',
                read: false,
                link: `/dashboard/business/calendar`,
                metadata: { booking_id: bookingId }
            });
        } catch (notifErr) {
            console.error('[BookingStatusAPI] Notification error:', notifErr);
        }

        return NextResponse.json({ success: true, booking: updatedBooking });
    } catch (err: any) {
        console.error('[BookingStatusAPI] Exception:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
