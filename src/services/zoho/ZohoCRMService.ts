import { ZohoService } from './ZohoService';
import { supabase } from '../../lib/supabase';

export interface ZohoModuleRecord {
    id: string;
    [key: string]: any;
}

export class ZohoCRMService extends ZohoService {
    /**
     * Fetches records from a CRM module
     */
    async getRecords(moduleName: 'Contacts' | 'Leads' | 'Deals') {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.crmApiHost) throw new Error('CRM Host missing');

        const response = await fetch(`https://${config.crmApiHost}/crm/v2/${moduleName}`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });

        const data = await response.json();
        return data.data as ZohoModuleRecord[];
    }

    /**
     * Syncs Zoho CRM Contacts to the local 'clients' table
     */
    async syncContacts() {
        const contacts = await this.getRecords('Contacts');
        if (!contacts) return 0;

        let syncedCount = 0;
        for (const contact of contacts) {
            const { error } = await supabase
                .from('clients')
                .upsert({
                    business_id: this.userId, // Assuming user ID is business ID for now
                    full_name: contact.Full_Name || `${contact.First_Name} ${contact.Last_Name}`,
                    email: contact.Email,
                    phone: contact.Phone || contact.Mobile,
                    company_name: contact.Account_Name?.name || contact.Company,
                    tags: ['zoho-crm'],
                    metadata: {
                        zoho_contact_id: contact.id
                    },
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'email' // Or a unique zoho_contact_id if added to schema
                });

            if (!error) syncedCount++;
        }

        return syncedCount;
    }

    /**
     * Syncs Zoho CRM Deals to the local 'deals' table
     */
    async syncDeals() {
        const deals = await this.getRecords('Deals');
        if (!deals) return 0;

        let syncedCount = 0;
        for (const deal of deals) {
            const { error } = await supabase
                .from('deals')
                .upsert({
                    user_id: this.userId,
                    title: deal.Deal_Name,
                    value: deal.Amount,
                    status: deal.Stage,
                    close_date: deal.Closing_Date,
                    metadata: {
                        zoho_deal_id: deal.id
                    },
                    updated_at: new Date().toISOString()
                });

            if (!error) syncedCount++;
        }

        return syncedCount;
    }

    /**
     * Upserts a lead to Zoho CRM
     */
    async upsertLead(lead: any) {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.crmApiHost) throw new Error('CRM Host missing');

        // First, check if lead exists by email
        const searchRes = await fetch(`https://${config.crmApiHost}/crm/v2/Leads/search?email=${encodeURIComponent(lead.email)}`, {
            headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
        });
        const searchData = await searchRes.json();
        const existingId = searchData.data?.[0]?.id;

        const payload = {
            data: [{
                First_Name: lead.businessName?.split(' ')[0] || '',
                Last_Name: lead.businessName?.split(' ').slice(1).join(' ') || 'Company',
                Email: lead.email,
                Phone: lead.phone,
                Company: lead.businessName,
                Lead_Source: lead.source,
                Description: lead.notes,
                Lead_Status: lead.stage === 'lead' ? 'New Lead' : lead.stage
            }]
        };

        const method = existingId ? 'PUT' : 'POST';
        const url = existingId ? `https://${config.crmApiHost}/crm/v2/Leads/${existingId}` : `https://${config.crmApiHost}/crm/v2/Leads`;

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        return await response.json();
    }

    /**
     * Upserts a deal to Zoho CRM
     */
    async upsertDeal(deal: any) {
        const accessToken = await this.getValidAccessToken();
        const config = await this.getConfig();
        if (!accessToken || !config?.crmApiHost) throw new Error('CRM Host missing');

        const payload = {
            data: [{
                Deal_Name: deal.name,
                Amount: deal.value,
                Stage: deal.stage === 'closed_won' ? 'Closed Won' : deal.stage === 'closed_lost' ? 'Closed Lost' : deal.stage,
                Closing_Date: deal.expectedCloseDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                Pipeline: 'Standard'
            }]
        };

        // If we have a zoho_deal_id in metadata, update it
        const zohoId = deal.metadata?.zoho_deal_id;
        const method = zohoId ? 'PUT' : 'POST';
        const url = zohoId ? `https://${config.crmApiHost}/crm/v2/Deals/${zohoId}` : `https://${config.crmApiHost}/crm/v2/Deals`;

        const response = await fetch(url, {
            method,
            headers: {
                Authorization: `Zoho-oauthtoken ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        // If it was a new deal, we should save the ID back to our DB if possible
        // But for background sync, we just return the result
        return result;
    }
}
