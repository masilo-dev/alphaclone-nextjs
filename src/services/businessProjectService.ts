import { supabase } from '../lib/supabase';

export interface BusinessProject {
    id: string;
    tenantId: string;
    name: string;
    description?: string;
    status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
    assignedTo: string[];
    dueDate?: string;
    progress: number;
    clientId?: string;
    createdAt: string;
    updatedAt: string;
}

export const businessProjectService = {
    /**
     * Get all projects for a tenant
     */
    async getProjects(tenantId: string): Promise<{ projects: BusinessProject[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_projects')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const projects = (data || []).map((p: any) => ({
                id: p.id,
                tenantId: p.tenant_id,
                name: p.name,
                description: p.description,
                status: p.status,
                assignedTo: p.assigned_to || [],
                dueDate: p.due_date,
                progress: p.progress || 0,
                clientId: p.client_id,
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }));

            return { projects, error: null };
        } catch (err: any) {
            console.error('Error fetching projects:', err);
            return { projects: [], error: err.message };
        }
    },

    /**
     * Create a new project
     */
    async createProject(tenantId: string, project: Partial<BusinessProject>): Promise<{ project: BusinessProject | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_projects')
                .insert({
                    tenant_id: tenantId,
                    name: project.name,
                    description: project.description,
                    status: project.status || 'backlog',
                    assigned_to: project.assignedTo || [],
                    due_date: project.dueDate,
                    progress: project.progress || 0,
                    client_id: project.clientId
                })
                .select()
                .single();

            if (error) throw error;

            const newProject: BusinessProject = {
                id: data.id,
                tenantId: data.tenant_id,
                name: data.name,
                description: data.description,
                status: data.status,
                assignedTo: data.assigned_to || [],
                dueDate: data.due_date,
                progress: data.progress || 0,
                clientId: data.client_id,
                createdAt: data.created_at,
                updatedAt: data.updated_at
            };

            return { project: newProject, error: null };
        } catch (err: any) {
            console.error('Error creating project:', err);
            return { project: null, error: err.message };
        }
    },

    /**
     * Update a project
     */
    async updateProject(projectId: string, updates: Partial<BusinessProject>): Promise<{ error: string | null }> {
        try {
            const updateData: Record<string, any> = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
            if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
            if (updates.progress !== undefined) updateData.progress = updates.progress;
            if (updates.clientId !== undefined) updateData.client_id = updates.clientId;

            updateData.updated_at = new Date().toISOString();

            const { error } = await supabase
                .from('business_projects')
                .update(updateData)
                .eq('id', projectId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error updating project:', err);
            return { error: err.message };
        }
    },

    /**
     * Delete a project
     */
    async deleteProject(projectId: string): Promise<{ error: string | null }> {
        try {
            const { error } = await supabase
                .from('business_projects')
                .delete()
                .eq('id', projectId);

            if (error) throw error;

            return { error: null };
        } catch (err: any) {
            console.error('Error deleting project:', err);
            return { error: err.message };
        }
    },

    /**
     * Get projects by status (for Kanban columns)
     */
    async getProjectsByStatus(tenantId: string, status: string): Promise<{ projects: BusinessProject[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('business_projects')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', status)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const projects = (data || []).map((p: any) => ({
                id: p.id,
                tenantId: p.tenant_id,
                name: p.name,
                description: p.description,
                status: p.status,
                assignedTo: p.assigned_to || [],
                dueDate: p.due_date,
                progress: p.progress || 0,
                clientId: p.client_id,
                createdAt: p.created_at,
                updatedAt: p.updated_at
            }));

            return { projects, error: null };
        } catch (err: any) {
            console.error('Error fetching projects by status:', err);
            return { projects: [], error: err.message };
        }
    }
};
