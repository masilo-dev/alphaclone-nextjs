import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAuthenticatedUser, requireTenantRole, routeErrorResponse } from '@/lib/apiAuth';
import { ENV } from '@/config/env';

function getSupabaseAdmin() {
    return createClient(
        ENV.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        ENV.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
    );
}

export async function POST(req: NextRequest) {
    try {
        await requireAuthenticatedUser(req);
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

        if (tenantId && tenantId !== existing.tenant_id) return NextResponse.json({ error: 'Booking does not belong to this workspace' }, { status: 403 });
        await requireTenantRole(existing.tenant_id, ['owner', 'admin', 'tenant_admin', 'super_admin'], req);
        const effectiveTenantId = existing.tenant_id;
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
            .eq('tenant_id', effectiveTenantId).eq('id', bookingId)
            .select('*')
            .single();

        if (updateErr) {
            console.error('[BookingStatusAPI] Error updating booking:', updateErr);
            return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 });
        }

        if (updates.status === 'cancelled' || updates.status === 'no_show') {
            const { error } = await supabase.from('booking_automation_jobs').update({ status: 'cancelled' })
                .eq('tenant_id', effectiveTenantId).eq('booking_id', bookingId).eq('status', 'pending');
            if (error) throw error;
        }

        // Update the same tenant-owned calendar/video records, retaining provider metadata.
        let eventQuery = supabase.from('calendar_events').select('id,metadata').eq('tenant_id', effectiveTenantId);
        if (existing.calendar_event_id) eventQuery = eventQuery.eq('id', existing.calendar_event_id);
        else if (existing.video_call_id) eventQuery = eventQuery.eq('video_room_id', existing.video_call_id);
        else eventQuery = eventQuery.eq('id', existing.id);
        const { data: events, error: eventError } = await eventQuery;
        if (eventError) throw eventError;
        for (const event of events || []) {
            const { error } = await supabase.from('calendar_events').update({
                ...(newStartTime ? { start_time: newStartTime } : {}),
                ...(newEndTime ? { end_time: newEndTime } : {}),
                metadata: { ...event.metadata, status: updates.status || existing.status },
            }).eq('tenant_id', effectiveTenantId).eq('id', event.id);
            if (error) throw error;
        }
        if (existing.video_call_id) {
            const { error } = await supabase.from('video_calls').update({
                ...(newStartTime ? { scheduled_at: newStartTime } : {}),
                ...(updates.status === 'cancelled' ? { status: 'cancelled' } : {}),
            }).eq('tenant_id', effectiveTenantId).eq('id', existing.video_call_id);
            if (error) throw error;
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
        return routeErrorResponse(err, 'Booking could not be updated', req);
    }
}
