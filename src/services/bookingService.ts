import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { calendarService } from './calendarService';
import { dailyService } from './dailyService';
import { taskService } from './taskService';
import { Tenant } from './tenancy/types';
import { addMinutes, format, parse, startOfDay, isValid } from 'date-fns';

export interface BookingSlot {
    start: string; // ISO string
    end: string;
    available: boolean;
}

const BUFFER_MINUTES = 15; // 15-minute buffer between meetings

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
            const response = await fetch(`/api/booking/slots?tenantId=${tenantId}&date=${dateStr}&duration=${durationMinutes}`);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { slots: [], error: errorData.error || `Failed to load slots: ${response.statusText}` };
            }

            const data = await response.json();
            return { slots: data.slots || [], error: null };
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return { slots: [], error: null }; // Ignore intended aborts
            }
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
        clientDetails: { name: string; email: string; phone?: string; topic?: string; notes?: string; customFields?: Record<string, any> }
    ): Promise<{ bookingId: string | null; error: string | null }> {
        try {
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenantId,
                    meetingTypeId,
                    startTime,
                    clientDetails
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return { bookingId: null, error: errorData.error || `Failed to create booking: ${response.statusText}` };
            }

            const data = await response.json();
            return { bookingId: data.bookingId, error: null };
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return { bookingId: null, error: null };
            }
            console.error('[createBooking] Error:', err);
            return { bookingId: null, error: String(err) };
        }
    }
};
