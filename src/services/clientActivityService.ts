import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface ClientActivity {
    id: string;
    client_id: string;
    activity_type: 'message' | 'call' | 'meeting' | 'contract' | 'payment' | 'project_update' | 'file_upload' | 'note';
    title: string;
    description?: string;
    metadata?: any;
    created_at: string;
    created_by?: string;
}

export interface ClientTimeline {
    client_id: string;
    client_name: string;
    activities: ClientActivity[];
    stats: {
        total_messages: number;
        total_calls: number;
        total_meetings: number;
        total_payments: number;
        last_contact: string | null;
        response_time_avg: number; // in hours
    };
}

class ClientActivityService {
    /**
     * Get complete activity timeline for a client
     */
    async getClientTimeline(clientId: string): Promise<{ timeline: ClientTimeline | null; error?: string }> {
        try {
            // Get client info
            const { data: client } = await supabase
                .from('business_clients')
                .select('name')
                .eq('id', clientId)
                .single();

            if (!client) {
                return { timeline: null, error: 'Client not found' };
            }

            // Get all activities from various sources
            const [messages, meetings, contracts, payments, projects, files] = await Promise.all([
                this.getClientMessages(clientId),
                this.getClientMeetings(clientId),
                this.getClientContracts(clientId),
                this.getClientPayments(clientId),
                this.getClientProjects(clientId),
                this.getClientFiles(clientId),
            ]);

            // Combine all activities
            const activities: ClientActivity[] = [
                ...messages,
                ...meetings,
                ...contracts,
                ...payments,
                ...projects,
                ...files,
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Calculate stats
            const stats = {
                total_messages: messages.length,
                total_calls: meetings.filter(m => m.activity_type === 'call').length,
                total_meetings: meetings.filter(m => m.activity_type === 'meeting').length,
                total_payments: payments.length,
                last_contact: activities.length > 0 ? activities[0].created_at : null,
                response_time_avg: await this.calculateAvgResponseTime(clientId),
            };

            return {
                timeline: {
                    client_id: clientId,
                    client_name: client.name,
                    activities,
                    stats,
                },
            };
        } catch (error) {
            console.error('Error fetching client timeline:', error);
            return { timeline: null, error: String(error) };
        }
    }

    /**
     * Get client messages
     */
    private async getClientMessages(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${clientId},recipient_id.eq.${clientId}`)
            .order('created_at', { ascending: false })
            .limit(50);

        return (data || []).map((msg: any) => ({
            id: msg.id,
            client_id: clientId,
            activity_type: 'message' as const,
            title: msg.sender_id === clientId ? 'Client sent message' : 'Admin sent message',
            description: msg.text?.substring(0, 100) + (msg.text?.length > 100 ? '...' : ''),
            metadata: {
                message_id: msg.id,
                sender_id: msg.sender_id,
                priority: msg.priority,
                has_attachments: msg.attachments?.length > 0,
            },
            created_at: msg.created_at,
            created_by: msg.sender_id,
        }));
    }

    /**
     * Get client meetings
     */
    private async getClientMeetings(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('calendar_events')
            .select('*')
            .or(`user_id.eq.${clientId},attendees.cs.{${clientId}}`)
            .order('start_time', { ascending: false })
            .limit(20);

        return (data || []).map((event: any) => ({
            id: event.id,
            client_id: clientId,
            activity_type: 'meeting' as const,
            title: event.title || 'Meeting scheduled',
            description: event.description,
            metadata: {
                event_id: event.id,
                start_time: event.start_time,
                end_time: event.end_time,
                meeting_link: event.meeting_link,
            },
            created_at: event.created_at,
            created_by: event.user_id,
        }));
    }

    /**
     * Get client contracts
     */
    private async getClientContracts(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('contracts')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        return (data || []).map((contract: any) => ({
            id: contract.id,
            client_id: clientId,
            activity_type: 'contract' as const,
            title: `Contract ${contract.status}`,
            description: contract.status === 'signed' ? 'Contract signed by client' : `Contract ${contract.status}`,
            metadata: {
                contract_id: contract.id,
                status: contract.status,
                signed_at: contract.signed_at,
            },
            created_at: contract.signed_at || contract.created_at,
            created_by: contract.admin_id,
        }));
    }

    /**
     * Get client payments
     */
    private async getClientPayments(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('invoices')
            .select('*')
            .eq('user_id', clientId)
            .eq('status', 'paid')
            .order('paid_at', { ascending: false });

        return (data || []).map((invoice: any) => ({
            id: invoice.id,
            client_id: clientId,
            activity_type: 'payment' as const,
            title: `Payment received: $${invoice.amount.toLocaleString()}`,
            description: invoice.description,
            metadata: {
                invoice_id: invoice.id,
                amount: invoice.amount,
                currency: invoice.currency,
            },
            created_at: invoice.paid_at || invoice.created_at,
        }));
    }

    /**
     * Get client projects
     */
    private async getClientProjects(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('projects')
            .select('*')
            .eq('owner_id', clientId)
            .order('created_at', { ascending: false });

        return (data || []).map((project: any) => ({
            id: project.id,
            client_id: clientId,
            activity_type: 'project_update' as const,
            title: `Project: ${project.name}`,
            description: `Status: ${project.status}, Stage: ${project.current_stage}`,
            metadata: {
                project_id: project.id,
                status: project.status,
                stage: project.current_stage,
                progress: project.progress,
            },
            created_at: project.updated_at || project.created_at,
        }));
    }

    /**
     * Get client file uploads
     */
    private async getClientFiles(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('file_uploads')
            .select('*')
            .eq('user_id', clientId)
            .order('created_at', { ascending: false })
            .limit(20);

        return (data || []).map((file: any) => ({
            id: file.id,
            client_id: clientId,
            activity_type: 'file_upload' as const,
            title: `Uploaded: ${file.original_filename}`,
            description: `File type: ${file.file_type}, Size: ${(file.file_size / 1024).toFixed(2)} KB`,
            metadata: {
                file_id: file.id,
                filename: file.original_filename,
                file_type: file.file_type,
                file_size: file.file_size,
            },
            created_at: file.created_at,
            created_by: clientId,
        }));
    }

    /**
     * Calculate average response time
     */
    private async calculateAvgResponseTime(clientId: string): Promise<number> {
        const { data: messages } = await supabase
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${clientId},recipient_id.eq.${clientId}`)
            .order('created_at', { ascending: true })
            .limit(100);

        if (!messages || messages.length < 2) return 0;

        let totalResponseTime = 0;
        let responseCount = 0;

        for (let i = 0; i < messages.length - 1; i++) {
            const current = messages[i];
            const next = messages[i + 1];

            // If client sent message and admin responded
            if (current.sender_id === clientId && next.sender_id !== clientId) {
                const responseTime = new Date(next.created_at).getTime() - new Date(current.created_at).getTime();
                totalResponseTime += responseTime;
                responseCount++;
            }
        }

        if (responseCount === 0) return 0;

        // Return average in hours
        return totalResponseTime / responseCount / (1000 * 60 * 60);
    }

    /**
     * Add manual note to client timeline
     */
    async addClientNote(
        clientId: string,
        title: string,
        description: string,
        createdBy: string
    ): Promise<{ activity: ClientActivity | null; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('client_notes')
                .insert({
                    client_id: clientId,
                    title,
                    description,
                    created_by: createdBy,
                })
                .select()
                .single();

            if (error) {
                return { activity: null, error: error.message };
            }

            // Audit log
            auditLoggingService.logAction(
                'client_note_added',
                'client_note',
                data.id,
                undefined,
                { client_id: clientId, title }
            ).catch(err => console.error('Failed to log audit:', err));

            return {
                activity: {
                    id: data.id,
                    client_id: clientId,
                    activity_type: 'note',
                    title,
                    description,
                    created_at: data.created_at,
                    created_by: createdBy,
                },
            };
        } catch (error) {
            return { activity: null, error: String(error) };
        }
    }

    /**
     * Get client communication stats
     */
    async getClientStats(clientId: string) {
        const { timeline } = await this.getClientTimeline(clientId);
        return timeline?.stats || null;
    }
}

export const clientActivityService = new ClientActivityService();
