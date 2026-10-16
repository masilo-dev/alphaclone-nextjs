import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';
import { tenantService } from './tenancy/TenantService';
import { projectService } from './projectService';

export interface StageRequirement {
    field: string;
    label: string;
    tab?: 'overview' | 'tasks' | 'milestones' | 'timeline' | 'team';
    reason?: string;
}

export interface StageTransition {
    from: string;
    to: string;
    allowed: boolean;
    requiresConfirmation: boolean;
    requiredChecklist?: string[];
    missingRequirements?: StageRequirement[];
    reason?: string;
    targetLifecycleStep?: { step: number; total: 5; label: string };
}

export interface ProjectStage {
    name: string;
    order: number;
    requiredFields: string[];
    nextStages: string[];
    previousStages: string[];
}

const FIELD_METADATA: Record<string, { label: string; tab: 'overview' | 'tasks' | 'milestones' | 'timeline' | 'team' }> = {
    name: { label: 'Project Name', tab: 'overview' },
    description: { label: 'Project Description', tab: 'overview' },
    clientId: { label: 'Client / Account', tab: 'overview' },
    client_id: { label: 'Client / Account', tab: 'overview' },
    budget: { label: 'Budget', tab: 'overview' },
    startDate: { label: 'Start Date', tab: 'overview' },
    dueDate: { label: 'Due Date', tab: 'overview' },
    hold_reason: { label: 'Hold Reason', tab: 'overview' },
};

const PROJECT_STAGES: Record<string, ProjectStage> = {
    'Initiation': {
        name: 'Initiation',
        order: 1,
        requiredFields: ['name', 'description'],
        nextStages: ['Planning', 'Execution', 'Review', 'Closure', 'On Hold'],
        previousStages: [],
    },
    'Planning': {
        name: 'Planning',
        order: 2,
        requiredFields: ['name', 'description'],
        nextStages: ['Execution', 'Review', 'Closure', 'On Hold'],
        previousStages: ['Initiation'],
    },
    'Execution': {
        name: 'Execution',
        order: 3,
        requiredFields: ['name', 'description'],
        nextStages: ['Review', 'Closure', 'On Hold'],
        previousStages: ['Planning', 'Initiation'],
    },
    'Review': {
        name: 'Review',
        order: 4,
        requiredFields: ['name', 'description'],
        nextStages: ['Closure', 'On Hold'],
        previousStages: ['Execution', 'Planning', 'Initiation'],
    },
    'Closure': {
        name: 'Closure',
        order: 5,
        requiredFields: ['name'],
        nextStages: ['Initiation', 'Planning', 'Execution', 'Review'],
        previousStages: ['Review', 'Execution', 'Planning', 'Initiation'],
    },
    'On Hold': {
        name: 'On Hold',
        order: 0,
        requiredFields: ['name', 'hold_reason'],
        nextStages: ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'],
        previousStages: ['Initiation', 'Planning', 'Execution', 'Review', 'Closure'],
    },
};

