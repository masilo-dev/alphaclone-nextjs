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

            let query = supabase.from('profiles').select('*');

            if (tenantId) {
                // Get users linked to this tenant
                const { data: tenantUsers, error: tenantError } = await supabase
                    .from('tenant_users')
                    .select('user_id')
                    .eq('tenant_id', tenantId);

                if (tenantError) return { users: [], error: tenantError.message };

                const userIds = tenantUsers.map(tu => tu.user_id);
                if (userIds.length === 0) return { users: [], error: null };

                query = query.in('id', userIds);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                return { users: [], error: error.message };
            }

            const users: User[] = (data || []).map(p => ({
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
    }
};
