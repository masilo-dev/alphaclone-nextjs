import { tenantService } from './tenancy/TenantService';

export interface ProjectTemplate {
    id: string;
    name: string;
    description?: string;
    templateKey?: string;
    version?: number;
    createdAt: string;
}

export interface TemplatePhase {
    id: string;
    templateId: string;
    name: string;
    description?: string;
    orderIndex: number;
    relativeDaysFromStart: number;
}

export interface TemplateTask {
    id: string;
    templateId: string;
    phaseId?: string | null;
    taskKey: string;
    title: string;
    description?: string;
    priority: string;
    relativeStartDays: number;
    relativeDueDays?: number | null;
    weight: number;
    requiresApproval: boolean;
    orderIndex: number;
}

export interface TemplateDependency {
    taskKey: string;
    dependsOnTaskKey: string;
    dependencyType: string;
    lagMinutes: number;
}

export interface ProjectTemplatePreview {
    template: ProjectTemplate;
    phases: TemplatePhase[];
    tasks: TemplateTask[];
    dependencies: TemplateDependency[];
}

async function readJson(response: Response): Promise<any> {
    return response.json().catch(() => ({}));
}

export const projectTemplateService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant context.');
        return tenantId;
    },

    async getTemplates(): Promise<{ templates: ProjectTemplate[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(`/api/tenant/${encodeURIComponent(tenantId)}/project-templates`, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });
            const payload = await readJson(response);
            if (!response.ok) throw new Error(payload.error || 'Project templates could not be loaded');

            const templates: ProjectTemplate[] = (payload.templates || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                templateKey: t.template_key,
                version: t.version,
                createdAt: t.created_at,
            }));

            return { templates, error: null };
        } catch (err) {
            return { templates: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async getTemplatePreview(templateId: string): Promise<{ preview: ProjectTemplatePreview | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const response = await fetch(
                `/api/tenant/${encodeURIComponent(tenantId)}/project-templates?templateId=${encodeURIComponent(templateId)}`,
                { method: 'GET', headers: { Accept: 'application/json' } },
            );
            const payload = await readJson(response);
            if (!response.ok) throw new Error(payload.error || 'Project template could not be loaded');

            const template: ProjectTemplate = {
                id: payload.template.id,
                name: payload.template.name,
                description: payload.template.description,
                templateKey: payload.template.template_key,
                version: payload.template.version,
                createdAt: payload.template.created_at,
            };
            const phases: TemplatePhase[] = (payload.phases || []).map((p: any) => ({
                id: p.id,
                templateId: p.template_id,
                name: p.name,
                description: p.description,
                orderIndex: p.order_index,
                relativeDaysFromStart: p.relative_days_from_start,
            }));
            const tasks: TemplateTask[] = (payload.tasks || []).map((t: any) => ({
                id: t.id,
                templateId: t.template_id,
                phaseId: t.phase_id,
                taskKey: t.task_key,
                title: t.title,
                description: t.description,
                priority: t.priority,
                relativeStartDays: t.relative_start_days,
                relativeDueDays: t.relative_due_days,
                weight: Number(t.weight ?? 1),
                requiresApproval: Boolean(t.requires_approval),
                orderIndex: t.order_index,
            }));
            const dependencies: TemplateDependency[] = (payload.dependencies || []).map((d: any) => ({
                taskKey: d.task_key,
                dependsOnTaskKey: d.depends_on_task_key,
                dependencyType: d.dependency_type,
                lagMinutes: d.lag_minutes,
            }));

            return { preview: { template, phases, tasks, dependencies }, error: null };
        } catch (err) {
            return { preview: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async getTemplatePhases(templateId: string): Promise<{ phases: TemplatePhase[]; error: string | null }> {
        const { preview, error } = await this.getTemplatePreview(templateId);
        return { phases: preview?.phases || [], error };
    },
};
