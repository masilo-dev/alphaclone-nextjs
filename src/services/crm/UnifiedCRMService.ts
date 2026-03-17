import { supabase } from '@/lib/supabase';

export const UnifiedCRMService = {
    /**
     * Pushes a deal to all active external CRMs (Zoho, HubSpot)
     */
    async syncDeal(deal: any) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No active session for CRM sync');
                return;
            }

            const response = await fetch('/api/crm/sync/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ deal })
            });

            if (!response.ok) {
                console.error('Failed to sync deal to external CRM:', await response.text());
            } else {
                console.log('Deal synced successfully to external CRM');
            }
        } catch (error) {
            console.error('CRM Sync Error:', error);
        }
    },

    /**
     * Pulls deals from all active external CRMs into the local database
     */
    async pullDeals() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No active session for CRM pull');
                return;
            }

            const response = await fetch('/api/crm/sync/pull', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                }
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('CRM Pull Error:', error);
            throw error;
        }
    }
};
