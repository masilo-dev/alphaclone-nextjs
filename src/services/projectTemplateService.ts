import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface ProjectTemplate {
    id: string;
    name: string;
    description?: string;
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

export const projectTemplateService = {
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant context.');
        return tenantId;
    },

    async getTemplates(): Promise<{ templates: ProjectTemplate[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data, error } = await supabase
                .from('project_templates')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error) throw error;

            const templates: ProjectTemplate[] = (data || []).map((t: any) => ({
                id: t.id,
                name: t.name,
                description: t.description,
                createdAt: t.created_at
            }));

            return { templates, error: null };
        } catch (err) {
            return { templates: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    async getTemplatePhases(templateId: string): Promise<{ phases: TemplatePhase[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const { data: template, error: templateError } = await supabase.from('project_templates').select('id').eq('id', templateId).eq('tenant_id', tenantId).maybeSingle();
            if (templateError) throw templateError;
            if (!template) throw new Error('Project template not found in this workspace');
            const { data, error } = await supabase
                .from('project_template_phases')
                .select('*')
                .eq('template_id', templateId)
                .order('order_index');

            if (error) throw error;

            const phases: TemplatePhase[] = (data || []).map((p: any) => ({
                id: p.id,
                templateId: p.template_id,
                name: p.name,
                description: p.description,
                orderIndex: p.order_index,
                relativeDaysFromStart: p.relative_days_from_start
            }));

            return { phases, error: null };
        } catch (err) {
            return { phases: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
};
