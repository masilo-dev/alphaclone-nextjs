import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';
import { tenantService } from './tenancy/TenantService';
import { projectService } from './projectService';

export interface StageTransition {
    from: string;
    to: string;
    allowed: boolean;
    requiresConfirmation: boolean;
    requiredChecklist?: string[];
    reason?: string;
}

export interface ProjectStage {
    name: string;
    order: number;
    requiredFields: string[];
    nextStages: string[];
    previousStages: string[];
}

const PROJECT_STAGES: Record<string, ProjectStage> = {
    'Initiation': {
        name: 'Initiation',
        order: 1,
        requiredFields: ['name', 'description'],
        nextStages: ['Planning', 'On Hold', 'Closure'],
        previousStages: [],
    },
    'Planning': {
        name: 'Planning',
        order: 2,
        requiredFields: ['name', 'description'],
        nextStages: ['Execution', 'On Hold', 'Closure'],
        previousStages: ['Initiation'],
    },
    'Execution': {
        name: 'Execution',
        order: 3,
        requiredFields: ['name', 'description'],
        nextStages: ['Review', 'Planning', 'On Hold', 'Closure'],
        previousStages: ['Planning'],
    },
    'Review': {
        name: 'Review',
        order: 4,
        requiredFields: ['name', 'description'],
        nextStages: ['Closure', 'Execution', 'On Hold'],
        previousStages: ['Execution'],
    },
    'Closure': {
        name: 'Closure',
        order: 5,
        requiredFields: ['name'],
        nextStages: [],
        previousStages: ['Review'],
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
        const current = PROJECT_STAGES[currentStage];
        const target = PROJECT_STAGES[newStage];

        if (!current || !target) {
            return {
                from: currentStage,
                to: newStage,
                allowed: false,
                requiresConfirmation: false,
                reason: 'Invalid stage name',
            };
        }

        // Same stage - no change
        if (currentStage === newStage) {
            return {
                from: currentStage,
                to: newStage,
                allowed: true,
                requiresConfirmation: false,
            };
        }

        // Check if transition is in allowed next stages
        const isForward = current.nextStages.includes(newStage);
        const isBackward = target.nextStages.includes(currentStage);

        if (!isForward && !isBackward) {
            return {
                from: currentStage,
                to: newStage,
                allowed: false,
                requiresConfirmation: false,
                reason: `Cannot move from ${currentStage} to ${newStage}. Allowed stages: ${current.nextStages.join(', ')}`,
            };
        }

        // Backward transitions require confirmation
        if (isBackward) {
            return {
                from: currentStage,
                to: newStage,
                allowed: true,
                requiresConfirmation: true,
                reason: 'Moving backwards requires confirmation',
            };
        }

        // Check required fields for forward transitions
        const missingFields = target.requiredFields.filter(
            (field) => !project[field] || project[field] === ''
        );

        if (missingFields.length > 0) {
            return {
                from: currentStage,
                to: newStage,
                allowed: false,
                requiresConfirmation: false,
                reason: `Missing required fields: ${missingFields.join(', ')}`,
                requiredChecklist: missingFields,
            };
        }

        return {
            from: currentStage,
            to: newStage,
            allowed: true,
            requiresConfirmation: false,
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
        forceUpdate: boolean = false
    ): Promise<{ success: boolean; error?: string; transition?: StageTransition }> {
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

            // Closure is "mark as finished" — persist Completed/100% so the
            // list stops saying the project is still open.
            const { error: updateError } = await projectService.updateProject(projectId, {
                currentStage: newStage as any,
                ...(newStage === 'Closure' ? { status: 'Completed' as const, progress: 100 } : {}),
            });
            if (updateError) return { success: false, error: updateError };

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

            return { success: true, transition };
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
