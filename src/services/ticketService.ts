/**
 * Ticket Service
 * Provides ticketing functionality across all modules
 * Supports creating, updating, and managing tickets linked to any entity
 */

import { supabase } from '@/lib/supabase/client';
import { emailService } from './email/emailService';

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
}

class TicketService {
    /**
     * Create a new ticket
     */
    async create(input: CreateTicketInput): Promise<Ticket> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Authentication required');

        const tenantId = this.getTenantId();

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
                metadata: input.metadata || {},
            })
            .select()
            .single();

        if (error) throw error;

        // Send notification email
        await this.sendTicketCreatedNotification(data);

        return data;
    }

    /**
     * Get tickets for a specific entity
     */
    async getBySource(source: TicketSource, sourceId: string): Promise<Ticket[]> {
        const tenantId = this.getTenantId();

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
        const tenantId = this.getTenantId();

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
        return data || [];
    }

    /**
     * Update ticket status
     */
    async updateStatus(ticketId: string, status: TicketStatus): Promise<void> {
        const updateData: Partial<Ticket> = { status, updated_at: new Date().toISOString() };

        if (status === 'resolved') updateData.resolved_at = new Date().toISOString();
        if (status === 'closed') updateData.closed_at = new Date().toISOString();

        const { error } = await supabase
            .from('tickets')
            .update(updateData)
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

    /**
     * Send notification when ticket is created
     */
    private async sendTicketCreatedNotification(ticket: Ticket): Promise<void> {
        try {
            await emailService.send({
                to: process.env.NOTIFICATION_EMAIL || 'support@alphaclone.com',
                subject: `New Ticket: ${ticket.title}`,
                html: `
                    <h2>New Ticket Created</h2>
                    <p><strong>Title:</strong> ${ticket.title}</p>
                    <p><strong>Source:</strong> ${ticket.source}</p>
                    <p><strong>Priority:</strong> ${ticket.priority}</p>
                    <p><strong>Description:</strong></p>
                    <p>${ticket.description}</p>
                    <p><a href="${process.env.APP_URL}/dashboard/tickets/${ticket.id}">View Ticket</a></p>
                `,
            });
        } catch (error) {
            console.error('Failed to send ticket notification:', error);
        }
    }

    /**
     * Get tenant ID
     */
    private getTenantId(): string {
        // This should be implemented based on your tenant resolution logic
        // For now, return a placeholder
        return 'default';
    }
}

export const ticketService = new TicketService();
