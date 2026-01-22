import { supabase } from '../lib/supabase';
import { Improvement } from '../types';

/**
 * Improvement Service
 * 
 * Handles all CRUD operations for exit-intent improvement submissions
 */

export interface ImprovementSubmission {
    message: string;
    severity: 'low' | 'medium' | 'high';
    page_url: string;
    user_type: 'visitor' | 'client' | 'tenant_admin' | 'admin';
    user_id?: string;
}

export interface ImprovementFilters {
    status?: 'new' | 'reviewed' | 'in_progress' | 'resolved';
    severity?: 'low' | 'medium' | 'high';
    user_type?: 'visitor' | 'client' | 'tenant_admin' | 'admin';
    search?: string;
}

/**
 * Submit a new improvement
 */
export const submitImprovement = async (data: ImprovementSubmission) => {
    try {
        const { data: improvement, error } = await supabase
            .from('improvements')
            .insert({
                message: data.message,
                severity: data.severity,
                source: 'exit_intent',
                channel: 'web',
                page_url: data.page_url,
                user_type: data.user_type,
                user_id: data.user_id || null,
                is_pwa: false,
                status: 'new'
            })
            .select()
            .single();

        if (error) {
            console.error('Error submitting improvement:', error);
            return { improvement: null, error: error.message };
        }

        return { improvement, error: null };
    } catch (err) {
        console.error('Unexpected error submitting improvement:', err);
        return { improvement: null, error: 'Failed to submit improvement' };
    }
};

/**
 * Get all improvements with optional filters (admin only)
 */
export const getImprovements = async (filters?: ImprovementFilters) => {
    try {
        let query = supabase
            .from('improvements')
            .select('*')
            .order('created_at', { ascending: false });

        // Apply filters
        if (filters?.status) {
            query = query.eq('status', filters.status);
        }

        if (filters?.severity) {
            query = query.eq('severity', filters.severity);
        }

        if (filters?.user_type) {
            query = query.eq('user_type', filters.user_type);
        }

        if (filters?.search) {
            query = query.or(`message.ilike.%${filters.search}%,page_url.ilike.%${filters.search}%`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching improvements:', error);
            return { improvements: [], error: error.message };
        }

        // Map to Improvement type with Date objects
        const improvements: Improvement[] = (data || []).map((item: any) => ({
            ...item,
            created_at: new Date(item.created_at),
            updated_at: new Date(item.updated_at)
        }));

        return { improvements, error: null };
    } catch (err) {
        console.error('Unexpected error fetching improvements:', err);
        return { improvements: [], error: 'Failed to fetch improvements' };
    }
};

/**
 * Update improvement status and/or admin notes (admin only)
 */
export const updateImprovement = async (
    id: string,
    updates: {
        status?: 'new' | 'reviewed' | 'in_progress' | 'resolved';
        admin_notes?: string | null;
    }
) => {
    try {
        const { data, error } = await supabase
            .from('improvements')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Error updating improvement:', error);
            return { improvement: null, error: error.message };
        }

        const improvement: Improvement = {
            ...data,
            created_at: new Date(data.created_at),
            updated_at: new Date(data.updated_at)
        };

        return { improvement, error: null };
    } catch (err) {
        console.error('Unexpected error updating improvement:', err);
        return { improvement: null, error: 'Failed to update improvement' };
    }
};

/**
 * Mark user as having completed exit-intent (update user profile flags)
 */
export const markUserAsCompleted = async (userId: string, submitted: boolean = false) => {
    try {
        const updates: any = {
            has_seen_exit_improvement: true
        };

        if (submitted) {
            updates.has_submitted_exit_improvement = true;
        }

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (error) {
            console.error('Error updating user flags:', error);
            return { error: error.message };
        }

        return { error: null };
    } catch (err) {
        console.error('Unexpected error updating user flags:', err);
        return { error: 'Failed to update user flags' };
    }
};

/**
 * Get improvement statistics (admin only)
 */
export const getImprovementStats = async () => {
    try {
        const { data, error } = await supabase
            .from('improvements')
            .select('status, severity');

        if (error) {
            console.error('Error fetching improvement stats:', error);
            return { stats: null, error: error.message };
        }

        const stats = {
            total: data.length,
            byStatus: {
                new: data.filter((i: any) => i.status === 'new').length,
                reviewed: data.filter((i: any) => i.status === 'reviewed').length,
                in_progress: data.filter((i: any) => i.status === 'in_progress').length,
                resolved: data.filter((i: any) => i.status === 'resolved').length
            },
            bySeverity: {
                low: data.filter((i: any) => i.severity === 'low').length,
                medium: data.filter((i: any) => i.severity === 'medium').length,
                high: data.filter((i: any) => i.severity === 'high').length
            }
        };

        return { stats, error: null };
    } catch (err) {
        console.error('Unexpected error fetching stats:', err);
        return { stats: null, error: 'Failed to fetch stats' };
    }
};

export const improvementService = {
    submitImprovement,
    getImprovements,
    updateImprovement,
    markUserAsCompleted,
    getImprovementStats
};
