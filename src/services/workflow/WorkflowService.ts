/**
 * Workflow Service - Main API
 * High-level API for workflow management
 */

import { supabase } from '../../lib/supabase';
import { workflowEngine } from './WorkflowEngine';
import type {
    Workflow,
    WorkflowDefinition,
    WorkflowInstance,
    WorkflowTemplate,
    WorkflowStats
} from './types';

class WorkflowService {
    /**
     * Create a new workflow
     */
    async createWorkflow(data: {
        name: string;
        description?: string;
        definition: WorkflowDefinition;
        isActive?: boolean;
    }): Promise<Workflow> {
        const { data: workflow, error } = await supabase
            .from('workflows')
            .insert({
                name: data.name,
                description: data.description,
                definition: data.definition,
                trigger_config: data.definition.trigger,
                is_active: data.isActive ?? true
            })
            .select()
            .single();

        if (error) throw error;
        return workflow as Workflow;
    }

    /**
     * Update workflow
     */
    async updateWorkflow(
        workflowId: string,
        updates: Partial<Workflow>
    ): Promise<Workflow> {
        const { data, error } = await supabase
            .from('workflows')
            .update(updates)
            .eq('id', workflowId)
            .select()
            .single();

        if (error) throw error;
        return data as Workflow;
    }

    /**
     * Delete workflow
     */
    async deleteWorkflow(workflowId: string): Promise<void> {
        const { error } = await supabase
            .from('workflows')
            .delete()
            .eq('id', workflowId);

        if (error) throw error;
    }

    /**
     * Get workflow by ID
     */
    async getWorkflow(workflowId: string): Promise<Workflow | null> {
        const { data, error } = await supabase
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

        if (error) return null;
        return data as Workflow;
    }

    /**
     * List all workflows
     */
    async listWorkflows(filters?: {
        isActive?: boolean;
        isTemplate?: boolean;
    }): Promise<Workflow[]> {
        let query = supabase.from('workflows').select('*');

        if (filters?.isActive !== undefined) {
            query = query.eq('is_active', filters.isActive);
        }
        if (filters?.isTemplate !== undefined) {
            query = query.eq('is_template', filters.isTemplate);
        }

        const { data } = await query.order('created_at', { ascending: false });
        return (data || []) as Workflow[];
    }

    /**
     * Execute workflow
     */
    async executeWorkflow(
        workflowId: string,
        inputData?: Record<string, any>
    ): Promise<WorkflowInstance> {
        return workflowEngine.executeWorkflow(workflowId, inputData);
    }

    /**
     * Get workflow instance
     */
    async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
        const { data } = await supabase
            .from('workflow_instances')
            .select('*')
            .eq('id', instanceId)
            .single();

        return data as WorkflowInstance | null;
    }

    /**
     * List workflow instances
     */
    async listInstances(workflowId?: string): Promise<WorkflowInstance[]> {
        let query = supabase
            .from('workflow_instances')
            .select('*')
            .order('started_at', { ascending: false });

        if (workflowId) {
            query = query.eq('workflow_id', workflowId);
        }

        const { data } = await query;
        return (data || []) as WorkflowInstance[];
    }

    /**
     * Cancel workflow instance
     */
    async cancelInstance(instanceId: string): Promise<void> {
        await supabase
            .from('workflow_instances')
            .update({ status: 'cancelled' })
            .eq('id', instanceId);
    }

    /**
     * Get workflow templates
     */
    async getTemplates(category?: string): Promise<WorkflowTemplate[]> {
        let query = supabase
            .from('workflow_templates')
            .select('*')
            .order('usage_count', { ascending: false });

        if (category) {
            query = query.eq('category', category);
        }

        const { data } = await query;
        return (data || []) as WorkflowTemplate[];
    }

    /**
     * Create workflow from template
     */
    async createFromTemplate(
        templateId: string,
        name: string
    ): Promise<Workflow> {
        const { data: template } = await supabase
            .from('workflow_templates')
            .select('*')
            .eq('id', templateId)
            .single();

        if (!template) {
            throw new Error('Template not found');
        }

        // Increment usage count
        await supabase
            .from('workflow_templates')
            .update({ usage_count: template.usage_count + 1 })
            .eq('id', templateId);

        // Create workflow from template
        return this.createWorkflow({
            name,
            description: template.description,
            definition: template.definition
        });
    }

    /**
     * Get workflow statistics
     */
    async getStatistics(workflowId?: string): Promise<WorkflowStats> {
        const { data } = await supabase.rpc('get_workflow_stats', {
            p_workflow_id: workflowId
        });

        return data?.[0] || {
            totalRuns: 0,
            successfulRuns: 0,
            failedRuns: 0,
            avgExecutionTimeMs: 0
        };
    }
}

export const workflowService = new WorkflowService();
