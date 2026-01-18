/**
 * Workflow Orchestrator - Core Types
 * Type definitions for the workflow automation system
 */

// Workflow status types
export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

// Step types
export type StepType =
    | 'email'           // Send email
    | 'action'          // Execute custom action
    | 'meeting'         // Schedule meeting
    | 'wait'            // Wait for time or event
    | 'condition'       // Conditional branching
    | 'loop'            // Iterate over data
    | 'ai_decision'     // AI-powered decision
    | 'webhook'         // Call external API
    | 'notification'    // Send notification
    | 'approval'        // Wait for approval
    | 'transform';      // Transform data

// Workflow Definition
export interface WorkflowDefinition {
    name: string;
    description?: string;
    trigger?: WorkflowTrigger;
    steps: WorkflowStep[];
    variables?: Record<string, any>;
}

// Workflow Trigger
export interface WorkflowTrigger {
    type: 'event' | 'schedule' | 'manual' | 'webhook';
    event?: string;
    schedule?: string;
    config?: Record<string, any>;
}

// Workflow Step
export interface WorkflowStep {
    id: string;
    name?: string;
    type: StepType;
    config: Record<string, any>;
    condition?: string;
    onError?: 'stop' | 'continue' | 'retry';
    retryConfig?: {
        maxRetries: number;
        delayMs: number;
    };
}

// Workflow
export interface Workflow {
    id: string;
    name: string;
    description?: string;
    definition: WorkflowDefinition;
    triggerConfig?: WorkflowTrigger;
    isActive: boolean;
    isTemplate: boolean;
    version: number;
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}

// Workflow Instance
export interface WorkflowInstance {
    id: string;
    workflowId: string;
    status: WorkflowStatus;
    currentStep?: string;
    context: Record<string, any>;
    inputData?: Record<string, any>;
    outputData?: Record<string, any>;
    startedAt: Date;
    completedAt?: Date;
    errorMessage?: string;
    retryCount: number;
}

// Workflow Step Log
export interface WorkflowStepLog {
    id: string;
    instanceId: string;
    stepId: string;
    stepName: string;
    stepType: StepType;
    inputData?: Record<string, any>;
    outputData?: Record<string, any>;
    status: StepStatus;
    startedAt?: Date;
    completedAt?: Date;
    executionTimeMs?: number;
    errorMessage?: string;
    retryCount: number;
}

// Workflow Template
export interface WorkflowTemplate {
    id: string;
    name: string;
    category: string;
    description?: string;
    icon?: string;
    definition: WorkflowDefinition;
    isOfficial: boolean;
    usageCount: number;
    createdAt: Date;
}

// Workflow Schedule
export interface WorkflowSchedule {
    id: string;
    workflowId: string;
    scheduleType: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
    scheduleConfig: Record<string, any>;
    isActive: boolean;
    lastRunAt?: Date;
    nextRunAt?: Date;
    createdAt: Date;
}

// Workflow Execution Context
export interface WorkflowContext {
    instanceId: string;
    workflowId: string;
    variables: Record<string, any>;
    stepResults: Record<string, any>;
}

// Step Executor Function
export type StepExecutor = (
    step: WorkflowStep,
    context: WorkflowContext
) => Promise<any>;

// Workflow Statistics
export interface WorkflowStats {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    avgExecutionTimeMs: number;
}
