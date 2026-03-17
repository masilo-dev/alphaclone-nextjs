/**
 * Workflow Engine - Core Service
 * Executes and manages workflow instances
 */

import { supabase } from '../../lib/supabase';
import { eventBus } from '../eventBus';
import type {
    Workflow,
    WorkflowInstance,
    WorkflowStep,
    WorkflowContext,
    StepExecutor,
    WorkflowStatus
} from './types';
import { stepExecutors } from './executors';

class WorkflowEngine {
    private executors: Map<string, StepExecutor> = new Map();

    constructor() {
        // Register default step executors
        this.registerExecutors();

        // Listen for workflow trigger events
        this.setupEventListeners();
    }

    /**
     * Execute a workflow
     */
    async executeWorkflow(
        workflowId: string,
        inputData: Record<string, any> = {}
    ): Promise<WorkflowInstance> {
        try {
            // Load workflow definition
            const workflow = await this.loadWorkflow(workflowId);

            if (!workflow.isActive) {
                throw new Error('Workflow is not active');
            }

            // Create workflow instance
            const instance = await this.createInstance(workflow, inputData);

            // Execute workflow steps
            await this.executeSteps(instance, workflow);

            return instance;
        } catch (error: any) {
            console.error('[WorkflowEngine] Execution failed:', error);
            throw error;
        }
    }

    /**
     * Execute workflow steps sequentially
     */
    private async executeSteps(
        instance: WorkflowInstance,
        workflow: Workflow
    ): Promise<void> {
        const steps = workflow.definition.steps;
        const context: WorkflowContext = {
            instanceId: instance.id,
            workflowId: workflow.id,
            variables: { ...instance.inputData },
            stepResults: {}
        };

        try {
            // Update status to running
            await this.updateInstanceStatus(instance.id, 'running');

            for (const step of steps) {
                // Check if step should be executed (condition)
                if (step.condition && !this.evaluateCondition(step.condition, context)) {
                    await this.logStep(instance.id, step, 'skipped');
                    continue;
                }

                // Execute step
                const result = await this.executeStep(step, context);

                // Store result in context
                context.stepResults[step.id] = result;

                // Update current step
                await this.updateInstanceStatus(instance.id, 'running', step.id);
            }

            // Mark as completed
            await this.updateInstanceStatus(instance.id, 'completed');
            await this.updateInstanceOutput(instance.id, context.stepResults);

        } catch (error: any) {
            console.error('[WorkflowEngine] Step execution failed:', error);
            await this.updateInstanceStatus(instance.id, 'failed', undefined, error.message);
            throw error;
        }
    }

    /**
     * Execute a single workflow step
     */
    private async executeStep(
        step: WorkflowStep,
        context: WorkflowContext
    ): Promise<any> {
        const startTime = Date.now();

        try {
            // Log step start
            await this.logStep(context.instanceId, step, 'running');

            // Get executor for step type
            const executor = this.executors.get(step.type);
            if (!executor) {
                throw new Error(`No executor found for step type: ${step.type}`);
            }

            // Execute step
            const result = await executor(step, context);

            // Log step completion
            const executionTime = Date.now() - startTime;
            await this.logStep(
                context.instanceId,
                step,
                'completed',
                step.config,
                result,
                executionTime
            );

            // Publish step completed event
            await eventBus.publish({
                eventType: 'workflow.step.completed',
                eventSource: 'workflow_engine',
                eventData: {
                    instanceId: context.instanceId,
                    stepId: step.id,
                    stepType: step.type,
                    result
                }
            });

            return result;

        } catch (error: any) {
            const executionTime = Date.now() - startTime;

            // Log step failure
            await this.logStep(
                context.instanceId,
                step,
                'failed',
                step.config,
                undefined,
                executionTime,
                error.message
            );

            // Handle error based on step config
            if (step.onError === 'continue') {
                console.warn(`[WorkflowEngine] Step ${step.id} failed but continuing:`, error);
                return null;
            } else if (step.onError === 'retry' && step.retryConfig) {
                return this.retryStep(step, context);
            } else {
                throw error;
            }
        }
    }

