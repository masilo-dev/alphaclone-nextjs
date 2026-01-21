import { supabase } from '../lib/supabase';

export interface BusinessClient {
    id: string;
    tenantId: string;
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    stage: 'lead' | 'prospect' | 'customer' | 'lost';
    value: number;
    notes?: string;
    customFields?: Record<string, any>;
    createdAt: string;
    updatedAt: string;
}

export const businessClientService = {
    /**
     * Get all clients for a tenant
     */
    async getClients(tenantId: string): Promise<{ clients: BusinessClient[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_clients')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const clients = (data || []).map((c: any) => ({
                id: c.id,
                tenantId: c.tenant_id,
                name: c.name,
                email: c.email,
                phone: c.phone,
                company: c.company,
                stage: c.stage,
                value: parseFloat(c.value || 0),
                notes: c.notes,
                customFields: c.custom_fields,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }));

            return { clients, error: null };
        } catch (err: any) {
            console.error('Error fetching clients:', err);
            return { clients: [], error: err.message };
        }
    },

    /**
     * Create a new client
     */
    async createClient(tenantId: string, client: Partial<BusinessClient>): Promise<{ client: BusinessClient | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_clients')
                .insert({
                    tenant_id: tenantId,
                    name: client.name,
                    email: client.email,
                    phone: client.phone,
                    company: client.company,
                    stage: client.stage || 'lead',
                    value: client.value || 0,
                    notes: client.notes,
                    custom_fields: client.customFields || {}
                })
                .select()
                .single();

            if (error) throw error;

            const newClient: BusinessClient = {
                id: data.id,
                tenantId: data.tenant_id,
                name: data.name,
                email: data.email,
                phone: data.phone,
                company: data.company,
                stage: data.stage,
                value: parseFloat(data.value || 0),
                notes: data.notes,
                customFields: data.custom_fields,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };

            return { client: newClient, error: null };
        } catch (err: any) {
            console.error('Error creating client:', err);
            return { client: null, error: err.message };
        }
    },

    /**
     * Update a client
     */
    async updateClient(clientId: string, updates: Partial<BusinessClient>): Promise<{ error: string | null }> {
        try {
            const updateData: Record<string, any> = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.email !== undefined) updateData.email = updates.email;
            if (updates.phone !== undefined) updateData.phone = updates.phone;
            if (updates.company !== undefined) updateData.company = updates.company;
            if (updates.stage !== undefined) updateData.stage = updates.stage;
            if (updates.value !== undefined) updateData.value = updates.value;
            if (updates.notes !== undefined) updateData.notes = updates.notes;
            if (updates.customFields !== undefined) updateData.custom_fields = updates.customFields;

            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('business_clients')
                .update(updateData)
                .eq('id', clientId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating client:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete a client
     */
    async deleteClient(clientId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_clients')
                .delete()
                .eq('id', clientId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting client:', err);
            return { error: err.message };
        }
    },

    /**
     * Import clients from parsed data
     */
    async importClients(tenantId: string, clients: Partial<BusinessClient>[]): Promise<{ count: number; error: string | null }> {
        try {
            const insertData = clients.map((c: any) => ({
                tenant_id: tenantId,
                name: c.name,
                email: c.email,
                phone: c.phone,
                company: c.company,
                stage: c.stage || 'lead',
                value: c.value || 0,
                notes: c.notes,
                custom_fields: c.customFields || {}
            }));

            const { data, error } = await supabase
                .from('business_clients')
                .insert(insertData)
                .select();

            if (error) throw error;

            return { count: data?.length || 0, error: null };
        } catch (err: any) {
            console.error('Error importing clients:', err);
            return { count: 0, error: err.message };
        }
    }
};
