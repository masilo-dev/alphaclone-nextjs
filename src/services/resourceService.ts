import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface TeamMember {
    id: string;
    tenant_id: string;
    name: string;
    role: string;
    email: string;
    skills: string[];
    availability: number;
    hourly_rate: number;
    current_projects: string[];
    max_projects: number;
    status: 'available' | 'busy' | 'unavailable';
    last_active?: string;
    created_at?: string;
}

export interface BusinessResource {
    id: string;
    tenant_id: string;
    name: string;
    type: 'human' | 'equipment' | 'software' | 'budget';
    description: string;
    capacity: number;
    used: number;
    unit: 'hours' | 'days' | 'percentage' | 'currency';
    cost_per_unit: number;
    availability: 'available' | 'limited' | 'unavailable';
    created_at?: string;
}

export const resourceService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active organization context');
        return tenantId;
    },

    /**
     * TEAM MEMBERS
     */
    async getTeamMembers(): Promise<{ team: TeamMember[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('team_members')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error) throw error;
            return { team: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching team:', err);
            return { team: [], error: err.message };
        }
    },

    async addTeamMember(member: Partial<TeamMember>): Promise<{ member: TeamMember | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('team_members')
                .insert({ ...member, tenant_id: tenantId })
                .select()
                .single();

            if (error) throw error;
            return { member: data, error: null };
        } catch (err: any) {
            return { member: null, error: err.message };
        }
    },

    async updateTeamMember(id: string, updates: Partial<TeamMember>): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('team_members')
                .update(updates)
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    async deleteTeamMember(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    /**
     * RESOURCES
     */
    async getResources(): Promise<{ resources: BusinessResource[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('business_resources')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error) throw error;
            return { resources: data || [], error: null };
        } catch (err: any) {
            console.error('Error fetching resources:', err);
            return { resources: [], error: err.message };
        }
    },

    async addResource(resource: Partial<BusinessResource>): Promise<{ resource: BusinessResource | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('business_resources')
                .insert({ ...resource, tenant_id: tenantId })
                .select()
                .single();

            if (error) throw error;
            return { resource: data, error: null };
        } catch (err: any) {
            return { resource: null, error: err.message };
        }
    },

    async updateResource(id: string, updates: Partial<BusinessResource>): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('business_resources')
                .update(updates)
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    },

    async deleteResource(id: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { error } = await supabase
                .from('business_resources')
                .delete()
                .eq('id', id)
                .eq('tenant_id', tenantId);

            if (error) throw error;
            return { error: null };
        } catch (err: any) {
            return { error: err.message };
        }
    }
};
