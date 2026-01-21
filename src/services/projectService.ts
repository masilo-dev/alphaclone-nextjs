import { supabase } from '../lib/supabase';
import { Project, UserRole } from '../types';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';

export const projectService = {
    /**
     * Get current tenant ID (helper method)
     * Returns null if no tenant is set (for backward compatibility)
     */
    getTenantId(): string | null {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) {
            console.warn('No active tenant found. Creating project without tenant assignment.');
            return null;
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
                .select('*');

            // Only filter by tenant if tenant ID exists
            if (tenantId) {
                query = query.eq('tenant_id', tenantId);
            }

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
                console.warn("Error fetching public projects (non-critical):", error);
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
     * Get a specific public project's status by ID (no auth required)
     * Used for the shared external link
     */
    async getPublicProjectStatus(projectId: string): Promise<{ project: Partial<Project> | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .eq('is_public', true) // CRITICAL: Only allow if explicitly public
                .single();

            if (error) {
                return { project: null, error: error.message };
            }

            // Return limited fields/readonly view
            const project: Partial<Project> = {
                id: data.id,
                name: data.name,
                category: data.category,
                status: data.status,
                currentStage: data.current_stage,
                progress: data.progress,
                dueDate: data.due_date,
                ownerName: data.owner_name,
                image: data.image,
                description: data.description,
            };

            return { project, error: null };
        } catch (err) {
            return { project: null, error: err instanceof Error ? err.message : 'Unknown error' };
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
                    tenant_id: tenantId || null, // ← ASSIGN TO TENANT (null if no tenant)
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

            // Build update query
            let updateQuery = supabase
                .from('projects')
                .update(updateData)
                .eq('id', projectId);

            // Only verify tenant ownership if tenant exists
            if (tenantId) {
                updateQuery = updateQuery.eq('tenant_id', tenantId);
            }

            const { error, data } = await updateQuery
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

            let deleteQuery = supabase
                .from('projects')
                .delete()
                .eq('id', projectId);

            // Only verify tenant ownership if tenant exists
            if (tenantId) {
                deleteQuery = deleteQuery.eq('tenant_id', tenantId);
            }

            const { error } = await deleteQuery;

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

        // Build subscription config
        const subscriptionConfig: any = {
            event: '*',
            schema: 'public',
            table: 'projects'
        };

        // Only filter by tenant if tenant exists
        if (tenantId) {
            subscriptionConfig.filter = `tenant_id=eq.${tenantId}`;
        }

        const channel = supabase
            .channel('projects_channel')
            .on(
                'postgres_changes',
                subscriptionConfig,
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
