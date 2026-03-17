import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { calendarService } from './calendarService';

export const calendlyService = {
    /**
     * Get the active Calendly configuration for the current tenant
     */
    getConfig() {
        const tenant = typeof window !== 'undefined' ?
            JSON.parse(localStorage.getItem('alpha_tenant') || '{}') : null;
        const config = (tenant?.settings as any)?.calendly;
        if (!config || !config.enabled || !config.accessToken) {
            return null;
        }
        return config;
    },

    /**
     * Helper to make authenticated requests to Calendly
     */
    async fetchCalendly(endpoint: string, options: RequestInit = {}) {
        const config = this.getConfig();
        if (!config) throw new Error('Calendly is not connected.');

        const response = await fetch(`https://api.calendly.com${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json',
                ...options.headers,
            }
        });

        if (!response.ok) {
            // If token is expired, we might need a refresh logic here in the future
            // For now, let it fail and throw
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `Calendly API error: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Fetch user's event types (booking links)
     */
    async getEventTypes() {
        const config = this.getConfig();
        if (!config || !config.calendlyUserUri) throw new Error('Calendly user connection missing.');

        const data = await this.fetchCalendly(`/event_types?user=${encodeURIComponent(config.calendlyUserUri)}`);
        return data.collection || [];
    },

    /**
     * Fetch upcoming scheduled events from Calendly
     */
    async getScheduledEvents(minStartTime?: Date) {
        const config = this.getConfig();
        if (!config || !config.calendlyUserUri) throw new Error('Calendly user connection missing.');

        const minTime = minStartTime ? minStartTime.toISOString() : new Date().toISOString();

        let allEvents: any[] = [];
        let nextPage = `/scheduled_events?user=${encodeURIComponent(config.calendlyUserUri)}&min_start_time=${encodeURIComponent(minTime)}&status=active`;

        // Fetch all pages (up to a reasonable limit to prevent endless loops)
        let pages = 0;
        while (nextPage && pages < 10) {
            const data = await this.fetchCalendly(nextPage.replace('https://api.calendly.com', ''));
            allEvents = [...allEvents, ...(data.collection || [])];
            nextPage = data.pagination?.next_page;
            pages++;
        }

        return allEvents;
    },

    /**
     * Cancel a specific Calendly event
     */
    async cancelEvent(eventUuid: string, reason: string = 'Canceled via AlphaClone') {
        const config = this.getConfig();
        if (!config) throw new Error('Calendly is not connected.');

        // Calendly UUIDs are the last part of their URIs
        const data = await this.fetchCalendly(`/scheduled_events/${eventUuid}/cancellation`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        });

        return data.resource;
    },

    /**
     * Manually sync upcoming Calendly events to the local database
     */
    async syncUpcomingEvents(userId: string) {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active workspace');

        const events = await this.getScheduledEvents();

        let syncedCount = 0;

        for (const event of events) {
            // Check if we already have this event by its URI
            const { data: existing } = await supabase
                .from('calendar_events')
                .select('id')
                .eq('metadata->>calendly_event_uri', event.uri)
                .single();

            if (!existing) {
                // We need the invitee details to get the name/email
                let desc = event.name;
                const eventUuid = event.uri.split('/').pop();

                try {
                    const inviteesData = await this.fetchCalendly(`/scheduled_events/${eventUuid}/invitees`);
                    const invitee = inviteesData.collection?.[0];
                    if (invitee) {
                        desc = `Calendly meeting with ${invitee.name || invitee.email}`;
                    }
                } catch (e) {
                    console.warn('Could not fetch invitee details for event', eventUuid);
                }

                await calendarService.createEvent({
                    user_id: userId,
                    title: `Calendly: ${event.name}`,
                    description: desc,
                    start_time: event.start_time,
                    end_time: event.end_time,
                    type: 'meeting',
                    location: event.location?.location || 'Calendly Video Link',
                    is_all_day: false,
                    reminder_minutes: 15,
                    metadata: {
                        calendly_event_uri: event.uri,
                        calendly_status: event.status
                    }
                }, true); // forceCreate to bypass conflicts intentionally for imports

                syncedCount++;
            }
        }

        return syncedCount;
    }
};
