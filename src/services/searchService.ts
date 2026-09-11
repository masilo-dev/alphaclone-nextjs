import { supabase } from '../lib/supabase';

export interface SearchFilters {
    type?: ('project' | 'message' | 'invoice' | 'contract' | 'document' | 'campaign' | 'user' | 'all')[];
    dateFrom?: Date;
    dateTo?: Date;
    status?: string[];
    tags?: string[];
}

export interface SearchResult {
    type: 'project' | 'message' | 'invoice' | 'contract' | 'document' | 'campaign' | 'user';
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    link: string;
    metadata?: Record<string, any>;
    relevance: number;
}

export const searchService = {
    /**
     * Advanced full-text search across all entities
     */
    async search(
        query: string,
        userId: string,
        userRole: 'admin' | 'client',
        filters?: SearchFilters,
        tenantId?: string
    ): Promise<{ results: SearchResult[]; error: string | null }> {
        if (!query.trim()) {
            return { results: [], error: null };
        }

        try {
            const searchTerm = query.toLowerCase().trim();
            const results: SearchResult[] = [];
            if (!tenantId) return { results: [], error: 'Active workspace required' };

            // Search projects
            if (!filters?.type || filters.type.includes('project') || filters.type.includes('all')) {
                let projectQuery = supabase
                    .from('projects')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);

                if (userRole !== 'admin') {
                    projectQuery = projectQuery.eq('owner_id', userId);
                }

                if (filters?.status) {
                    projectQuery = projectQuery.in('status', filters.status);
                }

                if (filters?.dateFrom) {
                    projectQuery = projectQuery.gte('created_at', filters.dateFrom.toISOString());
                }

                if (filters?.dateTo) {
                    projectQuery = projectQuery.lte('created_at', filters.dateTo.toISOString());
                }

                const { data: projects } = await projectQuery.limit(20);

                (projects || []).forEach((project: any) => {
                    const relevance = this.calculateRelevance(searchTerm, [
                        project.name,
                        project.description,
                        project.category,
                    ]);

                    results.push({
                        type: 'project',
                        id: project.id,
                        title: project.name,
                        subtitle: project.category,
                        description: project.description,
                        link: '/dashboard/projects',
                        metadata: {
                            status: project.status,
                            progress: project.progress,
                            currentStage: project.current_stage,
                        },
                        relevance,
                    });
                });
            }

            // Search messages
            if (!filters?.type || filters.type.includes('message') || filters.type.includes('all')) {
                let messageQuery = supabase
                    .from('messages')
                    .select('*, sender:profiles!sender_id(name), recipient:profiles!recipient_id(name)')
                    .eq('tenant_id', tenantId)
                    .ilike('text', `%${searchTerm}%`);

                if (userRole !== 'admin') {
                    messageQuery = messageQuery.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
                }

                if (filters?.dateFrom) {
                    messageQuery = messageQuery.gte('created_at', filters.dateFrom.toISOString());
                }

                if (filters?.dateTo) {
                    messageQuery = messageQuery.lte('created_at', filters.dateTo.toISOString());
                }

                const { data: messages } = await messageQuery.order('created_at', { ascending: false }).limit(20);

                (messages || []).forEach((message: any) => {
                    const relevance = this.calculateRelevance(searchTerm, [message.text]);

                    results.push({
                        type: 'message',
                        id: message.id,
                        title: message.text.substring(0, 80) + (message.text.length > 80 ? '...' : ''),
                        subtitle: `From ${message.sender?.name || message.sender_name}`,
                        description: message.text,
                        link: '/dashboard/messages',
                        metadata: {
                            timestamp: message.created_at,
                            priority: message.priority,
                        },
                        relevance,
                    });
                });
            }

            // Search canonical business invoices
            if (!filters?.type || filters.type.includes('invoice') || filters.type.includes('all')) {
                let invoiceQuery = supabase
                    .from('business_invoices')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .or(`invoice_number.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);

                if (filters?.status) {
                    invoiceQuery = invoiceQuery.in('status', filters.status);
                }

                if (filters?.dateFrom) {
                    invoiceQuery = invoiceQuery.gte('created_at', filters.dateFrom.toISOString());
                }

                if (filters?.dateTo) {
                    invoiceQuery = invoiceQuery.lte('created_at', filters.dateTo.toISOString());
                }

                const { data: invoices } = await invoiceQuery.limit(20);

                (invoices || []).forEach((invoice: any) => {
                    const relevance = this.calculateRelevance(searchTerm, [
                        invoice.id,
                        invoice.invoice_number,
                        invoice.notes,
                    ]);

                    results.push({
                        type: 'invoice',
                        id: invoice.id,
                        title: invoice.invoice_number || `Invoice #${invoice.id.substring(0, 8).toUpperCase()}`,
                        subtitle: `${invoice.currency || 'USD'} ${Number(invoice.total || 0).toLocaleString()} - ${invoice.lifecycle_status || invoice.status}`,
                        description: invoice.notes,
                        link: `/dashboard/business/billing/manage?invoiceId=${invoice.id}`,
                        metadata: {
                            amount: invoice.total,
                            status: invoice.status,
                            dueDate: invoice.due_date,
                        },
                        relevance,
                    });
                });
            }

            if (!filters?.type || filters.type.includes('contract') || filters.type.includes('all')) {
                const { data: contracts } = await supabase.from('contracts').select('id, title, content, status, lifecycle_status, updated_at')
                    .eq('tenant_id', tenantId).or(`title.ilike.%${searchTerm}%,content.ilike.%${searchTerm}%`).limit(20);
                (contracts || []).forEach((contract: any) => results.push({ type: 'contract', id: contract.id, title: contract.title, subtitle: String(contract.lifecycle_status || contract.status).replaceAll('_',' '), description: String(contract.content || '').replace(/<[^>]+>/g,' ').slice(0,220), link: `/dashboard/business/contracts?contractId=${contract.id}`, metadata: { status: contract.status }, relevance: this.calculateRelevance(searchTerm, [contract.title, contract.content]) }));
            }

            if (!filters?.type || filters.type.includes('document') || filters.type.includes('all')) {
                const { data: documents } = await supabase.from('documents').select('id, name, title, summary, extracted_text, document_type, intelligence_status')
                    .eq('tenant_id', tenantId).is('deleted_at', null).or(`name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,extracted_text.ilike.%${searchTerm}%`).limit(20);
                (documents || []).forEach((document: any) => results.push({ type: 'document', id: document.id, title: document.title || document.name || 'Document', subtitle: document.document_type || 'Document', description: document.summary || String(document.extracted_text || '').slice(0,220), link: `/dashboard/business/documents?documentId=${document.id}`, metadata: { intelligenceStatus: document.intelligence_status }, relevance: this.calculateRelevance(searchTerm, [document.title, document.name, document.summary, document.extracted_text]) }));
            }

            if (!filters?.type || filters.type.includes('campaign') || filters.type.includes('all')) {
                const [campaignResult, sequenceResult] = await Promise.all([
                    supabase.from('email_campaigns').select('id, name, subject, status').eq('tenant_id', tenantId).or(`name.ilike.%${searchTerm}%,subject.ilike.%${searchTerm}%`).limit(20),
                    supabase.from('outreach_sequences').select('id, name, status, timezone').eq('tenant_id', tenantId).ilike('name', `%${searchTerm}%`).limit(20),
                ]);
                (campaignResult.data || []).forEach((campaign: any) => results.push({ type: 'campaign', id: campaign.id, title: campaign.name, subtitle: campaign.subject || campaign.status, description: `Campaign · ${campaign.status}`, link: `/dashboard/outreach?campaignId=${campaign.id}`, metadata: { status: campaign.status }, relevance: this.calculateRelevance(searchTerm, [campaign.name, campaign.subject]) }));
                (sequenceResult.data || []).forEach((sequence: any) => results.push({ type: 'campaign', id: sequence.id, title: sequence.name, subtitle: `${sequence.status} · ${sequence.timezone}`, description: 'Multi-channel outreach sequence', link: `/dashboard/outreach?sequenceId=${sequence.id}`, metadata: { status: sequence.status }, relevance: this.calculateRelevance(searchTerm, [sequence.name]) }));
            }

            // Search users (admin only)
            if (userRole === 'admin' && (!filters?.type || filters.type.includes('user') || filters.type.includes('all'))) {
                const { data: users } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
                    .limit(20);

                (users || []).forEach((user: any) => {
                    const relevance = this.calculateRelevance(searchTerm, [user.name, user.email]);

                    results.push({
                        type: 'user',
                        id: user.id,
                        title: user.name,
                        subtitle: user.email,
                        description: user.role,
                        link: '/dashboard/clients',
                        metadata: {
                            role: user.role,
                            avatar: user.avatar,
                        },
                        relevance,
                    });
                });
            }

            // Sort by relevance
            results.sort((a, b) => b.relevance - a.relevance);

            return { results: results.slice(0, 50), error: null };
        } catch (error) {
            return {
                results: [],
                error: error instanceof Error ? error.message : 'Search failed',
            };
        }
    },

    /**
     * Calculate search relevance score
     */
    calculateRelevance(query: string, fields: (string | null | undefined)[]): number {
        let score = 0;
        const queryLower = query.toLowerCase();

        fields.forEach((field) => {
            if (!field) return;

            const fieldLower = field.toLowerCase();

            // Exact match = highest score
            if (fieldLower === queryLower) {
                score += 100;
            }
            // Starts with query = high score
            else if (fieldLower.startsWith(queryLower)) {
                score += 50;
            }
            // Contains query = medium score
            else if (fieldLower.includes(queryLower)) {
                score += 25;
            }
            // Word match = lower score
            else {
                const words = fieldLower.split(/\s+/);
                words.forEach((word) => {
                    if (word.startsWith(queryLower)) {
                        score += 10;
                    } else if (word.includes(queryLower)) {
                        score += 5;
                    }
                });
            }
        });

        return score;
    },

    /**
     * Get search suggestions/autocomplete
     */
    async getSuggestions(
        partialQuery: string,
        userId: string,
        userRole: 'admin' | 'client'
    ): Promise<string[]> {
        if (partialQuery.length < 2) {
            return [];
        }

        try {
            const suggestions: Set<string> = new Set();
            const term = partialQuery.toLowerCase();

            // Get project name suggestions
            let projectQuery = supabase.from('projects').select('name').ilike('name', `%${term}%`).limit(5);
            if (userRole !== 'admin') {
                projectQuery = projectQuery.eq('owner_id', userId);
            }
            const { data: projects } = await projectQuery;
            (projects || []).forEach((p: any) => suggestions.add(p.name));

            // Get message text snippets
            let messageQuery = supabase
                .from('messages')
                .select('text')
                .ilike('text', `%${term}%`)
                .limit(5);
            if (userRole !== 'admin') {
                messageQuery = messageQuery.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
            }
            const { data: messages } = await messageQuery;
            (messages || []).forEach((m: any) => {
                const words = m.text.split(/\s+/);
                words.forEach((word: string) => {
                    if (word.toLowerCase().includes(term) && word.length > 3) {
                        suggestions.add(word);
                    }
                });
            });

            return Array.from(suggestions).slice(0, 10);
        } catch (error) {
            return [];
        }
    },

    /**
     * Save search query to history
     */
    async saveSearchHistory(userId: string, query: string, resultsCount: number): Promise<void> {
        try {
            await supabase.from('search_history').insert({
                user_id: userId,
                query,
                results_count: resultsCount,
                created_at: new Date().toISOString(),
            });
        } catch (error) {
            // Silently fail - search history is optional
        }
    },

    /**
     * Get search history for user
     */
    async getSearchHistory(userId: string, limit: number = 10): Promise<string[]> {
        try {
            const { data } = await supabase
                .from('search_history')
                .select('query')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            return (data || []).map((item: any) => item.query);
        } catch (error) {
            return [];
        }
    },
};
