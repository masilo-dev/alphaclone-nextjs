import { supabase } from '../lib/supabase';

/**
 * GDPR/CCPA Compliance Service
 * Handles data privacy rights: access, deletion, portability
 */

export interface ConsentRecord {
    id: string;
    consent_type: string;
    consent_given: boolean;
    consent_version: string;
    given_at: string;
    withdrawn_at?: string;
}

export interface DataExportRequest {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
    export_format: 'json' | 'csv' | 'pdf';
    file_url?: string;
    expires_at?: string;
    created_at: string;
}

export interface DataDeletionRequest {
    id: string;
    status: 'pending' | 'under_review' | 'approved' | 'processing' | 'completed' | 'rejected';
    reason?: string;
    scheduled_deletion_date?: string;
    created_at: string;
}

export const gdprComplianceService = {
    /**
     * Record user consent (GDPR requirement)
     */
    async recordConsent(
        userId: string,
        consentType: 'terms_of_service' | 'privacy_policy' | 'marketing' | 'analytics' | 'cookies',
        consentGiven: boolean,
        version: string,
        ipAddress?: string,
        userAgent?: string
    ): Promise<{ success: boolean; consentId?: string; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('record_consent', {
                p_user_id: userId,
                p_consent_type: consentType,
                p_consent_given: consentGiven,
                p_consent_version: version,
                p_ip_address: ipAddress,
                p_user_agent: userAgent,
            });

            if (error) throw error;

            return { success: true, consentId: data };
        } catch (error) {
            console.error('Error recording consent:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record consent',
            };
        }
    },

    /**
     * Get user's consent history
     */
    async getUserConsents(userId: string): Promise<ConsentRecord[]> {
        try {
            const { data, error } = await supabase
                .from('user_consents')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching consents:', error);
            return [];
        }
    },

    /**
     * Withdraw consent
     */
    async withdrawConsent(
        consentId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase
                .from('user_consents')
                .update({ withdrawn_at: new Date().toISOString() })
                .eq('id', consentId);

            if (error) throw error;

            return { success: true };
        } catch (error) {
            console.error('Error withdrawing consent:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to withdraw consent',
            };
        }
    },

    /**
     * Request data export (GDPR Right to Access)
     */
    async requestDataExport(
        userId: string,
        tenantId: string,
        format: 'json' | 'csv' | 'pdf' = 'json'
    ): Promise<{ success: boolean; requestId?: string; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('request_data_export', {
                p_user_id: userId,
                p_tenant_id: tenantId,
                p_export_format: format,
            });

            if (error) throw error;

            return { success: true, requestId: data };
        } catch (error) {
            console.error('Error requesting data export:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to request data export',
            };
        }
    },

    /**
     * Get data export requests
     */
    async getDataExportRequests(userId: string): Promise<DataExportRequest[]> {
        try {
            const { data, error } = await supabase
                .from('data_export_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching export requests:', error);
            return [];
        }
    },

    /**
     * Request data deletion (GDPR Right to Erasure)
     */
    async requestDataDeletion(
        userId: string,
        tenantId: string,
        reason?: string
    ): Promise<{ success: boolean; requestId?: string; error?: string }> {
        try {
            const { data, error } = await supabase.rpc('request_data_deletion', {
                p_user_id: userId,
                p_tenant_id: tenantId,
                p_reason: reason,
            });

            if (error) throw error;

            return { success: true, requestId: data };
        } catch (error) {
            console.error('Error requesting data deletion:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to request data deletion',
            };
        }
    },

    /**
     * Get data deletion requests
     */
    async getDataDeletionRequests(userId: string): Promise<DataDeletionRequest[]> {
        try {
            const { data, error } = await supabase
                .from('data_deletion_requests')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return data || [];
        } catch (error) {
            console.error('Error fetching deletion requests:', error);
            return [];
        }
    },

    /**
     * Export user data to JSON
     */
    async exportUserDataToJSON(userId: string): Promise<any> {
        try {
            // Fetch all user-related data
            const [profile, projects, contracts, messages] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', userId).single(),
                supabase.from('projects').select('*').eq('owner_id', userId),
                supabase.from('contracts').select('*').eq('user_id', userId),
                supabase.from('messages').select('*').eq('sender_id', userId),
            ]);

            return {
                export_date: new Date().toISOString(),
                user_id: userId,
                profile: profile.data,
                projects: projects.data || [],
                contracts: contracts.data || [],
                messages: messages.data || [],
            };
        } catch (error) {
            console.error('Error exporting user data:', error);
            throw error;
        }
    },

    /**
     * Get current privacy policy
     */
    async getCurrentPrivacyPolicy(): Promise<{ version: string; content: string; effective_date: string } | null> {
        try {
            const { data, error } = await supabase
                .from('privacy_policy_versions')
                .select('*')
                .eq('is_current', true)
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching privacy policy:', error);
            return null;
        }
    },

    /**
     * Get current terms of service
     */
    async getCurrentTermsOfService(): Promise<{ version: string; content: string; effective_date: string } | null> {
        try {
            const { data, error } = await supabase
                .from('terms_of_service_versions')
                .select('*')
                .eq('is_current', true)
                .single();

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error fetching terms of service:', error);
            return null;
        }
    },

    /**
     * Check if user has given specific consent
     */
    async hasConsent(
        userId: string,
        consentType: string
    ): Promise<boolean> {
        try {
            const { data, error } = await supabase
                .from('user_consents')
                .select('consent_given')
                .eq('user_id', userId)
                .eq('consent_type', consentType)
                .is('withdrawn_at', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data?.consent_given || false;
        } catch (error) {
            console.error('Error checking consent:', error);
            return false;
        }
    },
};
