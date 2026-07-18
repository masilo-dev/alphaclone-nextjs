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
    sla_due_at?: string;
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
        const tenantId = await this.getTenantId();
        const response = await fetch('/api/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, title: input.title, description: input.description, priority: input.priority, source: input.source, sourceId: input.source_id, sourceName: input.source_name, assignedTo: input.assigned_to, tags: input.tags, metadata: input.metadata, customerEmail: input.customerEmail }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ticket) throw new Error(payload.error || 'Ticket could not be created');
        const data = payload.ticket;

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

        const res = await fetch(`/api/tickets?tenantId=${encodeURIComponent(tenantId)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Tickets could not be loaded');
        let tickets = (data.tickets || []) as Ticket[];
        if (filters?.status) tickets = tickets.filter((t) => t.status === filters.status);
        if (filters?.priority) tickets = tickets.filter((t) => t.priority === filters.priority);
        if (filters?.source) tickets = tickets.filter((t) => t.source === filters.source);
        if (filters?.assignedTo) tickets = tickets.filter((t) => t.assigned_to === filters.assignedTo);
        return tickets;
    }

    /**
     * Update ticket status
     */
    async updateStatus(ticketId: string, status: TicketStatus, origin: 'tickets' | 'support_tickets' = 'tickets'): Promise<void> {
        const tenantId = await this.getTenantId();

        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, origin, status }) });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'Failed to update ticket');
        if (origin === 'support_tickets') return;
        const ticket = result.ticket;
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

        const res = await fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, origin, priority }) });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || 'Failed to update priority');
    }

    /**
     * Add a comment to a ticket
     */
    async addComment(ticketId: string, content: string, isInternal: boolean = false): Promise<TicketComment> {
        const tenantId = await this.getTenantId();
        const response = await fetch(`/api/tickets/${ticketId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId, content, isInternal }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.comment) throw new Error(payload.error || 'Ticket comment could not be added');
        const data = payload.comment;
        const ticket = payload.ticket;
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
