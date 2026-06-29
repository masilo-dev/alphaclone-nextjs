import { cleanupRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import { Project, UserRole } from '../types';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';
import { fileUploadService } from './fileUploadService';

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
            if (!tenantId) return { projects: [], error: null };

            let query = supabase
                .from('projects')
                .select('*')
                .eq('tenant_id', tenantId);

            // Regular clients: also filter by owner
            if (role !== 'tenant_admin' && role !== 'admin') {
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
                startDate: p.start_date,
                team: p.team || [],
                image: p.image,
                description: p.description,
                contractStatus: p.contract_status,
                contractText: p.contract_text,
                externalUrl: p.external_url,
                isPublic: p.is_public,
                showInPortfolio: p.show_in_portfolio,
                clientId: p.client_id,
                budget: p.budget,
                risk: p.risk,
                health: p.health,
                resources: p.resources || [],
                budgetTotal: p.budget_total,
                budgetUsed: p.budget_used,
                velocityScore: p.velocity_score,
                healthScore: p.health_score,
                portalToken: p.portal_token,
                portalEnabled: p.portal_enabled,
                estimatedCompletionDate: p.estimated_completion_date,
                autoInvoiceEnabled: p.auto_invoice_enabled,
                createdAt: p.created_at,
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
                // Ignore AbortErrors or cancellations (common during navigation)
                if (error.message?.includes('AbortError') || error.message?.includes('aborted') || error.code === '20') {
                    return { projects: [], error: null };
                }
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
     * Resolve a public project by opaque portal token (preferred) or legacy UUID.
     */
    async resolvePublicProjectRef(tokenOrId: string): Promise<{ projectId: string | null; portalToken: string | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('id, portal_token')
                .eq('is_public', true)
                .or(`portal_token.eq.${tokenOrId},id.eq.${tokenOrId}`)
                .maybeSingle();

            if (error || !data) {
                return { projectId: null, portalToken: null, error: error?.message || 'Project not found' };
            }

            return { projectId: data.id, portalToken: data.portal_token || null, error: null };
        } catch (err) {
            return { projectId: null, portalToken: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Ensure every public project has an opaque portal token (never expose raw UUIDs in client links).
     */
    async ensurePortalToken(projectId: string): Promise<{ token: string | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            let query = supabase.from('projects').select('portal_token').eq('id', projectId);
            if (tenantId) query = query.eq('tenant_id', tenantId);

            const { data: existing, error: readErr } = await query.single();
            if (readErr) return { token: null, error: readErr.message };

            if (existing?.portal_token) {
                return { token: existing.portal_token, error: null };
            }

            const token = crypto.randomUUID().replace(/-/g, '');
            const { error: updateErr } = await supabase
                .from('projects')
                .update({ portal_token: token, portal_enabled: true })
                .eq('id', projectId);

            if (updateErr) return { token: null, error: updateErr.message };
            return { token, error: null };
        } catch (err) {
            return { token: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get a specific public project's status by portal token or legacy ID (no auth required).
     * External views intentionally omit internal database IDs.
     */
    async getPublicProjectStatus(tokenOrId: string): Promise<{ project: Partial<Project> | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('is_public', true)
                .or(`portal_token.eq.${tokenOrId},id.eq.${tokenOrId}`)
                .maybeSingle();

            if (error || !data) {
                return { project: null, error: error?.message || 'Project not found' };
            }

            const project: Partial<Project> = {
                name: data.name,
                category: data.category,
                status: data.status,
                currentStage: data.current_stage,
                progress: data.progress,
                dueDate: data.due_date,
                ownerName: data.owner_name,
                image: data.image,
                description: data.description,
                portalToken: data.portal_token,
            };

            return { project, error: null };
        } catch (err) {
            return { project: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /** Empty strings become null so Postgres date columns do not receive "". */
    normalizeDateField(value: string | undefined | null): string | null {
        if (value == null) return null;
        const s = String(value).trim();
        return s.length > 0 ? s : null;
    },

    /**
     * Create a new project (with tenant assignment)
     */
    async createProject(project: Omit<Project, 'id'>, templateId?: string): Promise<{ project: Project | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const dueDate = this.normalizeDateField(project.dueDate);
            const startDate = this.normalizeDateField(project.startDate);

            const { data, error } = await supabase
                .from('projects')
                .insert({
                    tenant_id: tenantId || null,
                    owner_id: project.ownerId,
                    owner_name: project.ownerName,
                    name: project.name,
                    category: project.category,
                    status: project.status,
                    current_stage: project.currentStage,
                    progress: project.progress,
                    due_date: dueDate,
                    start_date: startDate,
                    team: project.team,
                    image: project.image,
                    description: project.description,
                    contract_status: project.contractStatus || 'None',
                    contract_text: project.contractText,
                    external_url: project.externalUrl,
                    is_public: project.isPublic,
                    show_in_portfolio: project.showInPortfolio,
                    client_id: project.clientId || null,
                    location: project.location,
                    budget: project.budget,
                    risk: project.risk,
                    health: project.health,
                    resources: project.resources,
                    budget_total: project.budgetTotal,
                    budget_used: project.budgetUsed || 0,
                    velocity_score: project.velocityScore,
                    health_score: project.healthScore,
                    portal_token: project.portalToken,
                    portal_enabled: project.portalEnabled || false,
                    estimated_completion_date: project.estimatedCompletionDate,
                    auto_invoice_enabled: project.autoInvoiceEnabled || false,
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
                startDate: data.start_date,
                team: data.team || [],
                image: data.image,
                description: data.description,
                contractStatus: data.contract_status,
                contractText: data.contract_text,
                externalUrl: data.external_url,
                isPublic: data.is_public,
                showInPortfolio: data.show_in_portfolio,
                clientId: data.client_id,
                budget: data.budget,
                risk: data.risk,
                health: data.health,
                resources: data.resources || [],
                budgetTotal: data.budget_total,
                budgetUsed: data.budget_used,
                velocityScore: data.velocity_score,
                healthScore: data.health_score,
                portalToken: data.portal_token,
                portalEnabled: data.portal_enabled,
                estimatedCompletionDate: data.estimated_completion_date,
                autoInvoiceEnabled: data.auto_invoice_enabled,
                createdAt: data.created_at,
            };

            // If a template is provided, apply it to the new project
            if (templateId) {
                const { projectTemplateService } = await import('./projectTemplateService');
                await projectTemplateService.applyTemplateToProject(newProject.id, templateId);
            }

            // Log activity
            if (project.ownerId) {
                activityService.logActivity(project.ownerId, 'Project Created', {
                    projectId: newProject.id,
                    projectName: newProject.name,
                    category: newProject.category,
                    status: newProject.status,
                    templateApplied: !!templateId
                }, tenantId || undefined).catch(err => console.error('Failed to log activity:', err));
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
            if (updates.dueDate !== undefined) {
                updateData.due_date = this.normalizeDateField(updates.dueDate);
            }
            if (updates.startDate !== undefined) {
                updateData.start_date = this.normalizeDateField(updates.startDate);
            }
            if (updates.team !== undefined) updateData.team = updates.team;
            if (updates.image !== undefined) updateData.image = updates.image;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.contractStatus !== undefined) updateData.contract_status = updates.contractStatus;
            if (updates.contractText !== undefined) updateData.contract_text = updates.contractText;
            if (updates.externalUrl !== undefined) updateData.external_url = updates.externalUrl;
            if (updates.isPublic !== undefined) updateData.is_public = updates.isPublic;
            if (updates.showInPortfolio !== undefined) updateData.show_in_portfolio = updates.showInPortfolio;
            if (updates.budget !== undefined) updateData.budget = updates.budget;
            if (updates.risk !== undefined) updateData.risk = updates.risk;
            if (updates.health !== undefined) updateData.health = updates.health;
            if (updates.resources !== undefined) updateData.resources = updates.resources;
            if (updates.budgetTotal !== undefined) updateData.budget_total = updates.budgetTotal;
            if (updates.budgetUsed !== undefined) updateData.budget_used = updates.budgetUsed;
            if (updates.velocityScore !== undefined) updateData.velocity_score = updates.velocityScore;
            if (updates.healthScore !== undefined) updateData.health_score = updates.healthScore;
            if (updates.portalToken !== undefined) updateData.portal_token = updates.portalToken;
            if (updates.portalEnabled !== undefined) updateData.portal_enabled = updates.portalEnabled;
            if (updates.estimatedCompletionDate !== undefined) {
                updateData.estimated_completion_date = this.normalizeDateField(updates.estimatedCompletionDate);
            }
            if (updates.autoInvoiceEnabled !== undefined) updateData.auto_invoice_enabled = updates.autoInvoiceEnabled;

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
                .select('owner_id, name, due_date, client_id, status, description')
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
                }, tenantId || undefined).catch(err => console.error('Failed to log activity:', err));
            }

            if (updates.dueDate !== undefined && tenantId && data?.owner_id) {
                void import('@/lib/calendar/nativeCalendarSync')
                    .then(({ syncProjectToNativeCalendar }) =>
                        syncProjectToNativeCalendar(tenantId, data.owner_id, {
                            id: projectId,
                            name: data.name,
                            description: data.description,
                            due_date: data.due_date,
                            status: data.status,
                            client_id: data.client_id,
                        })
                    )
                    .catch((err) => console.error('[projectService] native calendar sync failed:', err));
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

            // Reclaim storage space
            await fileUploadService.deleteFileByEntity('project', projectId);

            const { error } = await deleteQuery;

            return { error: error ? error.message : null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Recalculate project progress from milestones (preferred) or completed tasks.
     */
    async recalculateProjectProgress(projectId: string): Promise<{ progress: number; error: string | null }> {
        try {
            const { data: milestones, error: milestoneError } = await supabase
                .from('project_milestones')
                .select('status')
                .eq('project_id', projectId);

            if (milestoneError) throw milestoneError;

            if (milestones && milestones.length > 0) {
                const completed = milestones.filter((m: { status: string }) => m.status === 'completed').length;
                const progress = Math.round((completed / milestones.length) * 100);
                await this.updateProject(projectId, { progress });
                return { progress, error: null };
            }

            const { data: tasks, error } = await supabase
                .from('tasks')
                .select('status')
                .eq('related_to_project', projectId);

            if (error) throw error;

            if (!tasks || tasks.length === 0) {
                await this.updateProject(projectId, { progress: 0 });
                return { progress: 0, error: null };
            }

            const completedTasks = tasks.filter((t: { status: string }) => t.status === 'completed').length;
            const progress = Math.round((completedTasks / tasks.length) * 100);
            await this.updateProject(projectId, { progress });

            return { progress, error: null };
        } catch (err) {
            return { progress: 0, error: err instanceof Error ? err.message : 'Unknown error' };
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
            subscriptionConfig.filter = `tenant_id=eq.${tenantId.trim()}`;
        }

        const channelName = `projects_${tenantId ? tenantId.replace(/[^a-zA-Z0-9-_]/g, '_') : 'global'}`;
        const channel = supabase
            .channel(channelName)
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
                        clientId: p.client_id,
                        budget: p.budget,
                        risk: p.risk,
                        health: p.health,
                        resources: p.resources || [],
                        budgetTotal: p.budget_total,
                        budgetUsed: p.budget_used,
                        velocityScore: p.velocity_score,
                        healthScore: p.health_score,
                        portalToken: p.portal_token,
                        portalEnabled: p.portal_enabled,
                        estimatedCompletionDate: p.estimated_completion_date,
                        autoInvoiceEnabled: p.auto_invoice_enabled,
                        createdAt: p.created_at,
                    };
                    callback(project);
                }
            )
            .subscribe(async (status: string, err?: Error) => {
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Subscribed to real-time project updates');
                } else if (status === 'CHANNEL_ERROR') {
                    const msg = String(err?.message || '').toLowerCase();
                    if (msg.includes('unknown channel error') || msg.includes('channel error')) {
                        console.warn('[Realtime] Projects channel unavailable. Continuing without live updates.');
                    } else {
                        console.warn('[Realtime] Project subscription failed. Continuing without live updates.', err?.message || 'Unknown channel error');
                    }
                    // Proactive check: if we get a channel error, it's likely RLS or Realtime configuration
                } else if (status === 'TIMED_OUT') {
                    console.warn('[Realtime] Project subscription timed out. Retrying in 5s...');
                    setTimeout(() => projectService.subscribeToProjects(callback), 5000);
                }
            });

        return () => {
            cleanupRealtimeChannel(channel);
        };
    },
};
