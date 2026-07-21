import { cleanupRealtimeChannel } from '../lib/realtime';
import { supabase } from '../lib/supabase';
import { Project, UserRole } from '../types';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';

function mapProjectRow(data: any): Project {
    return {
        id: data.id, dealId: data.deal_id, contractId: data.contract_id, ownerId: data.owner_id, ownerName: data.owner_name,
        name: data.name, category: data.category, status: data.status, currentStage: data.current_stage, progress: data.progress,
        dueDate: data.due_date, startDate: data.start_date, team: data.team || [], image: data.image, description: data.description,
        contractStatus: data.contract_status, contractText: data.contract_text, externalUrl: data.external_url, isPublic: data.is_public,
        showInPortfolio: data.show_in_portfolio, clientId: data.client_id, location: data.location, budget: data.budget, risk: data.risk,
        health: data.health, resources: data.resources || [], budgetTotal: data.budget_total, budgetUsed: data.budget_used,
        velocityScore: data.velocity_score, healthScore: data.health_score, portalToken: data.portal_token, portalEnabled: data.portal_enabled,
        estimatedCompletionDate: data.estimated_completion_date, autoInvoiceEnabled: data.auto_invoice_enabled, createdAt: data.created_at,
    } as Project;
}

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
                dealId: p.deal_id,
                contractId: p.contract_id,
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
                dealId: p.deal_id,
                contractId: p.contract_id,
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
            if (!tenantId) return { token: null, error: 'Select a workspace first' };
            const response = await fetch(`/api/tenant/${tenantId}/projects/${projectId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ensure_portal_token' }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return { token: null, error: payload.error || 'Portal link could not be created' };
            return { token: payload.token, error: null };
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
            if (!tenantId) return { project: null, error: 'Select a workspace first' };
            const response = await fetch(`/api/tenant/${tenantId}/projects`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...project, templateId }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.project) return { project: null, error: payload.error || 'Project could not be created' };
            const newProject = mapProjectRow(payload.project);
            if (newProject.ownerId) {
                activityService.logActivity(newProject.ownerId, 'Project Created', { projectId: newProject.id, projectName: newProject.name, category: newProject.category, status: newProject.status, templateApplied: Boolean(templateId) }, tenantId).catch(() => undefined);
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
            if (!tenantId) return { error: 'Select a workspace first' };
            const response = await fetch(`/api/tenant/${tenantId}/projects/${projectId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.project) return { error: payload.error || 'Project could not be updated' };
            const data = payload.project;
            activityService.logActivity(data.owner_id, 'Project Updated', { projectId, projectName: data.name, updatedFields: Object.keys(updates).join(', ') }, tenantId).catch(() => undefined);
            if (updates.dueDate !== undefined && data.owner_id) {
                void import('@/lib/calendar/nativeCalendarSync').then(({ syncProjectToNativeCalendar }) => syncProjectToNativeCalendar(tenantId, data.owner_id, { id: projectId, name: data.name, description: data.description, due_date: data.due_date, status: data.status, client_id: data.client_id })).catch(() => undefined);
            }
            if (updates.currentStage !== undefined && payload.previousStage && payload.previousStage !== updates.currentStage) void this.notifyClientStageChange(projectId, payload.previousStage, updates.currentStage);
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
            if (!tenantId) return { error: 'Select a workspace first' };
            const response = await fetch(`/api/tenant/${tenantId}/projects/${projectId}`, { method: 'DELETE' });
            const payload = await response.json().catch(() => ({}));
            return { error: response.ok ? null : payload.error || 'Project could not be deleted' };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Best-effort no-reply email to linked client when portal is public.
     */
    async notifyClientByApi(
        projectId: string,
        body: Record<string, unknown>
    ): Promise<{ sent?: boolean; skipped?: string } | null> {
        const tenantId = this.getTenantId();
        if (!tenantId) return null;
        try {
            const res = await fetch(`/api/projects/${projectId}/client-notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ tenantId, ...body }),
            });
            return await res.json().catch(() => null);
        } catch (err) {
            console.warn('[projectService] client notify failed:', err);
            return null;
        }
    },

    async notifyClientProgressChange(
        projectId: string,
        previousProgress: number | null,
        newProgress: number,
        trigger: 'progress_change' | 'milestone' | 'manual' = 'progress_change'
    ): Promise<void> {
        if (previousProgress === newProgress) return;
        await this.notifyClientByApi(projectId, {
            type: 'progress',
            previousProgress,
            newProgress,
            trigger,
        });
    },

    async notifyClientStageChange(
        projectId: string,
        previousStage: string,
        newStage: string
    ): Promise<void> {
        if (previousStage === newStage) return;
        await this.notifyClientByApi(projectId, {
            type: 'stage',
            previousStage,
            newStage,
        });
    },

    async notifyClientProjectNote(
        projectId: string,
        noteContent: string,
        authorName?: string
    ): Promise<{ sent?: boolean; skipped?: string } | null> {
        return this.notifyClientByApi(projectId, {
            type: 'note',
            noteContent,
            authorName,
        });
    },

    /**
     * Recalculate project progress from milestones (preferred) or completed tasks.
     */
    async recalculateProjectProgress(projectId: string): Promise<{ progress: number; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            if (!tenantId) return { progress: 0, error: 'Select a workspace first' };
            const response = await fetch(`/api/tenant/${tenantId}/projects/${projectId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'recalculate_progress' }) });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) return { progress: 0, error: payload.error || 'Project progress could not be recalculated' };
            return { progress: payload.progress, error: null };
        } catch (err) {
            return { progress: 0, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Subscribe to real-time project updates (filtered by tenant)
     */
    subscribeToProjects(callback: (project: Project) => void) {
        const tenantId = this.getTenantId();
        if (!tenantId) {
            return () => { };
        }

        // Build subscription config
        const subscriptionConfig: any = {
            event: '*',
            schema: 'public',
            table: 'projects',
            filter: `tenant_id=eq.${tenantId.trim()}`,
        };

        const channelName = `projects_${tenantId.replace(/[^a-zA-Z0-9-_]/g, '_')}`;
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
