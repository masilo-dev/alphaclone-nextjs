
export interface BookingSlot {
    start: string; // ISO string
    end: string;
    available: boolean;
}

const BUFFER_MINUTES = 15; // 15-minute buffer between meetings

export const bookingService = {
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
        startTime: string,
        endTime: string,
        clientDetails: { name: string; email: string; phone?: string; topic?: string; notes?: string; customFields?: Record<string, unknown> },
        options?: { turnstileToken?: string | null; meetingTypeName?: string }
    ): Promise<{ bookingId: string | null; roomUrl: string | null; error: string | null }> {
        try {
            const response = await fetch('/api/booking/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tenant_id: tenantId,
                    booking_type_id: meetingTypeId,
                    start_time: startTime,
                    end_time: endTime,
                    client_name: clientDetails.name,
                    client_email: clientDetails.email,
                    client_phone: clientDetails.phone,
                    client_notes: clientDetails.notes,
                    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    ...(options?.meetingTypeName ? { booking_type_name: options.meetingTypeName } : {}),
                    ...(options?.turnstileToken ? { turnstile_token: options.turnstileToken } : {}),
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                return {
                    bookingId: null,
                    roomUrl: null,
                    error: errorData.error || `Failed to create booking: ${response.statusText}`,
                };
            }

            const data = await response.json() as {
                booking?: { id?: string };
                bookingId?: string;
                roomUrl?: string;
            };
            const bookingId = data.booking?.id ?? data.bookingId ?? null;
            return { bookingId, error: null, roomUrl: data.roomUrl ?? null };
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return { bookingId: null, roomUrl: null, error: null };
            }
            console.error('[createBooking] Error:', err);
            return { bookingId: null, roomUrl: null, error: String(err) };
        }
    }
};
