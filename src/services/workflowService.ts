import { supabase } from '../lib/supabase';
import { tenantService } from './tenancy/TenantService';

export interface WorkflowStep {
    id: string;
    type: 'trigger' | 'condition' | 'action' | 'delay';
    name: string;
    config: Record<string, any>;
    nextStepId?: string;
    condition?: {
        field: string;
        operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
        value: any;
    };
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    enabled: boolean;
    trigger: {
        type: 'project_created' | 'message_received' | 'invoice_paid' | 'status_changed' | 'manual';
        config: Record<string, any>;
    };
    steps: WorkflowStep[];
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

export const workflowService = {
    /**
     * Create a new workflow
     */
    async createWorkflow(workflow: Omit<Workflow, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ workflow: Workflow | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .insert({
                    name: workflow.name,
                    description: workflow.description,
                    enabled: workflow.enabled,
                    trigger: workflow.trigger,
                    steps: workflow.steps,
                    created_by: workflow.createdBy,
                    tenant_id: tenantService.getCurrentTenantId(),
                })
                .select()
                .single();

            if (error) throw error;

            return {
                workflow: {
                    id: data.id,
                    name: data.name,
                    description: data.description,
                    enabled: data.enabled,
                    trigger: data.trigger,
                    steps: data.steps,
                    createdBy: data.created_by,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at,
                },
                error: null,
            };
        } catch (error) {
            return {
                workflow: null,
                error: error instanceof Error ? error.message : 'Failed to create workflow',
            };
        }
    },

    /**
     * Get all workflows
     */
    async getWorkflows(userId: string): Promise<{ workflows: Workflow[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('workflows')
                .select('*')
                .eq('created_by', userId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .order('created_at', { ascending: false });

            if (error) throw error;

            return {
                workflows: (data || []).map((w: any) => ({
                    id: w.id,
                    name: w.name,
                    description: w.description,
                    enabled: w.enabled,
                    trigger: w.trigger,
                    steps: w.steps,
                    createdBy: w.created_by,
                    createdAt: w.created_at,
                    updatedAt: w.updated_at,
                })),
                error: null,
            };
        } catch (error) {
            return {
                workflows: [],
                error: error instanceof Error ? error.message : 'Failed to fetch workflows',
            };
        }
    },

    /**
     * Execute a workflow
     */
    async executeWorkflow(workflowId: string, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        try {
            const { data: workflow, error: fetchError } = await supabase
                .from('workflows')
                .select('*')
                .eq('id', workflowId)
                .eq('tenant_id', tenantService.getCurrentTenantId())
                .eq('enabled', true)
                .single();

            if (fetchError || !workflow) {
                return { success: false, error: 'Workflow not found or disabled' };
            }

            // Execute steps in order
            let currentStep = workflow.steps.find((s: WorkflowStep) => s.type === 'trigger');
            if (!currentStep) {
                return { success: false, error: 'Workflow has no trigger step' };
            }

            while (currentStep) {
                // Execute step
                const stepResult = await this.executeStep(currentStep, context);

                if (!stepResult.success) {
                    return { success: false, error: stepResult.error || 'Step execution failed' };
                }

                // Move to next step
                if (currentStep.nextStepId) {
                    currentStep = workflow.steps.find((s: WorkflowStep) => s.id === currentStep.nextStepId);
                } else {
                    break;
                }
            }

            // Log execution
            await supabase.from('workflow_executions').insert({
                workflow_id: workflowId,
                context,
                status: 'completed',
                executed_at: new Date().toISOString(),
                tenant_id: tenantService.getCurrentTenantId(),
            });

            return { success: true, error: null };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Workflow execution failed',
            };
        }
    },

    /**
     * Execute a single workflow step
     */
    async executeStep(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        try {
            switch (step.type) {
                case 'action':
                    return await this.executeAction(step, context);
                case 'condition':
                    return await this.executeCondition(step, context);
                case 'delay':
                    return await this.executeDelay(step, context);
                default:
                    return { success: true, error: null };
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Step execution failed',
            };
        }
    },

    /**
     * Execute an action step
     */
    async executeAction(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const actionType = step.config.type;

        switch (actionType) {
            case 'send_message':
                // Send message via messageService
                const { messageService } = await import('./messageService');
                await messageService.sendMessage(
                    context.userId || step.config.senderId,
                    step.config.recipientId,
                    step.config.message,
                    step.config.priority || 'normal'
                );
                return { success: true, error: null };

            case 'update_project':
                // Update project status
                const { projectService } = await import('./projectService');
                await projectService.updateProject(step.config.projectId, {
                    status: step.config.status,
                });
                return { success: true, error: null };

            case 'create_invoice':
                // Create invoice
                const { paymentService } = await import('./paymentService');
                await paymentService.createInvoice({
                    user_id: context.userId,
                    project_id: step.config.projectId,
                    amount: step.config.amount,
                    description: step.config.description,
                    currency: 'USD',
                    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                    items: [],
                });
                return { success: true, error: null };

            case 'send_email':
                // Send email notification
                // This would integrate with Resend or similar
                return { success: true, error: null };

            default:
                return { success: false, error: `Unknown action type: ${actionType}` };
        }
    },

    /**
     * Execute a condition step
     */
    async executeCondition(step: WorkflowStep, context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        if (!step.condition) {
            return { success: true, error: null };
        }

        const fieldValue = context[step.condition.field];
        let conditionMet = false;

        switch (step.condition.operator) {
            case 'equals':
                conditionMet = fieldValue === step.condition.value;
                break;
            case 'contains':
                conditionMet = String(fieldValue).includes(String(step.condition.value));
                break;
            case 'greater_than':
                conditionMet = Number(fieldValue) > Number(step.condition.value);
                break;
            case 'less_than':
                conditionMet = Number(fieldValue) < Number(step.condition.value);
                break;
        }

        return { success: conditionMet, error: conditionMet ? null : 'Condition not met' };
    },

    /**
     * Execute a delay step
     */
    async executeDelay(step: WorkflowStep, _context: Record<string, any>): Promise<{ success: boolean; error: string | null }> {
        const delayMs = step.config.delaySeconds * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return { success: true, error: null };
    },
};

