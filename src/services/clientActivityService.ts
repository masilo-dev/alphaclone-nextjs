import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface ClientActivity {
    id: string;
    client_id: string;
    activity_type: 'message' | 'call' | 'meeting' | 'contract' | 'payment' | 'project_update' | 'file_upload' | 'note' | 'invoice';
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
                .select('name, email, tenant_id')
                .eq('id', clientId)
                .single();

            if (!client) {
                return { timeline: null, error: 'Client not found' };
            }

            // Get all activities from various sources
            const [messages, unifiedMessages, emailLogs, meetings, contracts, payments, projects, files, notes, crmActivities, portalEvents] = await Promise.all([
                this.getClientMessages(clientId),
                this.getClientUnifiedMessages(clientId, client.email),
                this.getClientEmailLogs(clientId, client.email),
                this.getClientMeetings(clientId),
                this.getClientContracts(clientId),
                this.getClientPayments(clientId),
                this.getClientProjects(clientId),
                this.getClientFiles(clientId),
                this.getClientNotes(clientId),
                this.getCrmUnifiedActivities(clientId, client.tenant_id),
                this.getClientPortalEvents(clientId),
            ]);

            // Combine all activities
            const activities: ClientActivity[] = [
                ...messages,
                ...unifiedMessages,
                ...emailLogs,
                ...meetings,
                ...contracts,
                ...payments,
                ...projects,
                ...files,
                ...notes,
                ...crmActivities,
                ...portalEvents,
            ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            // Calculate stats
            const stats = {
                total_messages: messages.length + unifiedMessages.length + emailLogs.length,
                total_calls: meetings.filter(m => m.activity_type === 'call').length,
                total_meetings: meetings.filter(m => m.activity_type === 'meeting').length,
                total_payments: payments.filter(p => p.activity_type === 'payment').length,
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
     * Get client payments and invoices
     */
    private async getClientPayments(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('invoices')
            .select('*')
            .eq('user_id', clientId)
            .order('created_at', { ascending: false });

        return (data || []).map((invoice: any) => {
            const isPaid = invoice.status === 'paid';
            return {
                id: invoice.id,
                client_id: clientId,
                activity_type: (isPaid ? 'payment' : 'invoice') as any,
                title: isPaid 
                    ? `Payment received: $${invoice.amount.toLocaleString()}` 
                    : `Invoice ${invoice.status.toUpperCase()}: $${invoice.amount.toLocaleString()}`,
                description: `${invoice.description || 'No description'}. Due: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}`,
                metadata: {
                    invoice_id: invoice.id,
                    amount: invoice.amount,
                    currency: invoice.currency,
                    status: invoice.status,
                    due_date: invoice.due_date,
                },
                created_at: isPaid ? (invoice.paid_at || invoice.created_at) : invoice.created_at,
            };
        });
    }

    private async getClientNotes(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('client_notes')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false });

        return (data || []).map((note: any) => ({
            id: note.id,
            client_id: clientId,
            activity_type: 'note' as const,
            title: note.title || 'Note added',
            description: note.description,
            metadata: {
                note_id: note.id,
                created_by: note.created_by,
            },
            created_at: note.created_at,
            created_by: note.created_by,
        }));
    }

    private async getClientUnifiedMessages(clientId: string, email?: string): Promise<ClientActivity[]> {
        let query = supabase
            .from('unified_messages')
            .select('*');

        if (email) {
            query = query.or(`contact_id.eq.${clientId},from_address.eq.${email},to_address.eq.${email}`);
        } else {
            query = query.eq('contact_id', clientId);
        }

        const { data } = await query
            .order('created_at', { ascending: false })
            .limit(50);

        return (data || []).map((msg: any) => {
            const channelIcon = msg.channel === 'email' ? '✉️' : msg.channel === 'chat' ? '💬' : msg.channel === 'sms' ? '📱' : '📞';
            const dir = msg.direction === 'inbound' ? 'Received' : 'Sent';
            const sourceStr = msg.source ? `via ${msg.source.toUpperCase()}` : '';
            return {
                id: msg.id,
                client_id: clientId,
                activity_type: 'message' as const,
                title: `${channelIcon} ${dir} message ${sourceStr}: ${msg.subject || '(No Subject)'}`,
                description: msg.body?.substring(0, 200) + (msg.body?.length > 200 ? '...' : ''),
                metadata: {
                    message_id: msg.id,
                    direction: msg.direction,
                    channel: msg.channel,
                    source: msg.source,
                    from: msg.from_address,
                    to: msg.to_address,
                    sent_at: msg.sent_at || msg.created_at,
                },
                created_at: msg.created_at || msg.sent_at || msg.received_at,
            };
        });
    }

    private async getClientEmailLogs(clientId: string, email?: string): Promise<ClientActivity[]> {
        if (!email) return [];
        const { data } = await supabase
            .from('email_logs')
            .select('*')
            .or(`user_id.eq.${clientId},to_email.eq.${email}`)
            .order('created_at', { ascending: false })
            .limit(50);

        return (data || []).map((log: any) => ({
            id: log.id,
            client_id: clientId,
            activity_type: 'message' as const,
            title: `✉️ Sent Platform Email: ${log.subject || 'No Subject'}`,
            description: `Status: ${log.status}. Template: ${log.template_name || 'Generic'}. Provider: ${log.provider}`,
            metadata: {
                log_id: log.id,
                status: log.status,
                provider: log.provider,
                subject: log.subject,
                error: log.error,
            },
            created_at: log.created_at,
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

    private async getCrmUnifiedActivities(clientId: string, tenantId: string): Promise<ClientActivity[]> {
        const { data: client } = await supabase
            .from('business_clients')
            .select('crm_contact_id, email, company')
            .eq('id', clientId)
            .maybeSingle();

        let contactId = client?.crm_contact_id as string | null;
        if (!contactId && client?.email) {
            const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('email', client.email)
                .limit(1)
                .maybeSingle();
            contactId = contact?.id || null;
        }

        const queries = [];
        if (contactId) {
            queries.push(
                supabase
                    .from('activities')
                    .select('id, type, subject, description, created_at, created_by')
                    .eq('tenant_id', tenantId)
                    .eq('contact_id', contactId)
                    .order('created_at', { ascending: false })
                    .limit(30)
            );
        }

        const companyName = client?.company;
        if (companyName) {
            const { data: company } = await supabase
                .from('companies')
                .select('id')
                .eq('tenant_id', tenantId)
                .ilike('name', companyName)
                .limit(1)
                .maybeSingle();
            if (company?.id) {
                queries.push(
                    supabase
                        .from('activities')
                        .select('id, type, subject, description, created_at, created_by')
                        .eq('tenant_id', tenantId)
                        .eq('company_id', company.id)
                        .order('created_at', { ascending: false })
                        .limit(30)
                );
            }
        }

        const results = await Promise.all(queries);
        const rows = results.flatMap((r) => r.data || []);

        return rows.map((row: any) => ({
            id: row.id,
            client_id: clientId,
            activity_type: 'note' as const,
            title: row.subject || row.type || 'CRM activity',
            description: row.description,
            metadata: { crm_type: row.type },
            created_at: row.created_at,
            created_by: row.created_by,
        }));
    }

    private async getClientPortalEvents(clientId: string): Promise<ClientActivity[]> {
        const { data } = await supabase
            .from('client_portal_events')
            .select('id, event_type, metadata, created_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })
            .limit(30);

        return (data || []).map((event: any) => ({
            id: event.id,
            client_id: clientId,
            activity_type: 'project_update' as const,
            title: event.event_type === 'portal_message_sent' ? 'Client portal message' : 'Portal update',
            description: typeof event.metadata?.author_name === 'string' ? `From ${event.metadata.author_name}` : undefined,
            metadata: event.metadata || {},
            created_at: event.created_at,
        }));
    }
}

export const clientActivityService = new ClientActivityService();
