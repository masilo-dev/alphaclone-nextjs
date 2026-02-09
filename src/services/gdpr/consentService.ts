import { supabase } from '../../lib/supabase';

/**
 * GDPR Consent Management Service
 * Tracks user consent for data processing (GDPR Article 6 & 7)
 */

export type ConsentType =
    | 'cookies_essential'
    | 'cookies_analytics'
    | 'cookies_marketing'
    | 'marketing_emails'
    | 'product_updates'
    | 'data_processing'
    | 'third_party_sharing';

export interface ConsentRecord {
    id: string;
    user_id: string;
    consent_type: ConsentType;
    granted: boolean;
    granted_at: string;
    ip_address?: string;
    user_agent?: string;
}

export const consentService = {
    /**
     * Record user consent
     */
    async recordConsent(
        userId: string,
        consentType: ConsentType,
        granted: boolean,
        metadata?: {
            ip_address?: string;
            user_agent?: string;
        }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { error } = await supabase.from('user_consents').upsert({
                user_id: userId,
                consent_type: consentType,
                granted,
                granted_at: new Date().toISOString(),
                ip_address: metadata?.ip_address,
                user_agent: metadata?.user_agent,
            });

            if (error) throw error;

            return { success: true };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Failed to record consent',
            };
        }
    },

    /**
     * Get all consents for a user
     */
    async getUserConsents(userId: string): Promise<ConsentRecord[]> {
        const { data, error } = await supabase
            .from('user_consents')
            .select('*')
            .eq('user_id', userId)
            .order('granted_at', { ascending: false });

        if (error) {
            console.error('Error fetching consents:', error);
            return [];
        }

        return data || [];
    },

    /**
     * Check if user has granted specific consent
     */
    async hasConsent(userId: string, consentType: ConsentType): Promise<boolean> {
        const { data } = await supabase
            .from('user_consents')
            .select('granted')
            .eq('user_id', userId)
            .eq('consent_type', consentType)
            .order('granted_at', { ascending: false })
            .limit(1)
            .single();

        return data?.granted || false;
    },

    /**
     * Withdraw consent
     */
    async withdrawConsent(
        userId: string,
        consentType: ConsentType
    ): Promise<{ success: boolean; error?: string }> {
        return this.recordConsent(userId, consentType, false);
    },

    /**
     * Get consent categories with descriptions
     */
    getConsentCategories(): {
        type: ConsentType;
        name: string;
        description: string;
        required: boolean;
    }[] {
        return [
            {
                type: 'cookies_essential',
                name: 'Essential Cookies',
                description:
                    'Required for the website to function. These cannot be disabled.',
                required: true,
            },
            {
                type: 'cookies_analytics',
                name: 'Analytics Cookies',
                description:
                    'Help us understand how visitors use our website (e.g., Google Analytics, Vercel Analytics).',
                required: false,
            },
            {
                type: 'cookies_marketing',
                name: 'Marketing Cookies',
                description:
                    'Used to track visitors across websites to show relevant ads.',
                required: false,
            },
            {
                type: 'marketing_emails',
                name: 'Marketing Emails',
                description:
                    'Receive promotional emails about new features, special offers, and updates.',
                required: false,
            },
            {
                type: 'product_updates',
                name: 'Product Updates',
                description:
                    'Receive important product announcements and feature updates.',
                required: false,
            },
            {
                type: 'data_processing',
                name: 'Data Processing',
                description:
                    'Allow us to process your data to provide and improve our services.',
                required: true,
            },
            {
                type: 'third_party_sharing',
                name: 'Third-Party Sharing',
                description:
                    'Share data with third-party service providers (e.g., payment processors, analytics).',
                required: true,
            },
        ];
    },

    /**
     * Initialize default consents for new user
     */
    async initializeDefaultConsents(userId: string, metadata?: {
        ip_address?: string;
        user_agent?: string;
    }): Promise<void> {
        const categories = this.getConsentCategories();
        const requiredConsents = categories.filter(c => c.required);

        for (const consent of requiredConsents) {
            await this.recordConsent(userId, consent.type, true, metadata);
        }
    },

    /**
     * Check if user needs to update their consents
     * (e.g., after privacy policy changes)
     */
    async needsConsentUpdate(userId: string): Promise<boolean> {
        const CONSENT_REFRESH_DAYS = 365; // Ask for consent renewal yearly

        const { data: lastConsent } = await supabase
            .from('user_consents')
            .select('granted_at')
            .eq('user_id', userId)
            .order('granted_at', { ascending: false })
            .limit(1)
            .single();

        if (!lastConsent) return true;

        const daysSinceLastConsent =
            (Date.now() - new Date(lastConsent.granted_at).getTime()) /
            (1000 * 60 * 60 * 24);

        return daysSinceLastConsent > CONSENT_REFRESH_DAYS;
    },
};
