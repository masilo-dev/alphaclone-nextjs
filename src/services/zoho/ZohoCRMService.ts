import { ZohoService } from './ZohoService';

export interface ZohoModuleRecord {
    id: string;
    [key: string]: any;
}

export class ZohoCRMService extends ZohoService {

    private async getCRMBase(): Promise<string> {
        const config = await this.getConfig();
        if (!config?.crmApiHost) throw new Error('Zoho CRM not configured: missing crmApiHost');
        return `https://${config.crmApiHost}/crm/v2`;
    }

    async getRecords(moduleName: 'Contacts' | 'Leads' | 'Deals' | 'Accounts'): Promise<ZohoModuleRecord[]> {
        const base = await this.getCRMBase();
        const data = await this.callZohoAPI(`${base}/${moduleName}`);
        return (data?.data ?? []) as ZohoModuleRecord[];
    }

    /**
     * Syncs Zoho CRM Contacts to the local 'clients' table.
     * Uses user_id (not business_id) to link records.
     */
    async syncContacts(): Promise<number> {
        const contacts = await this.getRecords('Contacts');
        if (!contacts.length) return 0;

        const supabase = this.getSupabaseClient();
        let syncedCount = 0;

        for (const contact of contacts) {
            const email = contact.Email;
            if (!email) continue; // skip contacts without email — can't upsert without unique key

            const { error } = await supabase
                .from('clients')
                .upsert({
                    user_id: this.userId,
                    full_name: contact.Full_Name || `${contact.First_Name ?? ''} ${contact.Last_Name ?? ''}`.trim(),
                    email,
                    phone: contact.Phone || contact.Mobile || null,
                    company_name: contact.Account_Name?.name || contact.Company || null,
                    tags: ['zoho-crm'],
                    metadata: { zoho_contact_id: contact.id },
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'email',
                });

            if (error) {
                console.error('Zoho CRM syncContacts upsert error:', error.message);
            } else {
                syncedCount++;
            }
        }

        return syncedCount;
    }

    /**
     * Syncs Zoho CRM Deals to the local 'deals' table.
     */
    async syncDeals(): Promise<number> {
        const deals = await this.getRecords('Deals');
        if (!deals.length) return 0;

        const supabase = this.getSupabaseClient();
        let syncedCount = 0;

        for (const deal of deals) {
            const { error } = await supabase
                .from('deals')
                .upsert({
                    user_id: this.userId,
                    title: deal.Deal_Name,
                    value: deal.Amount ?? 0,
                    status: deal.Stage ?? 'unknown',
                    close_date: deal.Closing_Date ?? null,
                    metadata: { zoho_deal_id: deal.id },
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_id,title', // best available key; adjust if schema has zoho_deal_id column
                });

            if (error) {
                console.error('Zoho CRM syncDeals upsert error:', error.message);
            } else {
                syncedCount++;
            }
        }

        return syncedCount;
    }

    /**
     * Upserts a lead to Zoho CRM (AlphaClone → Zoho direction).
     */
    async upsertLead(lead: any) {
        const base = await this.getCRMBase();
        const businessName = lead?.businessName || lead?.company || lead?.name || '';
        const nameParts = String(businessName).trim().split(/\s+/).filter(Boolean);
        const email = typeof lead?.email === 'string' ? lead.email.trim() : '';

        let existingId: string | null = null;
        if (email) {
            const searchData = await this.callZohoAPI(
                `${base}/Leads/search?email=${encodeURIComponent(email)}`
            );
            existingId = searchData?.data?.[0]?.id ?? null;
        }

        const payload = {
            data: [{
                First_Name: lead.firstName || nameParts[0] || '',
                Last_Name: lead.lastName || nameParts.slice(1).join(' ') || 'Unknown',
                Email: email || null,
                Phone: lead.phone ?? lead.mobile ?? null,
                Company: businessName || null,
                Lead_Source: lead.source ?? null,
                Description: lead.notes ?? null,
                Lead_Status: lead.stage === 'lead' ? 'New Lead' : (lead.stage ?? 'New Lead'),
            }],
        };

        const method = existingId ? 'PUT' : 'POST';
        const url = existingId ? `${base}/Leads/${existingId}` : `${base}/Leads`;

        const result = await this.callZohoAPI(url, {
            method,
            body: JSON.stringify(payload),
        });

        return result;
    }

    /**
     * Upserts a deal to Zoho CRM (AlphaClone → Zoho direction).
     */
    async upsertDeal(deal: any) {
        const base = await this.getCRMBase();

        const stageMap: Record<string, string> = {
            closed_won: 'Closed Won',
            closed_lost: 'Closed Lost',
        };

        const payload = {
            data: [{
                Deal_Name: deal.name,
                Amount: deal.value ?? 0,
                Stage: stageMap[deal.stage] ?? deal.stage ?? 'Qualification',
                Closing_Date: deal.expectedCloseDate
                    || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                Pipeline: 'Standard',
            }],
        };

        const zohoId = deal.metadata?.zoho_deal_id ?? null;
        const method = zohoId ? 'PUT' : 'POST';
        const url = zohoId ? `${base}/Deals/${zohoId}` : `${base}/Deals`;

        const result = await this.callZohoAPI(url, {
            method,
            body: JSON.stringify(payload),
        });

        return result;
    }

    async upsertContact(contact: any) {
        const base = await this.getCRMBase();
        if (!contact.email) {
            throw new Error('Contact email is required for Zoho CRM sync');
        }

        const searchData = await this.callZohoAPI(
            `${base}/Contacts/search?email=${encodeURIComponent(contact.email)}`
        );
        const existingId = searchData?.data?.[0]?.id ?? null;

        const payload = {
            data: [{
                First_Name: contact.firstName || contact.fullName?.split(' ')[0] || '',
                Last_Name:
                    contact.lastName ||
                    contact.fullName?.split(' ').slice(1).join(' ') ||
                    'Unknown',
                Email: contact.email,
                Phone: contact.phone || null,
                Mobile: contact.mobile || null,
                Department: contact.department || null,
                Description: contact.notes || contact.bio || null,
            }],
        };

        const method = existingId ? 'PUT' : 'POST';
        const url = existingId ? `${base}/Contacts/${existingId}` : `${base}/Contacts`;
        return await this.callZohoAPI(url, {
            method,
            body: JSON.stringify(payload),
        });
    }

    async upsertCompany(company: any) {
        const base = await this.getCRMBase();
        const companyName = company.name || company.businessName;
        if (!companyName) {
            throw new Error('Company name is required for Zoho CRM sync');
        }

        const searchData = await this.callZohoAPI(
            `${base}/Accounts/search?criteria=${encodeURIComponent(`(Account_Name:equals:${companyName})`)}`
        );
        const existingId = searchData?.data?.[0]?.id ?? null;

        const payload = {
            data: [{
                Account_Name: companyName,
                Website: company.website || null,
                Phone: company.phone || null,
                Industry: company.industry || null,
                Description: company.description || company.notes || null,
            }],
        };

        const method = existingId ? 'PUT' : 'POST';
        const url = existingId ? `${base}/Accounts/${existingId}` : `${base}/Accounts`;
        return await this.callZohoAPI(url, {
            method,
            body: JSON.stringify(payload),
        });
    }
}
