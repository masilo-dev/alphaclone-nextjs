import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { calendarService } from './calendarService';
import { dailyService } from './dailyService';
import { Tenant } from './tenancy/types';
import { addMinutes, format, parse, startOfDay } from 'date-fns';

export interface BookingSlot {
    start: string; // ISO string
    end: string;
    available: boolean;
}

export const bookingService = {
    /**
     * Get tenant public booking profile by slug
     */
    async getBookingProfile(slug: string): Promise<{ tenant: Tenant | null; error: string | null }> {
        try {
            // We use the existing getTenantBySlug. 
            // NOTE: In a real app, strict RLS might block this for public users.
            // We might need a specific RPC or "security definer" function if RLS is strict.
            // For now, assuming public read access to 'tenants' table or specific fields is allowed.
            const tenant = await tenantService.getTenantBySlug(slug);

            if (!tenant) {
                return { tenant: null, error: 'Booking profile not found' };
            }

            if (!tenant.settings.booking?.enabled) {
                return { tenant: null, error: 'Booking is currently disabled for this user' };
            }

            return { tenant, error: null };
        } catch (err) {
            return { tenant: null, error: String(err) };
        }
    },

    /**
     * Get available slots for a specific date and duration
     */
    async getAvailableSlots(
        tenantId: string,
        dateStr: string, // YYYY-MM-DD
        durationMinutes: number
    ): Promise<{ slots: BookingSlot[]; error: string | null }> {
        try {
            const tenant = await tenantService.getTenant(tenantId);
            if (!tenant || !tenant.settings.booking) {
                return { slots: [], error: 'Booking configuration invalid' };
            }

            const { availability } = tenant.settings.booking;
            // Fix: Use parse to get local date from YYYY-MM-DD string to avoid UTC shift issues
            const targetDate = parse(dateStr, 'yyyy-MM-dd', new Date());

            // Check if day is allowed
            if (!availability.days.includes(targetDate.getDay())) {
                return { slots: [], error: null }; // No slots on this day
            }

            // Parse working hours
            const startHour = parseInt(availability.hours.start.split(':')[0]);
            const startMin = parseInt(availability.hours.start.split(':')[1]);
            const endHour = parseInt(availability.hours.end.split(':')[0]);
            const endMin = parseInt(availability.hours.end.split(':')[1]);

            // Construct start/end times for the day
            const workStart = new Date(targetDate);
            workStart.setHours(startHour, startMin, 0, 0);

            const workEnd = new Date(targetDate);
            workEnd.setHours(endHour, endMin, 0, 0);

            // Fetch existing calendar events to block conflicts
            // We assume the Tenant Admin is the 'user' we are booking with. 
            // In a multi-user tenant, we might need to pick a specific user or 'round-robin'.
            // For now, simpler: Use the Tenant Owner/Admin ID. 
            // We need to fetch the admin user ID. 
            // Let's assume we pass it or fetch it. 
            // For this implementation, we'll try to get the 'owners' of the tenant.
            const users = await tenantService.getTenantUsers(tenantId);
            const adminUser = users.find(u => u.role === 'owner' || u.role === 'admin');

            if (!adminUser) {
                console.warn(`[getAvailableSlots] No admin/owner found for tenant ${tenantId}`);
                return { slots: [], error: 'No host available (Admin not found)' };
            }

            console.log(`[getAvailableSlots] Host found: ${adminUser.userId}`);

            const { events } = await calendarService.getEvents(adminUser.userId, workStart, workEnd);
            console.log(`[getAvailableSlots] Found ${events?.length || 0} existing events for host`);

            // Generate all possible slots
            const slots: BookingSlot[] = [];
            let currentSlot = new Date(workStart);

            while (addMinutes(currentSlot, durationMinutes) <= workEnd) {
                const slotEnd = addMinutes(currentSlot, durationMinutes);

                // Check collision with events
                const isBlocked = (events || []).some((e: any) => {
                    const eventStart = new Date(e.start_time);
                    const eventEnd = new Date(e.end_time);

                    // Simple overlap check
                    return (currentSlot < eventEnd && slotEnd > eventStart);
                });

                if (!isBlocked) {
                    slots.push({
                        start: currentSlot.toISOString(),
                        end: slotEnd.toISOString(),
                        available: true
                    });
                } else {
                    // create a debug log (optional, maybe too verbose for prod, but good for now)
                    // console.log(`Slot ${currentSlot.toISOString()} blocked by event`);
                }

                // Interval: 30 mins defaults, or equal to duration? 
                // Usually booking slots are every 15, 30, or 60 mins.
                // Let's hardcode 30 min intervals for now for flexibility.
                currentSlot = addMinutes(currentSlot, 30);
            }

            console.log(`[getAvailableSlots] Generated ${slots.length} available slots for date ${dateStr}`);

            if (slots.length === 0) {
                // Return a more descriptive error if no slots found to help debugging
                return { slots: [], error: 'No slots available (Fully booked or constrained)' };
            }

            return { slots, error: null };
        } catch (err) {
            console.error(err);
            return { slots: [], error: String(err) };
        }
    },

    /**
     * Create a booking
     */
    async createBooking(
        tenantId: string,
        meetingTypeId: string,
        startTime: string, // ISO
        clientDetails: { name: string; email: string; notes?: string }
    ): Promise<{ bookingId: string | null; error: string | null }> {
        try {
            const tenant = await tenantService.getTenant(tenantId);
            if (!tenant || !tenant.settings.booking) throw new Error('Tenant not found');

            const meetingType = tenant.settings.booking.meetingTypes.find(t => t.id === meetingTypeId);
            if (!meetingType) throw new Error('Invalid meeting type');

            // Find host (Admin/Owner)
            const users = await tenantService.getTenantUsers(tenantId);
            const host = users.find(u => u.role === 'owner' || u.role === 'admin');
            if (!host) throw new Error('No host found');

            const start = new Date(startTime);

            // 1. Create Video Room
            const { call, error: videoError } = await dailyService.createVideoCall({
                hostId: host.userId,
                title: `Meeting with ${clientDetails.name}: ${meetingType.name}`,
                maxParticipants: 2,
                duration: meetingType.duration,
                // We'll treat the client as a guest for now (no user ID link required yet)
            });

            if (videoError || !call) throw new Error('Failed to create video link: ' + videoError);

            // 2. Create Calendar Event
            const { event, error: calError } = await calendarService.createEvent({
                user_id: host.userId,
                title: `${meetingType.name} - ${clientDetails.name}`,
                description: `Client: ${clientDetails.name} (${clientDetails.email})\nNotes: ${clientDetails.notes || 'None'}\n\nVideo Link: ${call.daily_room_url}`,
                start_time: start.toISOString(),
                end_time: addMinutes(start, meetingType.duration).toISOString(),
                type: 'meeting',
                video_room_id: call.id,
                attendees: [clientDetails.email], // logic to handle email attendees vs user IDs?
                is_all_day: false,
                reminder_minutes: 30,
                color: '#8b5cf6' // Violet for bookings
            }, true); // forceCreate=true because we verified slot availability in UI (optimistic)

            if (calError || !event) throw new Error('Failed to schedule calendar event');

            // TODO: Send Email Notification (Client & Host)

            return { bookingId: event.id, error: null };

        } catch (err) {
            return { bookingId: null, error: String(err) };
        }
    }
};