class ProjectStageService {
    /**
     * Validate if a stage transition is allowed
     */
    validateTransition(
        currentStage: string,
        newStage: string,
        project: any
    ): StageTransition {
        const current = PROJECT_STAGES[currentStage] || PROJECT_STAGES['Initiation'];
        const target = PROJECT_STAGES[newStage];

        if (!target) {
            return {
                from: currentStage,
                to: newStage,
                allowed: false,
                requiresConfirmation: false,
                reason: `Invalid stage: ${newStage}`,
            };
        }

        const targetStep = target.order > 0 ? { step: target.order, total: 5 as const, label: `Step ${target.order}/5` } : undefined;

        // Same stage - no change
        if (currentStage === newStage) {
            return {
                from: currentStage,
                to: newStage,
                allowed: true,
                requiresConfirmation: false,
                targetLifecycleStep: targetStep,
            };
        }

        // Check required fields for target transition
        const missingFields = target.requiredFields.filter(
            (field) => !project[field] || String(project[field]).trim() === ''
        );

        const missingRequirements: StageRequirement[] = missingFields.map((field) => ({
            field,
            label: FIELD_METADATA[field]?.label || field,
            tab: FIELD_METADATA[field]?.tab || 'overview',
            reason: `Required to enter ${newStage}`,
        }));

        if (missingFields.length > 0) {
            return {
                from: currentStage,
                to: newStage,
                allowed: false,
                requiresConfirmation: false,
                reason: `Missing required requirements: ${missingRequirements.map((r) => r.label).join(', ')}`,
                requiredChecklist: missingFields,
                missingRequirements,
                targetLifecycleStep: targetStep,
            };
        }

        // Closure has consequential effects (client communication, project wrap-up) -> requires confirmation
        if (newStage === 'Closure') {
            return {
                from: currentStage,
                to: newStage,
                allowed: true,
                requiresConfirmation: true,
                reason: 'Closing this project will notify stakeholders and complete the project lifecycle.',
                targetLifecycleStep: targetStep,
            };
        }

        // Backward transitions require confirmation
        const isBackward = current.order > 0 && target.order > 0 && target.order < current.order;
        if (isBackward) {
            return {
                from: currentStage,
                to: newStage,
                allowed: true,
                requiresConfirmation: true,
                reason: `Moving backwards from ${currentStage} (Step ${current.order}/5) to ${newStage} (Step ${target.order}/5) requires confirmation.`,
                targetLifecycleStep: targetStep,
            };
        }

        return {
            from: currentStage,
            to: newStage,
            allowed: true,
            requiresConfirmation: false,
            targetLifecycleStep: targetStep,
        };
    }

