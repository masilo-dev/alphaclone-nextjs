/**
 * Ticket Service
 * Provides ticketing functionality across all modules
 * Supports creating, updating, and managing tickets linked to any entity
 */

import { supabase } from '@/lib/supabase';
import { tenantService } from './tenancy/TenantService';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
export type TicketSource = 'lead' | 'client' | 'project' | 'invoice' | 'contract' | 'general';

export interface Ticket {
    id: string;
    tenant_id: string;
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    source: TicketSource;
    source_id?: string; // ID of the related entity (lead, client, project, etc.)
    source_name?: string; // Name of the related entity
    assigned_to?: string;
    created_by: string;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
    closed_at?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    _origin?: 'tickets' | 'support_tickets';
}

export function isSupportChannelTicket(ticket: Ticket): boolean {
    return ticket._origin === 'support_tickets' || ticket.metadata?.fromSupportTable === true;
}

export interface TicketComment {
    id: string;
    ticket_id: string;
    user_id: string;
    content: string;
    created_at: string;
    is_internal: boolean;
}

export interface CreateTicketInput {
    title: string;
    description: string;
    priority?: TicketPriority;
    source: TicketSource;
    source_id?: string;
    source_name?: string;
    assigned_to?: string;
    tags?: string[];
    metadata?: Record<string, any>;
    /** Optional customer email for confirmation and update notifications */
    customerEmail?: string;
}

class TicketService {
    /**
     * Create a new ticket
     */
    async create(input: CreateTicketInput): Promise<Ticket> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const tenantId = await this.getTenantId();

        const metadata = { ...(input.metadata || {}) };
        if (input.customerEmail) {
            metadata.customerEmail = input.customerEmail;
        }

        const { data, error } = await supabase
            .from('tickets')
            .insert({
                tenant_id: tenantId,
                title: input.title,
                description: input.description,
                priority: input.priority || 'medium',
                status: 'open',
                source: input.source,
                source_id: input.source_id,
                source_name: input.source_name,
                assigned_to: input.assigned_to,
                created_by: user.id,
                tags: input.tags || [],
                metadata,
            })
            .select()
            .single();

        if (error) throw error;

        await this.dispatchNotification('created', data, {
            customerEmail: input.customerEmail || input.metadata?.customerEmail,
        });

