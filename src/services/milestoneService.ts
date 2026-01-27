import { supabase } from '../lib/supabase';

export interface Milestone {
    id: string;
    projectId: string;
    name: string;
    description?: string;
    status: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
    completedAt?: string;
    orderIndex: number;
    createdAt: string;
    updatedAt: string;
}

export const milestoneService = {
    /**
     * Get all milestones for a project
     */
    async getMilestones(projectId: string): Promise<{ milestones: Milestone[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('project_milestones')
                .select('*')
                .eq('project_id', projectId)
                .order('order_index', { ascending: true })
                .order('created_at', { ascending: true });

            if (error) throw error;

            const milestones = (data || []).map((m: any) => ({
                id: m.id,
                projectId: m.project_id,
                name: m.name,
                description: m.description,
                status: m.status,
                dueDate: m.due_date,
                completedAt: m.completed_at,
                orderIndex: m.order_index,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }));

            return { milestones, error: null };
        } catch (err: any) {
            console.error('Error fetching milestones:', err);
            return { milestones: [], error: err.message };
        }
    },

    /**
     * Create a new milestone
     */
    async createMilestone(projectId: string, milestone: Partial<Milestone>): Promise<{ milestone: Milestone | null; error: string | null }> {
        try {
            // Get current max order index to append
            const { data: maxOrderData } = await supabase
                .from('project_milestones')
                .select('order_index')
                .eq('project_id', projectId)
                .order('order_index', { ascending: false })
                .limit(1);

            const nextOrderIndex = (maxOrderData?.[0]?.order_index ?? -1) + 1;

            const { data, error } = await supabase
                .from('project_milestones')
                .insert({
                    project_id: projectId,
                    name: milestone.name,
                    description: milestone.description,
                    status: milestone.status || 'pending',
                    due_date: milestone.dueDate,
                    order_index: nextOrderIndex
                })
                .select()
                .single();

            if (error) throw error;

            const newMilestone: Milestone = {
                id: data.id,
                projectId: data.project_id,
                name: data.name,
                description: data.description,
                status: data.status,
                dueDate: data.due_date,
                completedAt: data.completed_at,
                orderIndex: data.order_index,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };

            return { milestone: newMilestone, error: null };
        } catch (err: any) {
            console.error('Error creating milestone:', err);
            return { milestone: null, error: err.message };
        }
    },

    /**
     * Update a milestone
     */
    async updateMilestone(milestoneId: string, updates: Partial<Milestone>): Promise<{ error: string | null }> {
        try {
            const updateData: any = {
                ...updates,
                updated_at: new Date().toISOString()
            };

            // Map frontend keys to snake_case db columns if needed
            if (updates.projectId) updateData.project_id = updates.projectId;
            if (updates.dueDate) updateData.due_date = updates.dueDate;
            if (updates.orderIndex) updateData.order_index = updates.orderIndex;

            // Handle completion timestamp
            if (updates.status === 'completed' && !updates.completedAt) {
                updateData.completed_at = new Date().toISOString();
            } else if (updates.status && updates.status !== 'completed') {
                updateData.completed_at = null;
            }

            // Remove non-db keys
            delete updateData.projectId;
            delete updateData.dueDate;
            delete updateData.orderIndex;
            delete updateData.createdAt;
            delete updateData.updatedAt;
            delete updateData.completedAt; // handled above

            const { error } = await supabase
                .from('project_milestones')
                .update(updateData)
                .eq('id', milestoneId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating milestone:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete a milestone
     */
    async deleteMilestone(milestoneId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('project_milestones')
                .delete()
                .eq('id', milestoneId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting milestone:', err);
            return { error: err.message };
        }
    }
};