    /**
     * Update project stage with validation
     */
    async updateProjectStage(
        projectId: string,
        newStage: string,
        userId: string,
        reason?: string,
        forceUpdate: boolean = false,
        expectedUpdatedAt?: string
    ): Promise<{
        success: boolean;
        error?: string;
        transition?: StageTransition;
        recalculatedProgress?: number;
        persistedStage?: string;
        lifecycleStep?: { step: number; total: 5; label: string };
    }> {
        try {
            const tenantId = tenantService.getCurrentTenantId();
            if (!tenantId) return { success: false, error: 'Select a workspace first' };
            // Get current project
            const { data: project, error: fetchError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .eq('tenant_id', tenantId)
                .single();

            if (fetchError || !project) {
                return { success: false, error: 'Project not found' };
            }

            // Concurrency conflict detection: if expectedUpdatedAt was supplied, check for collision
            if (expectedUpdatedAt && project.updated_at && project.updated_at !== expectedUpdatedAt) {
                return {
                    success: false,
                    error: 'This project was updated concurrently by another session. Please reload to review the latest state.',
                    transition: this.validateTransition(project.current_stage || 'Initiation', newStage, project),
                };
            }

            const currentStage = project.current_stage || 'Initiation';

            // Validate transition
            const transition = this.validateTransition(currentStage, newStage, project);

            if (!transition.allowed && !forceUpdate) {
                return { success: false, error: transition.reason, transition };
            }

            if (transition.requiresConfirmation && !forceUpdate) {
                return {
                    success: false,
                    error: 'Confirmation required for this stage change',
                    transition,
                };
            }

            // Recalculate progress according to its actual definition (milestones & tasks)
            const { computeProjectProgressPercent, toCanonicalProjectStage } = await import('../lib/projects/projectEnums');
            const { data: dbTasks } = await supabase.from('tasks').select('status').eq('project_id', projectId);
            const { data: dbMilestones } = await supabase.from('milestones').select('status').eq('project_id', projectId);
            const effectiveStatus = newStage === 'Closure' ? 'Completed' : (project.status === 'Completed' ? 'Active' : (project.status || 'Active'));
            let finalProgress = computeProjectProgressPercent({
                currentStage: newStage,
                status: effectiveStatus,
                tasks: dbTasks || [],
                milestones: dbMilestones || [],
            });
            // If no tasks or milestones exist yet, give sensible stage baseline so step & progress agree
            if ((!dbTasks || dbTasks.length === 0) && (!dbMilestones || dbMilestones.length === 0)) {
                const stageOrder = transition.targetLifecycleStep?.step || 1;
                finalProgress = Math.round((stageOrder / 5) * 100);
            }

            const { error: updateError } = await projectService.updateProject(projectId, {
                currentStage: newStage as any,
                status: effectiveStatus as any,
                progress: finalProgress,
            });
            if (updateError) return { success: false, error: updateError, transition };

            // Log to workspace activity so client portal and dashboard stay synchronized
            try {
                const { appendWorkspaceActivity } = await import('./finance/workspaceActivityService');
                await appendWorkspaceActivity(supabase as any, {
                    tenant_id: tenantId,
                    project_id: projectId,
                    client_id: project.client_id || null,
                    invoice_id: null,
                    contract_id: null,
                    actor_type: 'team_user',
                    actor_id: userId,
                    actor_display_name: 'Workspace team',
                    event_type: 'project.stage_changed',
                    summary: `Project "${project.name}" moved from ${currentStage} to ${newStage}`,
                    metadata: { projectId, oldStage: currentStage, newStage, reason },
                });
            } catch (actErr) {
                console.warn('[projectStageService] activity log error:', actErr);
            }

            // Log to audit trail
            await auditLoggingService.logAction(
                'project_stage_updated',
                'project',
                projectId,
                { stage: currentStage },
                { stage: newStage, reason, forced: forceUpdate }
            );

            // Notify linked CRM client via no-reply email when portal is shared
            try {
                const { projectService } = await import('./projectService');
                await projectService.notifyClientStageChange(projectId, currentStage, newStage);
            } catch (notifyErr) {
                console.warn('[projectStageService] client stage notify failed:', notifyErr);
            }

            // Internal owner notification (in-app + review email)
            await this.notifyInternalOwnerOfStageChange(project, currentStage, newStage);

            return {
                success: true,
                transition,
                recalculatedProgress: finalProgress,
                persistedStage: newStage,
                lifecycleStep: transition.targetLifecycleStep,
            };
        } catch (error) {
            console.error('Error updating project stage:', error);
            return { success: false, error: String(error) };
        }
    }

    /**
     * Get available next stages for a project
     */
    getAvailableStages(currentStage: string, project: any): string[] {
        const stage = PROJECT_STAGES[currentStage];
        if (!stage) return [];

        return stage.nextStages.filter((nextStage) => {
            const transition = this.validateTransition(currentStage, nextStage, project);
            return transition.allowed || transition.requiresConfirmation;
        });
    }

    /**
     * Get stage progress percentage
     */
    getStageProgress(currentStage: string): number {
        const stage = PROJECT_STAGES[currentStage];
        if (!stage) return 0;

        const totalStages = Object.keys(PROJECT_STAGES).length - 1; // Exclude "On Hold"
        return Math.round((stage.order / totalStages) * 100);
    }

    /**
     * Notify internal project owner of stage change
     */
    private async notifyInternalOwnerOfStageChange(
        project: any,
        oldStage: string,
        newStage: string
    ): Promise<void> {
        try {
            if (!project.tenant_id || !project.owner_id) return;
            const response = await fetch('/api/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId: project.tenant_id,
                    userId: project.owner_id,
                    type: 'project',
                    title: `Project moved to ${newStage}`,
                    message: `"${project.name}" moved from ${oldStage} to ${newStage}.`,
                    link: `/dashboard?tab=projects&project=${project.id}`,
                    priority: newStage === 'Closure' ? 'high' : 'medium',
                    metadata: { projectId: project.id, oldStage, newStage },
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error || 'Project notification could not be created');
            }
        } catch (error) {
            console.error('Error notifying project owner:', error);
        }
    }

    /**
     * Get stage checklist
     */
    getStageChecklist(stage: string): string[] {
        const stageConfig = PROJECT_STAGES[stage];
        if (!stageConfig) return [];

        return stageConfig.requiredFields;
    }

    /**
     * Validate project can move to completion
     */
    canComplete(project: any): { canComplete: boolean; missingItems: string[] } {
        const completionStage = PROJECT_STAGES['Closure'];
        const missingItems = completionStage.requiredFields.filter(
            (field) => !project[field] || project[field] === ''
        );

        return {
            canComplete: missingItems.length === 0,
            missingItems,
        };
    }
}

export const projectStageService = new ProjectStageService();
