import { supabase } from '../lib/supabase';
import { Project, UserRole } from '../types';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';

export const projectService = {
    /**
     * Get current tenant ID (helper method)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            throw new Error('No active tenant. Please select or create an organization.');
        }
        return tenantId;
    },

    /**
     * Get projects based on user role (with tenant isolation)
     */
    async getProjects(userId: string, role: UserRole, limit: number = 100): Promise<{ projects: Project[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('projects')
                .select('*')
                .eq('tenant_id', tenantId); // ← TENANT FILTER

            // Clients only see their own projects, admins see all within tenant
            if (role !== 'admin') {
                query = query.eq('owner_id', userId);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                return { projects: [], error: error.message };
            }

            const projects: Project[] = (data || []).map((p: any) => ({
                id: p.id,
                ownerId: p.owner_id,
                ownerName: p.owner_name,
                name: p.name,
                category: p.category,
                status: p.status,
                currentStage: p.current_stage,
                progress: p.progress,
                dueDate: p.due_date,
                team: p.team || [],
                image: p.image,
                description: p.description,
                contractStatus: p.contract_status,
                contractText: p.contract_text,
                externalUrl: p.external_url,
                isPublic: p.is_public,
                showInPortfolio: p.show_in_portfolio,
            }));

            return { projects, error: null };
        } catch (err) {
            return { projects: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get all public portfolio projects (no auth required)
     * Shows projects from all tenants that are marked as public
     */
    async getPublicProjects(): Promise<{ projects: Project[]; error: string | null }> {
        try {
            // Fetch all projects that are public and marked for portfolio display
            // No tenant filter here - public projects can be viewed by anyone
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('is_public', true)
                .eq('show_in_portfolio', true)
                .in('status', ['Completed', 'Active'])
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error("Error fetching public projects:", error);
                return { projects: [], error: error.message };
            }

            const projects: Project[] = (data || []).map((p: any) => ({
                id: p.id,
                ownerId: p.owner_id,
                ownerName: p.owner_name,
                name: p.name,
                category: p.category,
                status: p.status,
                currentStage: p.current_stage,
                progress: p.progress,
                dueDate: p.due_date,
                team: p.team || [],
                image: p.image,
                description: p.description,
                contractStatus: p.contract_status,
                contractText: p.contract_text,
                externalUrl: p.external_url,
                isPublic: p.is_public,
                showInPortfolio: p.show_in_portfolio,
            }));

            return { projects, error: null };
        } catch (err) {
            return { projects: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create a new project (with tenant assignment)
     */
    async createProject(project: Omit<Project, 'id'>): Promise<{ project: Project | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('projects')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    owner_id: project.ownerId,
                    owner_name: project.ownerName,
                    name: project.name,
                    category: project.category,
                    status: project.status,
                    current_stage: project.currentStage,
                    progress: project.progress,
                    due_date: project.dueDate,
                    team: project.team,
                    image: project.image,
                    description: project.description,
                    contract_status: project.contractStatus || 'None',
                    contract_text: project.contractText,
                    external_url: project.externalUrl,
                    is_public: project.isPublic,
                    show_in_portfolio: project.showInPortfolio,
                })
                .select()
                .single();

            if (error) {
                return { project: null, error: error.message };
            }

            const newProject: Project = {
                id: data.id,
                ownerId: data.owner_id,
                ownerName: data.owner_name,
                name: data.name,
                category: data.category,
                status: data.status,
                currentStage: data.current_stage,
                progress: data.progress,
                dueDate: data.due_date,
                team: data.team || [],
                image: data.image,
                description: data.description,
                contractStatus: data.contract_status,
                contractText: data.contract_text,
                externalUrl: data.external_url,
                isPublic: data.is_public,
                showInPortfolio: data.show_in_portfolio,
            };

            // Log activity
            if (project.ownerId) {
                activityService.logActivity(project.ownerId, 'Project Created', {
                    projectId: newProject.id,
                    projectName: newProject.name,
                    category: newProject.category,
                    status: newProject.status
                }).catch(err => console.error('Failed to log activity:', err));
            }

            return { project: newProject, error: null };
        } catch (err) {
            return { project: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update a project (with tenant verification)
     */
    async updateProject(projectId: string, updates: Partial<Project>): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const updateData: Record<string, unknown> = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.category !== undefined) updateData.category = updates.category;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.currentStage !== undefined) updateData.current_stage = updates.currentStage;
            if (updates.progress !== undefined) updateData.progress = updates.progress;
            if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
            if (updates.team !== undefined) updateData.team = updates.team;
            if (updates.image !== undefined) updateData.image = updates.image;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.contractStatus !== undefined) updateData.contract_status = updates.contractStatus;
            if (updates.contractText !== undefined) updateData.contract_text = updates.contractText;
            if (updates.externalUrl !== undefined) updateData.external_url = updates.externalUrl;
            if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
            if (updates.showInPortfolio !== undefined) updateData.show_in_portfolio = updates.showInPortfolio;

            const { error, data } = await supabase
                .from('projects')
                .update(updateData)
                .eq('id', projectId)
                .eq('tenant_id', tenantId) // ← VERIFY TENANT OWNERSHIP
                .select('owner_id, name')
                .single();

            if (error) {
                return { error: error.message };
            }

            // If no data returned, project not found or no access
            if (!data) {
                return { error: 'Project not found or no access' };
            }

            // Log activity
            if (data?.owner_id) {
                const changedFields = Object.keys(updateData).join(', ');
                activityService.logActivity(data.owner_id, 'Project Updated', {
                    projectId: projectId,
                    projectName: data.name,
                    updatedFields: changedFields
                }).catch(err => console.error('Failed to log activity:', err));
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete a project (with tenant verification)
     */
    async deleteProject(projectId: string): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId)
                .eq('tenant_id', tenantId); // ← VERIFY TENANT OWNERSHIP

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Subscribe to real-time project updates (filtered by tenant)
     */
    subscribeToProjects(callback: (project: Project) => void) {
        const tenantId = this.getTenantId();

        const channel = supabase
            .channel('projects_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'projects',
                    filter: `tenant_id=eq.${tenantId}` // ← FILTER BY TENANT
                },
                (payload: any) => {
                    if (payload.eventType === 'DELETE') {
                        return;
                    }
                    const p = payload.new as any;
                    const project: Project = {
                        id: p.id,
                        ownerId: p.owner_id,
                        ownerName: p.owner_name,
                        name: p.name,
                        category: p.category,
                        status: p.status,
                        currentStage: p.current_stage,
                        progress: p.progress,
                        dueDate: p.due_date,
                        team: p.team || [],
                        image: p.image,
                        description: p.description,
                        contractStatus: p.contract_status,
                        contractText: p.contract_text,
                        externalUrl: p.external_url,
                        isPublic: p.is_public,
                        showInPortfolio: p.show_in_portfolio,
                    };
                    callback(project);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    },
};
