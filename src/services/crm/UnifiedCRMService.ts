import { supabase } from '@/lib/supabase';

export const UnifiedCRMService = {
    /**
     * Pushes a deal to all active external CRMs
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
                body: JSON.stringify({ tenantId: deal.tenant_id || deal.tenantId, deal, entityType: 'deal' })
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
     * Pushes a lead to all active external CRMs
     */
    async syncLead(lead: any) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No active session for CRM lead sync');
                return;
            }

            const response = await fetch('/api/crm/sync/push', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ tenantId: lead.tenant_id || lead.tenantId, lead, entityType: 'lead' })
            });

            if (!response.ok) {
                console.error('Failed to sync lead to external CRM:', await response.text());
            } else {
                console.log('Lead synced successfully to external CRM');
            }
        } catch (error) {
            console.error('CRM Lead Sync Error:', error);
        }
    },

    /**
     * Pulls deals from all active external CRMs into the local database
     */
    async pullDeals(tenantId: string) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('No active session for CRM pull');
                return;
            }

            const response = await fetch('/api/crm/sync/pull', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ tenantId })
            });
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('CRM Pull Error:', error);
            throw error;
        }
    }
};
