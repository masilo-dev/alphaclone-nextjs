import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';
import { milestoneService } from './milestoneService';

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
    },

    async createTemplate(name: string, description: string, phases: Omit<TemplatePhase, 'id' | 'templateId'>[]): Promise<{ error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // 1. Create Template
            const { data: template, error: tError } = await supabase
                .from('project_templates')
                .insert({ tenant_id: tenantId, name, description })
                .select()
                .single();

            if (tError) throw tError;

            // 2. Create Phases
            if (phases.length > 0) {
                const phaseData = phases.map(p => ({
                    template_id: template.id,
                    name: p.name,
                    description: p.description,
                    order_index: p.orderIndex,
                    relative_days_from_start: p.relativeDaysFromStart
                }));

                const { error: pError } = await supabase
                    .from('project_template_phases')
                    .insert(phaseData);

                if (pError) throw pError;
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Apply a template to an existing project by generating milestones
     */
    async applyTemplateToProject(projectId: string, templateId: string): Promise<{ error: string | null }> {
        try {
            const { phases, error: pError } = await this.getTemplatePhases(templateId);
            if (pError) throw new Error(pError);

            for (const phase of phases) {
                // Calculate due date based on relative days if needed
                // For now, we just create the Milestones
                await milestoneService.createMilestone(projectId, {
                    name: phase.name,
                    description: phase.description,
                    status: 'pending'
                });
            }

            return { error: null };
        } catch (err) {
            return { error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }
};
