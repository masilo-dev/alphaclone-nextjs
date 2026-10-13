import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { calendarService } from './calendarService';

export const calendlyService = {
    /**
     * Get the active Calendly configuration for the current tenant
     */
    async getConfig(tenantId?: string) {
        let resolvedId = tenantId;
        if (!resolvedId && typeof window !== 'undefined') {
            resolvedId = tenantService.getCurrentTenantId() ?? undefined;
        }

        if (resolvedId) {
            if (typeof window === 'undefined') {
                const [{ getCalendlyConfig }, { createSupabaseAdminClient }] = await Promise.all([
                    import('@/services/calendly/calendlyIntegrationService'),
                    import('@/lib/supabase-admin'),
                ]);
                return getCalendlyConfig(createSupabaseAdminClient(), resolvedId);
            }
            const { data: tenant } = await supabase
                .from('tenants')
                .select('settings')
                .eq('id', resolvedId)
                .maybeSingle();
            return (tenant?.settings as Record<string, unknown> | null)?.calendly as
                | Record<string, unknown>
                | undefined;
        }

        return null;
    },

    /**
     * Helper to make authenticated requests to Calendly
     */
    async fetchCalendly(endpoint: string, options: RequestInit = {}, tenantId?: string) {
        const config = await this.getConfig(tenantId);
        if (!config || !config.enabled || !config.accessToken) {
            throw new Error('Calendly is not connected or enabled for this tenant.');
        }

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
    async getEventTypes(tenantId?: string) {
        const config = await this.getConfig(tenantId);
        if (!config || !config.calendlyUserUri) throw new Error('Calendly user connection missing.');

        const userUri = String(config.calendlyUserUri);
        const data = await this.fetchCalendly(`/event_types?user=${encodeURIComponent(userUri)}`, {}, tenantId);
        return data.collection || [];
    },

    /**
     * Fetch upcoming scheduled events from Calendly
     */
    async getScheduledEvents(minStartTime?: Date, tenantId?: string) {
        const config = await this.getConfig(tenantId);
        if (!config || !config.calendlyUserUri) throw new Error('Calendly user connection missing.');

        const minTime = minStartTime ? minStartTime.toISOString() : new Date().toISOString();

        let allEvents: any[] = [];
        const userUri = String(config.calendlyUserUri);
        let nextPage = `/scheduled_events?user=${encodeURIComponent(userUri)}&min_start_time=${encodeURIComponent(minTime)}&status=active`;

        // Fetch all pages (up to a reasonable limit to prevent endless loops)
        let pages = 0;
        while (nextPage && pages < 10) {
            const data = await this.fetchCalendly(nextPage.replace('https://api.calendly.com', ''), {}, tenantId);
            allEvents = [...allEvents, ...(data.collection || [])];
            nextPage = data.pagination?.next_page;
            pages++;
        }

        return allEvents;
    },

    /**
     * Cancel a specific Calendly event
     */
    async cancelEvent(eventUuid: string, tenantId?: string, reason: string = 'Canceled via AlphaClone') {
        const data = await this.fetchCalendly(`/scheduled_events/${eventUuid}/cancellation`, {
            method: 'POST',
            body: JSON.stringify({ reason })
        }, tenantId);

        return data.resource;
    },

    /**
     * Programmatically schedule a meeting for an invitee
     * @param eventTypeUri The canonical URI of the event type to book
     * @param details Invitee details (name, email, start_time, etc.)
     * @param tenantId Optional tenant ID for server-side lookup
     */
    async scheduleMeeting(eventTypeUri: string, details: { 
        name: string, 
        email: string, 
        start_time: string, 
        timezone?: string,
        questions_and_answers?: any[]
    }, tenantId?: string) {
        const body = {
            event_type: eventTypeUri,
            start_time: details.start_time,
            email: details.email,
            name: details.name,
            timezone: details.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            questions_and_answers: details.questions_and_answers,
            booking_source: 'alpha_autonomous_workforce'
        };

        const data = await this.fetchCalendly('/invitees', {
            method: 'POST',
            body: JSON.stringify(body)
        }, tenantId);

        return data.resource;
    },

    /**
     * Fetch the meeting recap and transcript for a completed event
     */
    async getMeetingRecap(eventUuid: string, tenantId?: string) {
        // First try the new meeting_recap sub-resource (API v2 2026 update)
        try {
            const data = await this.fetchCalendly(`/scheduled_events/${eventUuid}/meeting_recap`, {}, tenantId);
            return data.resource;
        } catch (e) {
            console.warn(`Meeting recap not found for event ${eventUuid}. It might not be generated yet.`);
            return null;
        }
    },

    /**
     * Manually sync upcoming Calendly events to the local database
     */
    async syncUpcomingEvents(userId: string, tenantIdParam?: string) {
        const tenantId = tenantIdParam || tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active workspace');

        if (typeof window === 'undefined') {
            const config = await this.getConfig(tenantId);
            if (!config?.accessToken || !config.calendlyUserUri) throw new Error('Calendly OAuth is not connected');
            const { pullAndSyncCalendlyEvents } = await import('@/lib/calendly/syncToNative');
            const result = await pullAndSyncCalendlyEvents(tenantId, userId, config as import('@/lib/calendly/syncToNative').CalendlyTenantConfig);
            return result.syncedCount;
        }
        const response = await fetch('/api/calendly/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenantId }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Calendly sync failed');
        return result.syncedCount;

    }
};
