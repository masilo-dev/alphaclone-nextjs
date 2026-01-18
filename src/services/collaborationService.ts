import { supabase } from '../lib/supabase';

export interface CollaborationDocument {
    id: string;
    title: string;
    content: string;
    type: 'document' | 'whiteboard' | 'note';
    projectId?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
    participants: string[];
    version: number;
}

export interface CursorPosition {
    userId: string;
    userName: string;
    position: number;
    color: string;
}

export interface CollaborationChange {
    type: 'insert' | 'delete' | 'format';
    position: number;
    length: number;
    content?: string;
    author: string;
    timestamp: string;
}

export const collaborationService = {
    /**
     * Create a new collaboration document
     */
    async createDocument(
        title: string,
        type: 'document' | 'whiteboard' | 'note',
        projectId?: string,
        userId?: string
    ): Promise<{ document: CollaborationDocument | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('collaboration_documents')
                .insert({
                    title,
                    type,
                    project_id: projectId,
                    content: '',
                    created_by: userId,
                    participants: userId ? [userId] : [],
                    version: 1,
                })
                .select()
                .single();

            if (error) throw error;

            return {
                document: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    type: data.type,
                    projectId: data.project_id,
                    createdBy: data.created_by,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    participants: data.participants || [],
                    version: data.version,
                },
                error: null,
            };
        } catch (error) {
            return {
                document: null,
                error: error instanceof Error ? error.message : 'Failed to create document',
            };
        }
    },

    /**
     * Get document with real-time updates
     */
    async getDocument(documentId: string): Promise<{ document: CollaborationDocument | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('collaboration_documents')
                .select('*')
                .eq('id', documentId)
                .single();

            if (error) throw error;

            return {
                document: {
                    id: data.id,
                    title: data.title,
                    content: data.content,
                    type: data.type,
                    projectId: data.project_id,
                    createdBy: data.created_by,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                    participants: data.participants || [],
                    version: data.version,
                },
                error: null,
            };
        } catch (error) {
            return {
                document: null,
                error: error instanceof Error ? error.message : 'Failed to fetch document',
            };
        }
    },

    /**
     * Subscribe to document changes
     */
    subscribeToDocument(
        documentId: string,
        onUpdate: (document: CollaborationDocument) => void,
        onCursor: (cursors: CursorPosition[]) => void
    ) {
        const channel = supabase.channel(`doc:${documentId}`);

        // Subscribe to document updates
        channel
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'collaboration_documents',
                    filter: `id=eq.${documentId}`,
                },
                (payload) => {
                    const doc = payload.new as any;
                    onUpdate({
                        id: doc.id,
                        title: doc.title,
                        content: doc.content,
                        type: doc.type,
                        projectId: doc.project_id,
                        createdBy: doc.created_by,
                        createdAt: doc.created_at,
                        updatedAt: doc.updated_at,
                        participants: doc.participants || [],
                        version: doc.version,
                    });
                }
            )
            .on('broadcast', { event: 'cursor' }, (payload) => {
                onCursor(payload.payload.cursors || []);
            })
            .subscribe();

        return {
            unsubscribe: () => {
                supabase.removeChannel(channel);
            },
            sendCursor: (cursor: CursorPosition) => {
                channel.send({
                    type: 'broadcast',
                    event: 'cursor',
                    payload: { cursor },
                });
            },
        };
    },

    /**
     * Update document content (with conflict resolution)
     */
    async updateDocument(
        documentId: string,
        content: string,
        userId: string
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            // Get current version
            const { data: current } = await supabase
                .from('collaboration_documents')
                .select('version, participants')
                .eq('id', documentId)
                .single();

            if (!current) {
                return { success: false, error: 'Document not found' };
            }

            // Update document
            const { error } = await supabase
                .from('collaboration_documents')
                .update({
                    content,
                    version: current.version + 1,
                    updated_at: new Date().toISOString(),
                    participants: Array.from(new Set([...(current.participants || []), userId])),
                })
                .eq('id', documentId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to update document',
            };
        }
    },

    /**
     * Add comment to document
     */
    async addComment(
        documentId: string,
        comment: string,
        userId: string,
        position?: number
    ): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('document_comments').insert({
                document_id: documentId,
                user_id: userId,
                comment,
                position,
                created_at: new Date().toISOString(),
            });

            if (error) throw error;

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to add comment',
            };
        }
    },

    /**
     * Get document version history
     */
    async getVersionHistory(documentId: string): Promise<{ versions: any[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('document_versions')
                .select('*')
                .eq('document_id', documentId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            return { versions: data || [], error: null };
        } catch (error) {
            return {
                versions: [],
                error: error instanceof Error ? error.message : 'Failed to fetch version history',
            };
        }
    },
};