    /**
     * Retry a failed step
     */
    private async retryStep(
        step: WorkflowStep,
        context: WorkflowContext,
        attempt: number = 1
    ): Promise<any> {
        const maxRetries = step.retryConfig?.maxRetries || 3;
        const delay = step.retryConfig?.delayMs || 1000;

        if (attempt > maxRetries) {
            throw new Error(`Step ${step.id} failed after ${maxRetries} retries`);
        }

        console.log(`[WorkflowEngine] Retrying step ${step.id}, attempt ${attempt}/${maxRetries}`);

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        try {
            return await this.executeStep(step, context);
        } catch (error) {
            return this.retryStep(step, context, attempt + 1);
        }
    }

    /**
     * Evaluate step condition
     */
    private evaluateCondition(
        condition: string,
        context: WorkflowContext
    ): boolean {
        try {
            // Simple condition evaluation
            // In production, use a safe expression evaluator
            const func = new Function('context', `return ${condition}`);
            return func(context);
        } catch (error) {
            console.error('[WorkflowEngine] Condition evaluation failed:', error);
            return false;
        }
    }

    /**
     * Register step executors
     */
    private registerExecutors(): void {
        for (const [type, executor] of Object.entries(stepExecutors)) {
            this.executors.set(type, executor);
        }
    }

    /**
     * Register custom step executor
     */
    registerExecutor(type: string, executor: StepExecutor): void {
        this.executors.set(type, executor);
    }

    /**
     * Setup event listeners for workflow triggers
     */
    private setupEventListeners(): void {
        // Listen for events that trigger workflows
        eventBus.subscribe('*', async (event) => {
            const workflows = await this.getWorkflowsByTrigger(event.eventType);

            for (const workflow of workflows) {
                await this.executeWorkflow(workflow.id, event.eventData);
            }
        });
    }

    /**
     * Load workflow from database
     */
    private async loadWorkflow(workflowId: string): Promise<Workflow> {
        const { data, error } = await supabase
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .single();

        if (error) throw error;
        if (!data) throw new Error('Workflow not found');

        return data as Workflow;
    }

    /**
     * Create workflow instance
     */
    private async createInstance(
        workflow: Workflow,
        inputData: Record<string, any>
    ): Promise<WorkflowInstance> {
        const { data, error } = await supabase.rpc('create_workflow_instance', {
            p_workflow_id: workflow.id,
            p_input_data: inputData
        });

        if (error) throw error;

        const { data: instance } = await supabase
            .from('workflow_instances')
            .select('*')
            .eq('id', data)
            .single();

        return instance as WorkflowInstance;
    }

    /**
     * Update workflow instance status
     */
    private async updateInstanceStatus(
        instanceId: string,
        status: WorkflowStatus,
        currentStep?: string,
        errorMessage?: string
    ): Promise<void> {
        await supabase.rpc('update_workflow_instance_status', {
            p_instance_id: instanceId,
            p_status: status,
            p_current_step: currentStep,
            p_error_message: errorMessage
        });
    }

    /**
     * Update workflow instance output
     */
    private async updateInstanceOutput(
        instanceId: string,
        outputData: Record<string, any>
    ): Promise<void> {
        await supabase
            .from('workflow_instances')
            .update({ output_data: outputData })
            .eq('id', instanceId);
    }

    /**
     * Log workflow step execution
     */
    private async logStep(
        instanceId: string,
        step: WorkflowStep,
        status: string,
        inputData?: any,
        outputData?: any,
        executionTimeMs?: number,
        errorMessage?: string
    ): Promise<void> {
        await supabase.rpc('log_workflow_step', {
            p_instance_id: instanceId,
            p_step_id: step.id,
            p_step_name: step.name || step.id,
            p_step_type: step.type,
            p_status: status,
            p_input_data: inputData,
            p_output_data: outputData,
            p_error_message: errorMessage,
            p_execution_time_ms: executionTimeMs
        });
    }

    /**
     * Get workflows by trigger event
     */
    private async getWorkflowsByTrigger(eventType: string): Promise<Workflow[]> {
        const { data } = await supabase
            .from('workflows')
            .select('*')
            .eq('is_active', true)
            .contains('trigger_config', { type: 'event', event: eventType });

        return (data || []) as Workflow[];
    }

    /**
     * Get workflow statistics
     */
    async getStatistics(workflowId?: string): Promise<any> {
        const { data } = await supabase.rpc('get_workflow_stats', {
            p_workflow_id: workflowId
        });

        return data;
    }
}

// Export singleton instance
export const workflowEngine = new WorkflowEngine();
