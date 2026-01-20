/**
 * Event Bus - Core Service
 * Central nervous system for the Business OS
 */

import { supabase } from '../../lib/supabase';
import type {
    Event,
    EventSubscription,
    EventHandlerFunction,
    PublishEventOptions,
    EventStatus
} from './types';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

class EventBusService {
    private handlers: Map<string, EventHandlerFunction[]> = new Map();
    private isListening: boolean = false;

    /**
     * Publish an event to the event bus
     */
    async publish(options: PublishEventOptions): Promise<string> {
        try {
            const { data, error } = await supabase.rpc('publish_event', {
                p_event_type: options.eventType,
                p_event_source: options.eventSource,
                p_event_data: options.eventData,
                p_metadata: options.metadata || {}
            });

            if (error) throw error;

            console.log(`[EventBus] Published event: ${options.eventType}`, {
                source: options.eventSource,
                eventId: data
            });

            return data;
        } catch (error) {
            console.error('[EventBus] Failed to publish event:', error);
            throw error;
        }
    }

    /**
     * Subscribe to events matching a pattern
     */
    subscribe(eventPattern: string, handler: EventHandlerFunction): void {
        if (!this.handlers.has(eventPattern)) {
            this.handlers.set(eventPattern, []);
        }
        this.handlers.get(eventPattern)!.push(handler);

        console.log(`[EventBus] Subscribed to pattern: ${eventPattern}`);

        // Start listening if not already
        if (!this.isListening) {
            this.startListening();
        }
    }

    /**
     * Unsubscribe from events
     */
    unsubscribe(eventPattern: string, handler: EventHandlerFunction): void {
        const handlers = this.handlers.get(eventPattern);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
            if (handlers.length === 0) {
                this.handlers.delete(eventPattern);
            }
        }
    }

    /**
     * Start listening for new events via Supabase Realtime
     */
    private startListening(): void {
        if (this.isListening) return;

        // Listen for new events via PostgreSQL NOTIFY
        supabase
            .channel('event_bus')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'events'
            }, async (payload: RealtimePostgresChangesPayload<Event>) => {
                const event = payload.new as Event;
                await this.processEvent(event);
            })
            .subscribe();

        this.isListening = true;
        console.log('[EventBus] Started listening for events');
    }

    /**
     * Process an event by executing matching handlers
     */
    private async processEvent(event: Event): Promise<void> {
        const startTime = Date.now();

        try {
            // Update event status to processing
            await this.updateEventStatus(event.id, 'processing');

            // Get matching handlers
            const handlers = this.getMatchingHandlers(event.eventType);

            if (handlers.length === 0) {
                console.log(`[EventBus] No handlers for event: ${event.eventType}`);
                await this.updateEventStatus(event.id, 'completed');
                return;
            }

            // Execute all handlers
            const results = await Promise.allSettled(
                handlers.map(handler => handler(event))
            );

            // Check for failures
            const failures = results.filter(r => r.status === 'rejected');

            if (failures.length > 0) {
                const errors = failures.map((f: any) => f.reason?.message || 'Unknown error');
                await this.updateEventStatus(
                    event.id,
                    'failed',
                    errors.join('; ')
                );
            } else {
                await this.updateEventStatus(event.id, 'completed');
            }

            const executionTime = Date.now() - startTime;
            console.log(`[EventBus] Processed event ${event.eventType} in ${executionTime}ms`);

        } catch (error: any) {
            console.error('[EventBus] Error processing event:', error);
            await this.updateEventStatus(event.id, 'failed', error.message);
        }
    }

    /**
     * Get handlers that match the event type
     */
    private getMatchingHandlers(eventType: string): EventHandlerFunction[] {
        const matchingHandlers: EventHandlerFunction[] = [];

        for (const [pattern, handlers] of this.handlers.entries()) {
            if (this.matchesPattern(eventType, pattern)) {
                matchingHandlers.push(...handlers);
            }
        }

        return matchingHandlers;
    }

    /**
     * Check if event type matches pattern
     * Supports wildcards: user.* matches user.created, user.updated, etc.
     */
    private matchesPattern(eventType: string, pattern: string): boolean {
        if (pattern === '*') return true;
        if (pattern === eventType) return true;

        // Convert pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*');
        const regex = new RegExp(`^${regexPattern}$`);

        return regex.test(eventType);
    }

    /**
     * Update event status in database
     */
    private async updateEventStatus(
        eventId: string,
        status: EventStatus,
        errorMessage?: string
    ): Promise<void> {
        await supabase.rpc('mark_event_processed', {
            p_event_id: eventId,
            p_status: status,
            p_error_message: errorMessage || null
        });
    }

    /**
     * Get event history
     */
    async getEventHistory(
        filters?: {
            eventType?: string;
            eventSource?: string;
            status?: EventStatus;
            limit?: number;
        }
    ): Promise<Event[]> {
        let query = supabase
            .from('events')
            .select('*')
            .order('created_at', { ascending: false });

        if (filters?.eventType) {
            query = query.eq('event_type', filters.eventType);
        }
        if (filters?.eventSource) {
            query = query.eq('event_source', filters.eventSource);
        }
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }
        if (filters?.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;

        if (error) throw error;
        return data || [];
    }

    /**
     * Replay failed events
     */
    async replayFailedEvents(): Promise<void> {
        const { data: failedEvents } = await supabase
            .from('events')
            .select('*')
            .eq('status', 'failed')
            .order('created_at', { ascending: true });

        if (!failedEvents || failedEvents.length === 0) {
            console.log('[EventBus] No failed events to replay');
            return;
        }

        console.log(`[EventBus] Replaying ${failedEvents.length} failed events`);

        for (const event of failedEvents) {
            await this.processEvent(event as Event);
        }
    }

    /**
     * Get event statistics
     */
    async getStatistics(): Promise<{
        total: number;
        pending: number;
        completed: number;
        failed: number;
    }> {
        const { data } = await supabase
            .from('events')
            .select('status');

        const stats = {
            total: data?.length || 0,
            pending: 0,
            completed: 0,
            failed: 0
        };

        data?.forEach((event: any) => {
            if (event.status === 'pending') stats.pending++;
            else if (event.status === 'completed') stats.completed++;
            else if (event.status === 'failed') stats.failed++;
        });

        return stats;
    }
}

// Export singleton instance
export const eventBus = new EventBusService();
