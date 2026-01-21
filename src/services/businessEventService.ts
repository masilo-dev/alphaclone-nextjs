import { supabase } from '../lib/supabase';

export interface BusinessEvent {
    id: string;
    tenantId: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    eventType: string;
    attendees: string[];
    createdBy?: string;
    createdAt: string;
}

export const businessEventService = {
    /**
     * Get all events for a tenant
     */
    async getEvents(tenantId: string): Promise<{ events: BusinessEvent[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_events')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('start_time', { ascending: true });

            if (error) throw error;

            const events = (data || []).map(e => ({
                id: e.id,
                tenantId: e.tenant_id,
                title: e.title,
                description: e.description,
                startTime: e.start_time,
                endTime: e.end_time,
                eventType: e.event_type,
                attendees: e.attendees || [],
                createdBy: e.created_by,
                createdAt: e.created_at
            }));

            return { events, error: null };
        } catch (err: any) {
            console.error('Error fetching events:', err);
            return { events: [], error: err.message };
        }
    },

    /**
     * Create a new event
     */
    async createEvent(tenantId: string, event: Partial<BusinessEvent>): Promise<{ event: BusinessEvent | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_events')
                .insert({
                    tenant_id: tenantId,
                    title: event.title,
                    description: event.description,
                    start_time: event.startTime,
                    end_time: event.endTime,
                    event_type: event.eventType || 'meeting',
                    attendees: event.attendees || [],
                    created_by: event.createdBy
                })
                .select()
                .single();

            if (error) throw error;

            const newEvent: BusinessEvent = {
                id: data.id,
                tenantId: data.tenant_id,
                title: data.title,
                description: data.description,
                startTime: data.start_time,
                endTime: data.end_time,
                eventType: data.event_type,
                attendees: data.attendees || [],
                createdBy: data.created_by,
                createdAt: data.created_at
            };

            return { event: newEvent, error: null };
        } catch (err: any) {
            console.error('Error creating event:', err);
            return { event: null, error: err.message };
        }
    },

    /**
     * Update an event
     */
    async updateEvent(eventId: string, updates: Partial<BusinessEvent>): Promise<{ error: string | null }> {
        try {
            const updateData: Record<string, any> = {};

            if (updates.title !== undefined) updateData.title = updates.title;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
            if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
            if (updates.eventType !== undefined) updateData.event_type = updates.eventType;
            if (updates.attendees !== undefined) updateData.attendees = updates.attendees;

            const { error } = await supabase
                .from('business_events')
                .update(updateData)
                .eq('id', eventId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating event:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete an event
     */
    async deleteEvent(eventId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_events')
                .delete()
                .eq('id', eventId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting event:', err);
            return { error: err.message };
        }
    }
};
