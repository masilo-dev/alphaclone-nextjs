import { cleanupRealtimeChannel } from '../lib/realtime';
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
        type: 'meeting' | 'call' | 'reminder' | 'deadline' | 'task' | 'invoice' | 'project' | 'milestone' | 'lead' | 'deal';
    video_room_id?: string;
    attendees?: string[];
    location?: string;
    recurrence_rule?: string;
    color?: string;
    is_all_day: boolean;
    reminder_minutes: number;
    metadata?: Record<string, any>;
    related_to_lead?: string;
    related_entity_id?: string;
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
     * Get all events for a user (federated from Events, Tasks, Invoices, Contracts, Projects, Milestones)
     */
    async getEvents(userId: string, startDate?: Date, endDate?: Date) {
        const tenantId = tenantService.getCurrentTenantId();

        // 1. Calendar Events Query
        let eventsQuery = supabase
            .from('calendar_events')
            .select('*')
            .eq('tenant_id', tenantId)
            .or(`user_id.eq.${userId},attendees.cs.{${userId}}`);

        // 2. Tasks Query — every dated task in the workspace, not only ones assigned to this user
        let tasksQuery = supabase
            .from('tasks')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('due_date', 'is', null)
            .neq('status', 'completed')
            .neq('status', 'cancelled');

        // 3. Invoices Query (Unpaid/Due)
        let invoicesQuery = supabase
            .from('business_invoices')
            .select('*')
            .eq('tenant_id', tenantId)
            .neq('status', 'paid');

        // 4. Contracts Query (Payment Due)
        let contractsQuery = supabase
            .from('contracts')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('payment_due_date', 'is', null) // Only with due dates
            .neq('payment_status', 'paid');

        // 5. Projects Query (Deadlines)
        let projectsQuery = supabase
            .from('projects')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('due_date', 'is', null)
            .neq('status', 'Completed')
            .neq('status', 'done')
            .neq('status', 'cancelled');

        // 6. Milestones Query (Project Milestones)
        let milestonesQuery = supabase
            .from('project_milestones')
            .select('*, projects!inner(tenant_id, client_id, name)')
            .eq('projects.tenant_id', tenantId)
            .not('due_date', 'is', null)
            .neq('status', 'completed');

        let leadsQuery = supabase
            .from('leads')
            .select('id, business_name, contact_name, email, stage, status, owner_id, created_at, updated_at')
            .eq('tenant_id', tenantId)
            .in('stage', ['new', 'lead', 'qualified'])
            .limit(200);

        let dealsQuery = supabase
            .from('deals')
            .select('*')
            .eq('tenant_id', tenantId)
            .not('expected_close_date', 'is', null);

        if (startDate) {
            eventsQuery = eventsQuery.gte('start_time', startDate.toISOString());
            tasksQuery = tasksQuery.gte('due_date', startDate.toISOString());
            invoicesQuery = invoicesQuery.gte('due_date', startDate.toISOString());
            contractsQuery = contractsQuery.gte('payment_due_date', startDate.toISOString());
            projectsQuery = projectsQuery.gte('due_date', startDate.toISOString());
            milestonesQuery = milestonesQuery.gte('due_date', startDate.toISOString());
            dealsQuery = dealsQuery.gte('expected_close_date', startDate.toISOString());
        }
        if (endDate) {
            eventsQuery = eventsQuery.lte('end_time', endDate.toISOString());
            tasksQuery = tasksQuery.lte('due_date', endDate.toISOString());
            invoicesQuery = invoicesQuery.lte('due_date', endDate.toISOString());
            contractsQuery = contractsQuery.lte('payment_due_date', endDate.toISOString());
            projectsQuery = projectsQuery.lte('due_date', endDate.toISOString());
            milestonesQuery = milestonesQuery.lte('due_date', endDate.toISOString());
            dealsQuery = dealsQuery.lte('expected_close_date', endDate.toISOString());
        }

        const [eventsRes, tasksRes, invoicesRes, contractsRes, projectsRes, milestonesRes, leadsRes, dealsRes] = await Promise.all([
            eventsQuery.order('start_time', { ascending: true }),
            tasksQuery.order('due_date', { ascending: true }),
            invoicesQuery.order('due_date', { ascending: true }),
            contractsQuery.order('payment_due_date', { ascending: true }),
            projectsQuery.order('due_date', { ascending: true }),
            milestonesQuery.order('due_date', { ascending: true }),
            leadsQuery.order('created_at', { ascending: false }),
            dealsQuery.order('expected_close_date', { ascending: true }),
        ]);

        // Map Calendar Events
        const events: CalendarEvent[] = (eventsRes.data || []).map((e: any) => ({
            ...e,
            type: e.type || 'meeting',
            start_time: e.start_time,
            end_time: e.end_time
        }));

        // Map Tasks to Events
        const taskEvents: CalendarEvent[] = (tasksRes.data || [])
            .filter((t: any) => !t.metadata?.is_booking_shadow && (t.start_date || t.due_date))
            .map((t: any) => ({
                id: `task_${t.id}`,
                user_id: t.assigned_to || userId,
                title: `Task: ${t.title}`,
                description: t.description,
                start_time: t.start_date || t.due_date,
                end_time: t.due_date,
                type: 'task',
                color: '#f59e0b', // Amber
                is_all_day: !t.start_date,
                reminder_minutes: 0,
                metadata: { taskId: t.id, status: t.status, priority: t.priority },
                related_entity_id: t.id,
                related_to_lead: t.related_to_lead,
                created_at: t.created_at,
                updated_at: t.updated_at
            }));

        // Map Invoices to Events
        const invoiceEvents: CalendarEvent[] = (invoicesRes.data || []).map((inv: any) => ({
            id: `inv_${inv.id}`,
            user_id: userId,
            title: `Due: Invoice #${inv.invoice_number}`,
            description: `Amount: $${inv.total} - Status: ${inv.status}`,
            start_time: inv.due_date,
            end_time: inv.due_date,
            type: 'invoice',
            color: '#ef4444', // Red
            is_all_day: true,
            reminder_minutes: 0,
            metadata: { invoiceId: inv.id, amount: inv.total, status: inv.status },
            related_entity_id: inv.id,
            created_at: inv.created_at,
            updated_at: inv.updated_at
        }));

        // Map Contracts to Events
        const contractEvents: CalendarEvent[] = (contractsRes.data || []).map((c: any) => ({
            id: `contract_${c.id}`,
            user_id: userId,
            title: `Contract Payment: ${c.title}`,
            description: `Amount: $${c.payment_amount || 0} - Status: ${c.payment_status}`,
            start_time: c.payment_due_date,
            end_time: c.payment_due_date,
            type: 'invoice', // Reuse invoice type logic
            color: '#dc2626', // Darker Red
            is_all_day: true,
            reminder_minutes: 0,
            metadata: { contractId: c.id, amount: c.payment_amount, status: c.payment_status },
            related_entity_id: c.id,
            created_at: c.created_at,
            updated_at: c.updated_at
        }));

        // Map Projects to Events
        const projectEvents: CalendarEvent[] = (projectsRes.data || [])
            .filter((p: any) => p.due_date && p.status !== 'Completed' && p.status !== 'done' && p.status !== 'cancelled' && p.current_stage !== 'Closure')
            .map((p: any) => ({
            id: `project_${p.id}`,
            user_id: p.owner_id || userId,
            title: `Project Deadline: ${p.name}`,
            description: p.description || `Category: ${p.category || 'General'}`,
            start_time: p.due_date,
            end_time: p.due_date,
            type: 'project',
            color: '#8b5cf6', // Violet
            is_all_day: true,
            reminder_minutes: 60,
            metadata: { projectId: p.id, health: p.health, budget: p.budget },
            related_entity_id: p.id,
            related_to_lead: undefined,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        // Map Milestones to Events
        const milestoneEvents: CalendarEvent[] = (milestonesRes.data || []).map((m: any) => ({
            id: `milestone_${m.id}`,
            user_id: userId,
            title: `Milestone: ${m.name}`,
            description: m.description,
            start_time: m.due_date,
            end_time: m.due_date,
            type: 'milestone',
            color: '#ec4899', // Pink
            is_all_day: true,
            reminder_minutes: 0,
            metadata: { milestoneId: m.id, projectId: m.project_id, clientId: m.projects?.client_id },
            related_entity_id: m.id,
            related_to_lead: undefined,
            created_at: m.created_at,
            updated_at: m.updated_at
        }));

        const leadEvents: CalendarEvent[] = (leadsRes.data || []).map((lead: any) => {
            const start = lead.updated_at || lead.created_at;
            return {
                id: `lead_${lead.id}`,
                user_id: lead.owner_id || userId,
                title: `Lead: ${lead.business_name || lead.contact_name || lead.email || 'Untitled'}`,
                description: `Stage: ${lead.stage || lead.status || 'new'}`,
                start_time: start,
                end_time: start,
                type: 'lead' as const,
                color: '#14b8a6',
                is_all_day: true,
                reminder_minutes: 0,
                metadata: { leadId: lead.id, stage: lead.stage },
                related_entity_id: lead.id,
                related_to_lead: lead.id,
                created_at: lead.created_at,
                updated_at: lead.updated_at,
            };
        });

        const closedDeal = new Set(['closed_won', 'closed_lost', 'won', 'lost']);
        const dealEvents: CalendarEvent[] = (dealsRes.data || [])
            .filter((d: any) => d.expected_close_date && !closedDeal.has(String(d.stage || '').toLowerCase()))
            .map((d: any) => ({
                id: `deal_${d.id}`,
                user_id: d.owner_id || userId,
                title: `Deal: ${d.name}`,
                description: d.description || `Stage: ${d.stage}`,
                start_time: d.expected_close_date,
                end_time: d.expected_close_date,
                type: 'deal' as const,
                color: '#f59e0b',
                is_all_day: true,
                reminder_minutes: 0,
                metadata: { dealId: d.id, stage: d.stage, value: d.value },
                related_entity_id: d.id,
                created_at: d.created_at,
                updated_at: d.updated_at,
            }));

        const nativeSyncedKeys = new Set(
            events
                .filter((e) => e.related_entity_id && ['task', 'project', 'milestone', 'lead', 'deal'].includes(e.type))
                .map((e) => `${e.type}:${e.related_entity_id}`)
        );

        const dedupedTaskEvents = taskEvents.filter((e) => !nativeSyncedKeys.has(`task:${e.related_entity_id}`));
        const dedupedProjectEvents = projectEvents.filter((e) => !nativeSyncedKeys.has(`project:${e.related_entity_id}`));
        const dedupedMilestoneEvents = milestoneEvents.filter((e) => !nativeSyncedKeys.has(`milestone:${e.related_entity_id}`));
        const dedupedLeadEvents = leadEvents.filter((e) => !nativeSyncedKeys.has(`lead:${e.related_entity_id}`));
        const dedupedDealEvents = dealEvents.filter((e) => !nativeSyncedKeys.has(`deal:${e.related_entity_id}`));

        const combinedEvents = [
            ...events,
            ...dedupedTaskEvents,
            ...invoiceEvents,
            ...contractEvents,
            ...dedupedProjectEvents,
            ...dedupedMilestoneEvents,
            ...dedupedLeadEvents,
            ...dedupedDealEvents,
        ];
        combinedEvents.sort((a, b) => {
            const byDate = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
            if (byDate !== 0) return byDate;
            return String(a.title).localeCompare(String(b.title));
        });

        return {
            events: combinedEvents,
            error: eventsRes.error || tasksRes.error || invoicesRes.error || contractsRes.error || projectsRes.error || milestonesRes.error || leadsRes.error || dealsRes.error
        };
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
        attendees: string[] = [],
        relatedToLead?: string
    ) {
        const endTime = addMinutes(startTime, durationMinutes);
        const videoRoomId = `room_${crypto.randomUUID()}`;

        const event = {
            user_id: userId,
            title,
            description: 'Video call meeting',
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            type: 'meeting' as const,
            video_room_id: videoRoomId,
            attendees,
            is_all_day: false,
            reminder_minutes: 15,
            related_to_lead: relatedToLead
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

    unsubscribe(channel: unknown) {
        cleanupRealtimeChannel(channel);
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