        return data;
    }

    /**
     * Get tickets for a specific entity
     */
    async getBySource(source: TicketSource, sourceId: string): Promise<Ticket[]> {
        const tenantId = await this.getTenantId();

        const { data, error } = await supabase
            .from('tickets')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('source', source)
            .eq('source_id', sourceId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    /**
     * Get tickets for the current tenant
     */
    async getAll(filters?: {
        status?: TicketStatus;
        priority?: TicketPriority;
        source?: TicketSource;
        assignedTo?: string;
    }): Promise<Ticket[]> {
        const tenantId = await this.getTenantId();

        try {
            const res = await fetch(`/api/tickets?tenantId=${encodeURIComponent(tenantId)}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                let tickets = (data.tickets || []) as Ticket[];
                if (filters?.status) tickets = tickets.filter((t) => t.status === filters.status);
                if (filters?.priority) tickets = tickets.filter((t) => t.priority === filters.priority);
                if (filters?.source) tickets = tickets.filter((t) => t.source === filters.source);
                if (filters?.assignedTo) tickets = tickets.filter((t) => t.assigned_to === filters.assignedTo);
                return tickets;
            }
        } catch (err) {
            console.warn('[ticketService] unified fetch failed, falling back:', err);
        }

        let query = supabase
            .from('tickets')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        if (filters?.status) query = query.eq('status', filters.status);
        if (filters?.priority) query = query.eq('priority', filters.priority);
        if (filters?.source) query = query.eq('source', filters.source);
        if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo);

        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map((t: Ticket) => ({ ...t, _origin: 'tickets' as const }));
    }

    /**
     * Update ticket status
     */
    async updateStatus(ticketId: string, status: TicketStatus, origin: 'tickets' | 'support_tickets' = 'tickets'): Promise<void> {
        const tenantId = await this.getTenantId();

        if (origin === 'support_tickets') {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, origin, status }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update ticket');
            }
            return;
        }

        const updateData: Partial<Ticket> = { status, updated_at: new Date().toISOString() };

        if (status === 'resolved') updateData.resolved_at = new Date().toISOString();
        if (status === 'closed') updateData.closed_at = new Date().toISOString();

        const { error } = await supabase
            .from('tickets')
            .update(updateData)
            .eq('id', ticketId);

        if (error) throw error;

        const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
        if (ticket) {
            await this.dispatchNotification('status_changed', ticket as Ticket, {
                customerEmail: ticket.metadata?.customerEmail,
            });
        }
    }

    /**
     * Update ticket priority
     */
    async updatePriority(ticketId: string, priority: TicketPriority, origin: 'tickets' | 'support_tickets' = 'tickets'): Promise<void> {
        const tenantId = await this.getTenantId();

        if (origin === 'support_tickets') {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId, origin, priority }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update priority');
            }
            return;
        }

        const { error } = await supabase
            .from('tickets')
            .update({ priority, updated_at: new Date().toISOString() })
            .eq('id', ticketId);

        if (error) throw error;
    }

    /**
     * Add a comment to a ticket
     */
    async addComment(ticketId: string, content: string, isInternal: boolean = false): Promise<TicketComment> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const { data, error } = await supabase
            .from('ticket_comments')
            .insert({
                ticket_id: ticketId,
                user_id: user.id,
                content,
                is_internal: isInternal,
            })
            .select()
            .single();

        if (error) throw error;

        const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
        if (ticket && !isInternal) {
            await this.dispatchNotification('comment', ticket as Ticket, {
                customerEmail: ticket.metadata?.customerEmail,
                commentPreview: content,
                isInternalComment: false,
            });
        }

        return data;
    }

    /**
     * Get comments for a ticket
     */
    async getComments(ticketId: string): Promise<TicketComment[]> {
        const { data, error } = await supabase
            .from('ticket_comments')
            .select('*')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /** Thread placeholder for WhatsApp/MCP tickets (no comment table) */
    buildSupportTicketThread(ticket: Ticket): TicketComment[] {
        const items: TicketComment[] = [];
        if (ticket.description) {
            items.push({
                id: `${ticket.id}-desc`,
                ticket_id: ticket.id,
                user_id: 'system',
                content: ticket.description,
                created_at: ticket.created_at,
                is_internal: false,
            });
        }
        const note = ticket.metadata?.resolution_note as string | undefined;
        if (note) {
            items.push({
                id: `${ticket.id}-resolution`,
                ticket_id: ticket.id,
                user_id: 'system',
                content: note,
                created_at: ticket.updated_at,
                is_internal: true,
            });
        }
        return items;
    }

    /**
     * Assign a ticket to a user
     */
    async assign(ticketId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('tickets')
            .update({ assigned_to: userId, updated_at: new Date().toISOString() })
            .eq('id', ticketId);

        if (error) throw error;
    }

    private async dispatchNotification(
        event: 'created' | 'status_changed' | 'comment',
        ticket: Ticket,
        extras?: {
            customerEmail?: string;
            commentPreview?: string;
            isInternalComment?: boolean;
        }
    ): Promise<void> {
        try {
            await fetch('/api/tickets/notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event,
                    tenantId: ticket.tenant_id,
                    ticketId: ticket.id,
                    title: ticket.title,
                    description: ticket.description,
                    status: ticket.status,
                    priority: ticket.priority,
                    customerEmail: extras?.customerEmail,
                    commentPreview: extras?.commentPreview,
                    isInternalComment: extras?.isInternalComment,
                }),
            });
        } catch (error) {
            console.error('Failed to dispatch ticket notification:', error);
        }
    }

    /**
     * Get tenant ID from the authenticated user's JWT
     */
    private async getTenantId(): Promise<string> {
        const cached = tenantService.getCurrentTenantId();
        if (cached) return cached;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const { data } = await supabase
            .from('tenant_users')
            .select('tenant_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle();

        if (data?.tenant_id) {
            return data.tenant_id;
        }

        throw new Error('No active workspace selected');
    }
}

export const ticketService = new TicketService();
