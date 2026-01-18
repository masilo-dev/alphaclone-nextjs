import { supabase } from '../lib/supabase';

export type WorkflowTriggerType =
    | 'deal_stage_changed'
    | 'project_status_changed'
    | 'task_created'
    | 'task_completed'
    | 'invoice_paid'
    | 'invoice_overdue'
    | 'contract_signed'
    | 'message_received'
    | 'date_reached'
    | 'custom_field_changed';

export type WorkflowActionType =
    | 'create_task'
    | 'send_email'
    | 'send_notification'
    | 'update_field'
    | 'change_stage'
    | 'assign_user'
    | 'webhook'
    | 'wait';

export interface WorkflowEnterprise {
    id: string;
    name: string;
    description?: string;
    triggerType: WorkflowTriggerType;
    triggerConditions?: any;
    isActive: boolean;
    executionCount: number;
    lastExecutedAt?: string;
    createdBy?: string;
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface WorkflowActionEnterprise {
    id: string;
    workflowId: string;
    actionType: WorkflowActionType;
    actionOrder: number;
    actionConfig: any;
    delayMinutes: number;
    isActive: boolean;
    createdAt: string;
}

export interface WorkflowExecutionEnterprise {
    id: string;
    workflowId: string;
    triggeredByEntityType: string;
    triggeredByEntityId: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    completedAt?: string;
    errorMessage?: string;
    executionLog?: any[];
    metadata?: any;
    createdAt: string;
}

export const workflowServiceEnterprise = {
    /**
     * Get all workflows
     */
    async getWorkflows(includeInactive = false): Promise<{ workflows: WorkflowEnterprise[]; error: string | null }> {
        try {
            let query = supabase.from('workflows').select('*');

            if (!includeInactive) {
                query = query.eq('is_active', true);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;

            const workflows: WorkflowEnterprise[] = (data || []).map((w) => ({
                id: w.id,
                name: w.name,
                description: w.description,
                triggerType: w.trigger_type,
                triggerConditions: w.trigger_conditions || {},
                isActive: w.is_active,
                executionCount: w.execution_count,
                lastExecutedAt: w.last_executed_at,
                createdBy: w.created_by,
                metadata: w.metadata || {},
                createdAt: w.created_at,
                updatedAt: w.updated_at,
            }));

            return { workflows, error: null };
        } catch (err) {
            return { workflows: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get workflow by ID
     */
    async getWorkflowById(workflowId: string): Promise<{ workflow: WorkflowEnterprise | null; error: string | null }> {
        try {
            const { data, error } = await supabase.from('workflows').select('*').eq('id', workflowId).single();

            if (error) throw error;

            const workflow: WorkflowEnterprise = {
                id: data.id,
                name: data.name,
                description: data.description,
                triggerType: data.trigger_type,
                triggerConditions: data.trigger_conditions || {},
                isActive: data.is_active,
                executionCount: data.execution_count,
                lastExecutedAt: data.last_executed_at,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { workflow, error: null };
        } catch (err) {
            return { workflow: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create workflow
     */
    async createWorkflow(
        userId: string,
        workflowData: {
            name: string;
            description?: string;
            triggerType: WorkflowTriggerType;
            triggerConditions?: any;
            isActive?: boolean;
        }
    ): Promise<{ workflow: WorkflowEnterprise | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .insert({
                    name: workflowData.name,
                    description: workflowData.description,
                    trigger_type: workflowData.triggerType,
                    trigger_conditions: workflowData.triggerConditions || {},
                    is_active: workflowData.isActive !== undefined ? workflowData.isActive : true,
                    created_by: userId,
                })
                .select()
                .single();

            if (error) throw error;

            const workflow: WorkflowEnterprise = {
                id: data.id,
                name: data.name,
                description: data.description,
                triggerType: data.trigger_type,
                triggerConditions: data.trigger_conditions || {},
                isActive: data.is_active,
                executionCount: data.execution_count,
                lastExecutedAt: data.last_executed_at,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { workflow, error: null };
        } catch (err) {
            return { workflow: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update workflow
     */
    async updateWorkflow(
        workflowId: string,
        updates: Partial<WorkflowEnterprise>
    ): Promise<{ workflow: WorkflowEnterprise | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.name !== undefined) updateData.name = updates.name;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.triggerConditions !== undefined) updateData.trigger_conditions = updates.triggerConditions;
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

            const { data, error } = await supabase
                .from('workflows')
                .update(updateData)
                .eq('id', workflowId)
                .select()
                .single();

            if (error) throw error;

            const workflow: WorkflowEnterprise = {
                id: data.id,
                name: data.name,
                description: data.description,
                triggerType: data.trigger_type,
                triggerConditions: data.trigger_conditions || {},
                isActive: data.is_active,
                executionCount: data.execution_count,
                lastExecutedAt: data.last_executed_at,
                createdBy: data.created_by,
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { workflow, error: null };
        } catch (err) {
            return { workflow: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete workflow
     */
    async deleteWorkflow(workflowId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('workflows').delete().eq('id', workflowId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get workflow actions
     */
    async getWorkflowActions(workflowId: string): Promise<{ actions: WorkflowActionEnterprise[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflow_actions')
                .select('*')
                .eq('workflow_id', workflowId)
                .order('action_order', { ascending: true });

            if (error) throw error;

            const actions: WorkflowActionEnterprise[] = (data || []).map((a) => ({
                id: a.id,
                workflowId: a.workflow_id,
                actionType: a.action_type,
                actionOrder: a.action_order,
                actionConfig: a.action_config || {},
                delayMinutes: a.delay_minutes,
                isActive: a.is_active,
                createdAt: a.created_at,
            }));

            return { actions, error: null };
        } catch (err) {
            return { actions: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add action to workflow
     */
    async addWorkflowAction(
        workflowId: string,
        actionData: {
            actionType: WorkflowActionType;
            actionOrder: number;
            actionConfig: any;
            delayMinutes?: number;
        }
    ): Promise<{ action: WorkflowActionEnterprise | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflow_actions')
                .insert({
                    workflow_id: workflowId,
                    action_type: actionData.actionType,
                    action_order: actionData.actionOrder,
                    action_config: actionData.actionConfig,
                    delay_minutes: actionData.delayMinutes || 0,
                })
                .select()
                .single();

            if (error) throw error;

            const action: WorkflowActionEnterprise = {
                id: data.id,
                workflowId: data.workflow_id,
                actionType: data.action_type,
                actionOrder: data.action_order,
                actionConfig: data.action_config || {},
                delayMinutes: data.delay_minutes,
                isActive: data.is_active,
                createdAt: data.created_at,
            };

            return { action, error: null };
        } catch (err) {
            return { action: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update workflow action
     */
    async updateWorkflowAction(
        actionId: string,
        updates: Partial<WorkflowActionEnterprise>
    ): Promise<{ action: WorkflowActionEnterprise | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.actionOrder !== undefined) updateData.action_order = updates.actionOrder;
            if (updates.actionConfig !== undefined) updateData.action_config = updates.actionConfig;
            if (updates.delayMinutes !== undefined) updateData.delay_minutes = updates.delayMinutes;
            if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

            const { data, error } = await supabase
                .from('workflow_actions')
                .update(updateData)
                .eq('id', actionId)
                .select()
                .single();

            if (error) throw error;

            const action: WorkflowActionEnterprise = {
                id: data.id,
                workflowId: data.workflow_id,
                actionType: data.action_type,
                actionOrder: data.action_order,
                actionConfig: data.action_config || {},
                delayMinutes: data.delay_minutes,
                isActive: data.is_active,
                createdAt: data.created_at,
            };

            return { action, error: null };
        } catch (err) {
            return { action: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete workflow action
     */
    async deleteWorkflowAction(actionId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const { error } = await supabase.from('workflow_actions').delete().eq('id', actionId);

            if (error) throw error;

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get workflow executions
     */
    async getWorkflowExecutions(
        workflowId: string,
        limit = 50
    ): Promise<{ executions: WorkflowExecutionEnterprise[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflow_executions')
                .select('*')
                .eq('workflow_id', workflowId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            const executions: WorkflowExecutionEnterprise[] = (data || []).map((e) => ({
                id: e.id,
                workflowId: e.workflow_id,
                triggeredByEntityType: e.triggered_by_entity_type,
                triggeredByEntityId: e.triggered_by_entity_id,
                status: e.status,
                startedAt: e.started_at,
                completedAt: e.completed_at,
                errorMessage: e.error_message,
                executionLog: e.execution_log || [],
                metadata: e.metadata || {},
                createdAt: e.created_at,
            }));

            return { executions, error: null };
        } catch (err) {
            return { executions: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Trigger workflow manually
     */
    async triggerWorkflow(
        workflowId: string,
        entityType: string,
        entityId: string
    ): Promise<{ execution: WorkflowExecutionEnterprise | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflow_executions')
                .insert({
                    workflow_id: workflowId,
                    triggered_by_entity_type: entityType,
                    triggered_by_entity_id: entityId,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;

            // Increment execution count
            await supabase.rpc('increment_workflow_execution_count', { workflow_id: workflowId });

            const execution: WorkflowExecutionEnterprise = {
                id: data.id,
                workflowId: data.workflow_id,
                triggeredByEntityType: data.triggered_by_entity_type,
                triggeredByEntityId: data.triggered_by_entity_id,
                status: data.status,
                startedAt: data.started_at,
                completedAt: data.completed_at,
                errorMessage: data.error_message,
                executionLog: data.execution_log || [],
                metadata: data.metadata || {},
                createdAt: data.created_at,
            };

            return { execution, error: null };
        } catch (err) {
            return { execution: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get workflows by trigger type
     */
    async getWorkflowsByTrigger(
        triggerType: WorkflowTriggerType
    ): Promise<{ workflows: WorkflowEnterprise[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .select('*')
                .eq('trigger_type', triggerType)
                .eq('is_active', true);

            if (error) throw error;

            const workflows: WorkflowEnterprise[] = (data || []).map((w) => ({
                id: w.id,
                name: w.name,
                description: w.description,
                triggerType: w.trigger_type,
                triggerConditions: w.trigger_conditions || {},
                isActive: w.is_active,
                executionCount: w.execution_count,
                lastExecutedAt: w.last_executed_at,
                createdBy: w.created_by,
                metadata: w.metadata || {},
                createdAt: w.created_at,
                updatedAt: w.updated_at,
            }));

            return { workflows, error: null };
        } catch (err) {
            return { workflows: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
