import { supabase } from '../lib/supabase';
import { User, UserRole } from '../types';
import { tenantService } from './tenancy/TenantService';

export const userService = {
    /**
     * Get all users (Admin only)
     */
    async getUsers(): Promise<{ users: User[]; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();

            // If no tenant, return empty (avoid querying all profiles)
            if (!tenantId) {
                return { users: [], error: null };
            }

            // Get users linked to this tenant FIRST (avoid RLS 403)
            const { data: tenantUsers, error: tenantError } = await supabase
                .from('tenant_users')
                .select('user_id')
                .eq('tenant_id', tenantId);

            if (tenantError) return { users: [], error: tenantError.message };

            const userIds = tenantUsers.map((tu: any) => tu.user_id);
            if (userIds.length === 0) return { users: [], error: null };

            // Now query profiles with filtered IDs (RLS-safe)
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('id', userIds)
                .order('created_at', { ascending: false });

            if (error) {
                return { users: [], error: error.message };
            }

            const users: User[] = (data || []).map((p: any) => ({
                id: p.id,
                email: p.email,
                name: p.name,
                role: p.role as UserRole,
                avatar: p.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=random`
            }));

            return { users, error: null };
        } catch (err) {
            return { users: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get a single user
     */
    async getUser(userId: string): Promise<{ user: User | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            if (error) {
                return { user: null, error: error.message };
            }

            const user: User = {
                id: data.id,
                email: data.email,
                name: data.name,
                role: data.role as UserRole,
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random`
            };

            return { user, error: null };
        } catch (err) {
            return { user: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update user profile
     */
    async updateProfile(userId: string, updates: {
        name?: string;
        email?: string;
        phone?: string;
        company?: string;
        timezone?: string;
    }): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update(updates)
                .eq('id', userId);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update user notification settings
     */
    async updateNotificationSettings(userId: string, settings: {
        email_notifications?: boolean;
        project_updates?: boolean;
        message_alerts?: boolean;
        weekly_reports?: boolean;
    }): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ notification_settings: settings })
                .eq('id', userId);

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Change user password
     */
    async changePassword(currentPassword: string, newPassword: string): Promise<{ error: string | null }> {
        try {
            // First verify current password by attempting to sign in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: (await supabase.auth.getUser()).data.user?.email || '',
                password: currentPassword
            });

            if (signInError) {
                return { error: 'Current password is incorrect' };
            }

            // Update password
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) {
                return { error: error.message };
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get current user
     */
    async getCurrentUser(): Promise<User | null> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { user: profile } = await this.getUser(user.id);
        return profile;
    },
    async getSystemAdmin(): Promise<{ adminId: string | null; error: string | null }> {
        try {
            // Optimization: Use Supabase single select with limit instead of fetching all users
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('role', 'admin')
                .limit(1)
                .single();

            if (error) return { adminId: null, error: error.message };
            return { adminId: data.id, error: null };
        } catch (err) {
            return { adminId: null, error: 'Failed to fetch admin' };
        }
    },

    /**
     * Create client user (insert into profiles and tenant_users)
     */
    async createClient(clientData: {
        name: string;
        email: string;
        phone?: string;
        company?: string;
    }): Promise<{ client: User | null; error: string | null }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();

            // 1. Create Profile (Note: In a real app we'd also create an auth user)
            const { data: profile, error: pError } = await supabase
                .from('profiles')
                .insert({
                    name: clientData.name,
                    email: clientData.email,
                    role: 'client',
                    avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(clientData.name)}&background=random`
                })
                .select()
                .single();

            if (pError) throw pError;

            // 2. Link to Tenant
            if (tenantId) {
                const { error: tError } = await supabase
                    .from('tenant_users')
                    .insert({
                        user_id: profile.id,
                        tenant_id: tenantId
                    });
                if (tError) console.error('Failed to link client to tenant:', tError);
            }

            const client: User = {
                id: profile.id,
                name: profile.name,
                email: profile.email,
                role: profile.role,
                avatar: profile.avatar
            };

            return { client, error: null };
        } catch (err) {
            return { client: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
};
