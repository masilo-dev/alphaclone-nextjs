import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

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
    'Discovery': {
        name: 'Discovery',
        order: 1,
        requiredFields: ['name', 'description'],
        nextStages: ['Planning', 'On Hold'],
        previousStages: [],
    },
    'Planning': {
        name: 'Planning',
        order: 2,
        requiredFields: ['name', 'description', 'timeline'],
        nextStages: ['Design', 'On Hold'],
        previousStages: ['Discovery'],
    },
    'Design': {
        name: 'Design',
        order: 3,
        requiredFields: ['name', 'description', 'timeline', 'design_files'],
        nextStages: ['Development', 'Planning', 'On Hold'],
        previousStages: ['Planning'],
    },
    'Development': {
        name: 'Development',
        order: 4,
        requiredFields: ['name', 'description', 'timeline', 'design_files'],
        nextStages: ['Testing', 'Design', 'On Hold'],
        previousStages: ['Design'],
    },
    'Testing': {
        name: 'Testing',
        order: 5,
        requiredFields: ['name', 'description', 'timeline', 'test_results'],
        nextStages: ['Deployment', 'Development', 'On Hold'],
        previousStages: ['Development'],
    },
    'Deployment': {
        name: 'Deployment',
        order: 6,
        requiredFields: ['name', 'description', 'timeline', 'test_results', 'deployment_url'],
        nextStages: ['Completed', 'Testing', 'On Hold'],
        previousStages: ['Testing'],
    },
    'Completed': {
        name: 'Completed',
        order: 7,
        requiredFields: ['name', 'description', 'timeline', 'completion_date'],
        nextStages: [],
        previousStages: ['Deployment'],
    },
    'On Hold': {
        name: 'On Hold',
        order: 0,
        requiredFields: ['name', 'hold_reason'],
        nextStages: ['Discovery', 'Planning', 'Design', 'Development', 'Testing', 'Deployment'],
        previousStages: ['Discovery', 'Planning', 'Design', 'Development', 'Testing', 'Deployment'],
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
            // Get current project
            const { data: project, error: fetchError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();

            if (fetchError || !project) {
                return { success: false, error: 'Project not found' };
            }

            const currentStage = project.current_stage || 'Discovery';

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

            // Update project stage
            const { error: updateError } = await supabase
                .from('projects')
                .update({
                    current_stage: newStage,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', projectId);

            if (updateError) {
                return { success: false, error: updateError.message };
            }

            // Log to audit trail
            await auditLoggingService.logAction(
                'project_stage_updated',
                'project',
                projectId,
                { stage: currentStage },
                { stage: newStage, reason, forced: forceUpdate }
            );

            // Notify client of stage change
            await this.notifyClientOfStageChange(project, currentStage, newStage);

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
     * Notify client of stage change
     */
    private async notifyClientOfStageChange(
        project: any,
        oldStage: string,
        newStage: string
    ): Promise<void> {
        try {
            // Create notification message
            const message = {
                sender_id: 'system',
                recipient_id: project.owner_id,
                text: `Your project "${project.name}" has moved from ${oldStage} to ${newStage}.`,
                priority: 'normal',
                created_at: new Date().toISOString(),
            };

            await supabase.from('messages').insert(message);

            // In production, also send email notification
            // await emailService.sendStageChangeNotification(project, oldStage, newStage);
        } catch (error) {
            console.error('Error notifying client:', error);
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
        const completionStage = PROJECT_STAGES['Completed'];
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
