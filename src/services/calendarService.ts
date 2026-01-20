import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { addMinutes } from 'date-fns';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

export interface CalendarEvent {
    id: string;
    user_id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    type: 'meeting' | 'call' | 'reminder' | 'deadline' | 'task';
    video_room_id?: string;
    attendees?: string[];
    location?: string;
    recurrence_rule?: string;
    color?: string;
    is_all_day: boolean;
    reminder_minutes: number;
    created_at: string;
    updated_at: string;
}

export interface ConflictDetection {
    hasConflict: boolean;
    conflictingEvents: CalendarEvent[];
    suggestedTimes?: Date[];
}

export const calendarService = {
    /**
     * Get all events for a user
     */
    async getEvents(userId: string, startDate?: Date, endDate?: Date) {
        let query = supabase
            .from('calendar_events')
            .select('*')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .or(`user_id.eq.${userId},attendees.cs.{${userId}}`);

        if (startDate) {
            query = query.gte('start_time', startDate.toISOString());
        }
        if (endDate) {
            query = query.lte('end_time', endDate.toISOString());
        }

        const { data, error } = await query.order('start_time', { ascending: true });

        return { events: data, error };
    },

    /**
     * Get single event by ID
     */
    async getEvent(eventId: string) {
        const { data, error } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', eventId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .single();

        return { event: data, error };
    },

    /**
     * Create new calendar event with conflict detection
     */
    async createEvent(event: Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at'>, forceCreate: boolean = false) {
        // Check for conflicts first
        const conflict = await this.detectConflicts(
            event.user_id,
            new Date(event.start_time),
            new Date(event.end_time)
        );

        if (conflict.hasConflict && !forceCreate) {
            return { event: null, conflict, error: 'Scheduling conflict detected' };
        }

        const { data, error } = await supabase
            .from('calendar_events')
            .insert({ ...event, tenant_id: tenantService.getCurrentTenantId() })
            .select()
            .single();

        return { event: data, conflict: undefined, error };
    },

    /**
     * Update existing event with conflict detection
     */
    async updateEvent(eventId: string, updates: Partial<CalendarEvent>, forceUpdate: boolean = false) {
        // If updating time, check for conflicts
        if (updates.start_time || updates.end_time) {
            const { data: existingEvent } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('id', eventId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .single();

            if (existingEvent) {
                const startTime = updates.start_time
                    ? new Date(updates.start_time)
                    : new Date(existingEvent.start_time);
                const endTime = updates.end_time
                    ? new Date(updates.end_time)
                    : new Date(existingEvent.end_time);

                const conflict = await this.detectConflicts(
                    existingEvent.user_id,
                    startTime,
                    endTime,
                    eventId
                );

                if (conflict.hasConflict && !forceUpdate) {
                    return { event: null, conflict, error: 'Scheduling conflict detected' };
                }
            }
        }

        const { data, error } = await supabase
            .from('calendar_events')
            .update(updates)
            .eq('id', eventId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .select()
            .single();

        return { event: data, conflict: undefined, error };
    },

    /**
     * Delete event
     */
    async deleteEvent(eventId: string) {
        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', eventId)
            .eq('tenant_id', tenantService.getCurrentTenantId());

        return { error };
    },

    /**
     * Create a video call event
     */
    async createVideoCallEvent(
        userId: string,
        title: string,
        startTime: Date,
        durationMinutes: number = 60,
        attendees: string[] = []
    ) {
        const endTime = addMinutes(startTime, durationMinutes);
        const videoRoomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const event = {
            user_id: userId,
            title,
            description: 'Video call meeting',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            type: 'call' as const,
            video_room_id: videoRoomId,
            attendees,
            color: '#10b981',
            is_all_day: false,
            reminder_minutes: 15,
        };

        return this.createEvent(event);
    },

    /**
     * Get upcoming events (next 7 days)
     */
    async getUpcomingEvents(userId: string) {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);

        return this.getEvents(userId, now, nextWeek);
    },

    /**
     * Get today's events
     */
    async getTodayEvents(userId: string) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.getEvents(userId, today, tomorrow);
    },

    /**
     * Subscribe to event changes
     */
    subscribeToEvents(userId: string, callback: (event: CalendarEvent) => void) {
        return supabase
            .channel('calendar_events_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'calendar_events',
                    filter: `user_id=eq.${userId} AND tenant_id=eq.${tenantService.getCurrentTenantId()}`,
                },
                (payload: RealtimePostgresChangesPayload<CalendarEvent>) => {
                    callback(payload.new as CalendarEvent);
                }
            )
            .subscribe();
    },

    /**
     * Check for event conflicts (legacy method)
     */
    async checkConflicts(userId: string, startTime: Date, endTime: Date, excludeEventId?: string) {
        let query = supabase
            .from('calendar_events')
            .select('*')
            .eq('user_id', userId)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .or(`and(start_time.lte.${endTime.toISOString()},end_time.gte.${startTime.toISOString()})`);

        if (excludeEventId) {
            query = query.neq('id', excludeEventId);
        }

        const { data, error } = await query;

        return { conflicts: data || [], error };
    },

    /**
     * Detect scheduling conflicts with suggested alternatives
     */
    async detectConflicts(
        userId: string,
        startTime: Date,
        endTime: Date,
        excludeEventId?: string
    ): Promise<ConflictDetection> {
        try {
            let query = supabase
                .from('calendar_events')
                .select('*')
                .or(`user_id.eq.${userId},attendees.cs.{${userId}}`)
                .or(
                    `and(start_time.lte.${endTime.toISOString()},end_time.gte.${startTime.toISOString()})`
                );

            if (excludeEventId) {
                query = query.neq('id', excludeEventId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Conflict detection error:', error);
                return { hasConflict: false, conflictingEvents: [] };
            }

            const conflictingEvents = data || [];
            const hasConflict = conflictingEvents.length > 0;

            // Generate suggested alternative times if there's a conflict
            const suggestedTimes = hasConflict
                ? await this.generateSuggestedTimes(userId, startTime, endTime)
                : undefined;

            return {
                hasConflict,
                conflictingEvents,
                suggestedTimes,
            };
        } catch (error) {
            console.error('Conflict detection error:', error);
            return { hasConflict: false, conflictingEvents: [] };
        }
    },

    /**
     * Generate suggested alternative meeting times
     */
    async generateSuggestedTimes(
        userId: string,
        requestedStart: Date,
        requestedEnd: Date
    ): Promise<Date[]> {
        const duration = requestedEnd.getTime() - requestedStart.getTime();
        const suggestions: Date[] = [];

        // Get all events for the day
        const dayStart = new Date(requestedStart);
        dayStart.setHours(9, 0, 0, 0); // Start at 9 AM
        const dayEnd = new Date(requestedStart);
        dayEnd.setHours(17, 0, 0, 0); // End at 5 PM

        const { data: events } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .or(`user_id.eq.${userId},attendees.cs.{${userId}}`)
            .gte('start_time', dayStart.toISOString())
            .lte('end_time', dayEnd.toISOString())
            .order('start_time');

        // Find gaps between events
        let currentTime = dayStart.getTime();
        const eventTimes = (events || []).map((e: any) => ({
            start: new Date(e.start_time).getTime(),
            end: new Date(e.end_time).getTime(),
        }));

        for (const event of eventTimes) {
            if (event.start - currentTime >= duration) {
                suggestions.push(new Date(currentTime));
                if (suggestions.length >= 3) break;
            }
            currentTime = Math.max(currentTime, event.end);
        }

        // Check if there's time at the end of the day
        if (suggestions.length < 3 && dayEnd.getTime() - currentTime >= duration) {
            suggestions.push(new Date(currentTime));
        }

        return suggestions;
    },

    /**
     * Get user's availability for a date range
     */
    async getUserAvailability(
        userId: string,
        startDate: Date,
        endDate: Date
    ): Promise<{ availableSlots: { start: Date; end: Date }[]; error?: string }> {
        try {
            const { data: events } = await supabase
                .from('calendar_events')
                .select('*')
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .or(`user_id.eq.${userId},attendees.cs.{${userId}}`)
                .gte('start_time', startDate.toISOString())
                .lte('end_time', endDate.toISOString())
                .order('start_time');

            // Define working hours (9 AM - 5 PM)
            const workingHours = { start: 9, end: 17 };
            const availableSlots: { start: Date; end: Date }[] = [];

            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                // Skip weekends
                if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                    const dayStart = new Date(currentDate);
                    dayStart.setHours(workingHours.start, 0, 0, 0);
                    const dayEnd = new Date(currentDate);
                    dayEnd.setHours(workingHours.end, 0, 0, 0);

                    // Find events for this day
                    const dayEvents = (events || []).filter((e: any) => {
                        const eventStart = new Date(e.start_time);
                        return eventStart.toDateString() === currentDate.toDateString();
                    });

                    // Calculate available slots
                    let slotStart = dayStart;
                    for (const event of dayEvents) {
                        const eventStart = new Date(event.start_time);
                        const eventEnd = new Date(event.end_time);

                        if (eventStart > slotStart) {
                            availableSlots.push({
                                start: new Date(slotStart),
                                end: new Date(eventStart),
                            });
                        }
                        slotStart = eventEnd > slotStart ? eventEnd : slotStart;
                    }

                    // Add remaining time at end of day
                    if (slotStart < dayEnd) {
                        availableSlots.push({
                            start: new Date(slotStart),
                            end: new Date(dayEnd),
                        });
                    }
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

            return { availableSlots };
        } catch (error) {
            return { availableSlots: [], error: String(error) };
        }
    },

    /**
     * Find optimal meeting time for multiple attendees
     */
    async findOptimalMeetingTime(
        attendeeIds: string[],
        duration: number, // in minutes
        preferredDate?: Date
    ): Promise<{ suggestedTimes: Date[]; error?: string }> {
        try {
            const startDate = preferredDate || new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7); // Look ahead 7 days

            // Get availability for all attendees
            const availabilities = await Promise.all(
                attendeeIds.map((id) => this.getUserAvailability(id, startDate, endDate))
            );

            // Find overlapping available slots
            const durationMs = duration * 60 * 1000;
            const suggestedTimes: Date[] = [];

            const firstAvailability = availabilities[0]?.availableSlots || [];

            for (const slot of firstAvailability) {
                const slotDuration = slot.end.getTime() - slot.start.getTime();
                if (slotDuration >= durationMs) {
                    // Check if this slot works for all attendees
                    const worksForAll = availabilities.every((avail) =>
                        (avail.availableSlots || []).some(
                            (s) =>
                                s.start <= slot.start &&
                                s.end >= new Date(slot.start.getTime() + durationMs)
                        )
                    );

                    if (worksForAll) {
                        suggestedTimes.push(new Date(slot.start));
                        if (suggestedTimes.length >= 5) break;
                    }
                }
            }

            return { suggestedTimes };
        } catch (error) {
            return { suggestedTimes: [], error: String(error) };
        }
    },

    /**
     * Get all events (admin only)
     */
    async getAllEvents(limit = 100) {
        const { data, error } = await supabase
            .from('calendar_events')
            .select(`
        *,
        profiles:user_id (
          email,
          name
        )
      `)
            .eq('tenant_id', tenantService.getCurrentTenantId())
            .order('start_time', { ascending: false })
            .limit(limit);

        return { events: data, error };
    },
};
