import { createSupabaseAdminClient } from '@/lib/supabase-admin';

export interface CreatePublicShareParams {
    tenantId: string;
    bucket: string;
    filePath: string;
    originalName?: string;
    createdBy?: string;
    expiresInHours?: number;
}

export interface PublicShareDetails {
    id: string;
    tenant_id: string;
    file_path: string;
    bucket: string;
    original_name: string | null;
    created_at: string;
    expires_at: string;
    created_by: string | null;
}

export const publicShareService = {
    /**
     * Create a public share for a document that expires in a given number of hours (default 48).
     */
    async createShare(params: CreatePublicShareParams) {
        const supabase = createSupabaseAdminClient();
        const expiresInHours = params.expiresInHours || 48;
        const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

        const { data, error } = await supabase
            .from('public_shares')
            .insert({
                tenant_id: params.tenantId,
                bucket: params.bucket,
                file_path: params.filePath,
                original_name: params.originalName || null,
                created_by: params.createdBy || null,
                expires_at: expiresAt,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating public share:', error);
            throw new Error(`Failed to create public share: ${error.message}`);
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://alphaclonesystems.com';
        
        return {
            shareId: data.id as string,
            url: `${baseUrl}/share/${data.id}`,
            expiresAt: data.expires_at as string,
        };
    },

    /**
     * Retrieve details of a public share, returning null if it does not exist or has expired.
     */
    async getShare(shareId: string): Promise<PublicShareDetails | null> {
        const supabase = createSupabaseAdminClient();
        
        const { data, error } = await supabase
            .from('public_shares')
            .select('*')
            .eq('id', shareId)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error || !data) {
            return null;
        }

        return data as PublicShareDetails;
    }
};
