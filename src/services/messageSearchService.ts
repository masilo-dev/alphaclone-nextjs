import { supabase } from '../lib/supabase';

export interface MessageSearchFilters {
    query?: string;
    senderId?: string;
    recipientId?: string;
    priority?: 'normal' | 'high' | 'urgent';
    hasAttachments?: boolean;
    dateFrom?: Date;
    dateTo?: Date;
    unreadOnly?: boolean;
}

export interface MessageSearchResult {
    id: string;
    sender_id: string;
    recipient_id: string;
    text: string;
    priority: string;
    attachments: any[];
    created_at: string;
    read_at?: string;
    sender_name?: string;
    recipient_name?: string;
    highlight?: string; // Highlighted search match
}

class MessageSearchService {
    /**
     * Search messages with advanced filters
     */
    async searchMessages(
        userId: string,
        userRole: string,
        filters: MessageSearchFilters,
        limit: number = 50
    ): Promise<{ messages: MessageSearchResult[]; error?: string }> {
        try {
            let query = supabase
                .from('messages')
                .select(`
          *,
          sender:sender_id(name),
          recipient:recipient_id(name)
        `);

            // Role-based filtering (RLS handles this at DB level, but we add for clarity)
            if (userRole !== 'admin') {
                query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
            }

            // Text search
            if (filters.query) {
                query = query.ilike('text', `%${filters.query}%`);
            }

            // Sender filter
            if (filters.senderId) {
                query = query.eq('sender_id', filters.senderId);
            }

            // Recipient filter
            if (filters.recipientId) {
                query = query.eq('recipient_id', filters.recipientId);
            }

            // Priority filter
            if (filters.priority) {
                query = query.eq('priority', filters.priority);
            }

            // Attachments filter
            if (filters.hasAttachments !== undefined) {
                if (filters.hasAttachments) {
                    query = query.not('attachments', 'is', null);
                } else {
                    query = query.is('attachments', null);
                }
            }

            // Date range filter
            if (filters.dateFrom) {
                query = query.gte('created_at', filters.dateFrom.toISOString());
            }
            if (filters.dateTo) {
                query = query.lte('created_at', filters.dateTo.toISOString());
            }

            // Unread filter
            if (filters.unreadOnly) {
                query = query.is('read_at', null);
            }

            // Order and limit
            query = query.order('created_at', { ascending: false }).limit(limit);

            const { data, error } = await query;

            if (error) {
                return { messages: [], error: error.message };
            }

            // Format results with highlights
            const messages: MessageSearchResult[] = (data || []).map((msg: any) => ({
                id: msg.id,
                sender_id: msg.sender_id,
                recipient_id: msg.recipient_id,
                text: msg.text,
                priority: msg.priority,
                attachments: msg.attachments || [],
                created_at: msg.created_at,
                read_at: msg.read_at,
                sender_name: msg.sender?.name,
                recipient_name: msg.recipient?.name,
                highlight: this.highlightMatch(msg.text, filters.query),
            }));

            return { messages };
        } catch (error) {
            console.error('Message search error:', error);
            return { messages: [], error: String(error) };
        }
    }

    /**
     * Get message statistics
     */
    async getMessageStats(userId: string, userRole: string) {
        try {
            let query = supabase.from('messages').select('*', { count: 'exact' });

            if (userRole !== 'admin') {
                query = query.or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);
            }

            const [total, unread, highPriority] = await Promise.all([
                query,
                query.is('read_at', null),
                query.eq('priority', 'high'),
            ]);

            return {
                total: total.count || 0,
                unread: unread.count || 0,
                highPriority: highPriority.count || 0,
            };
        } catch (error) {
            console.error('Message stats error:', error);
            return { total: 0, unread: 0, highPriority: 0 };
        }
    }

    /**
     * Mark messages as read
     */
    async markAsRead(messageIds: string[]): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .in('id', messageIds);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Archive messages
     */
    async archiveMessages(messageIds: string[]): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('messages')
                .update({ archived: true })
                .in('id', messageIds);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get conversation thread
     */
    async getConversationThread(
        userId1: string,
        userId2: string,
        limit: number = 100
    ): Promise<{ messages: MessageSearchResult[]; error?: string }> {
        try {
            const { data, error } = await supabase
                .from('messages')
                .select(`
          *,
          sender:sender_id(name),
          recipient:recipient_id(name)
        `)
                .or(
                    `and(sender_id.eq.${userId1},recipient_id.eq.${userId2}),and(sender_id.eq.${userId2},recipient_id.eq.${userId1})`
                )
                .order('created_at', { ascending: true })
                .limit(limit);

            if (error) {
                return { messages: [], error: error.message };
            }

            const messages: MessageSearchResult[] = (data || []).map((msg: any) => ({
                id: msg.id,
                sender_id: msg.sender_id,
                recipient_id: msg.recipient_id,
                text: msg.text,
                priority: msg.priority,
                attachments: msg.attachments || [],
                created_at: msg.created_at,
                read_at: msg.read_at,
                sender_name: msg.sender?.name,
                recipient_name: msg.recipient?.name,
            }));

            return { messages };
        } catch (error) {
            return { messages: [], error: String(error) };
        }
    }

    /**
     * Highlight search query in text
     */
    private highlightMatch(text: string, query?: string): string {
        if (!query || !text) return text;

        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
}

export const messageSearchService = new MessageSearchService();
