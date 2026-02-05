import { supabase } from '../lib/supabase';
import { activityService } from './activityService';
import { tenantService } from './tenancy/TenantService';
import { projectService } from './projectService';
import { taskDependencyService } from './taskDependencyService';

export interface Task {
    id: string;
    title: string;
    description?: string;
    assignedTo?: string;
    createdBy?: string;
    relatedToContact?: string;
    relatedToProject?: string;
    relatedToDeal?: string;
    relatedToLead?: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'todo' | 'in_progress' | 'completed' | 'cancelled';
    dueDate?: string;
    startDate?: string;
    completedAt?: string;
    estimatedHours?: number;
    actualHours?: number;
    tags?: string[];
    reminderAt?: string;
    reminderSent?: boolean;
    subtasks?: Array<{ title: string; completed: boolean }>;
    attachments?: any[];
    metadata?: any;
    createdAt: string;
    updatedAt: string;
}

export interface TaskComment {
    id: string;
    taskId: string;
    userId: string;
    comment: string;
    attachments?: any[];
    createdAt: string;
    userName?: string;
    userAvatar?: string;
}

export interface CreateTaskInput {
    title: string;
    description?: string;
    assignedTo?: string;
    relatedToContact?: string;
    relatedToProject?: string;
    relatedToDeal?: string;
    relatedToLead?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    dueDate?: string;
    startDate?: string;
    estimatedHours?: number;
    tags?: string[];
    reminderAt?: string;
    subtasks?: Array<{ title: string; completed: boolean }>;
    metadata?: any;
}

export const taskService = {
    /**
     * Get tenant ID (required for all operations)
     */
    getTenantId(): string {
        const tenantId = tenantService.getCurrentTenantId();
        if (!tenantId) throw new Error('No active tenant. Please select an organization.');
        return tenantId;
    },

    /**
     * Get tasks with optional filters
     */
    async getTasks(filters?: {
        assignedTo?: string;
        status?: string;
        relatedToContact?: string;
        relatedToProject?: string;
        relatedToDeal?: string;
        relatedToLead?: string;
        limit?: number;
    }): Promise<{ tasks: Task[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            let query = supabase
                .from('tasks')
                .select('*')
                .eq('tenant_id', tenantId); // ← TENANT FILTER

            if (filters?.assignedTo) {
                query = query.eq('assigned_to', filters.assignedTo);
            }
            if (filters?.status) {
                query = query.eq('status', filters.status);
            }
            if (filters?.relatedToContact) {
                query = query.eq('related_to_contact', filters.relatedToContact);
            }
            if (filters?.relatedToProject) {
                query = query.eq('related_to_project', filters.relatedToProject);
            }
            if (filters?.relatedToDeal) {
                query = query.eq('related_to_deal', filters.relatedToDeal);
            }
            if (filters?.relatedToLead) {
                query = query.eq('related_to_lead', filters.relatedToLead);
            }

            const { data, error } = await query
                .order('due_date', { ascending: true, nullsFirst: false })
                .order('created_at', { ascending: false })
                .limit(filters?.limit || 100);

            if (error) throw error;

            const tasks: Task[] = (data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                assignedTo: t.assigned_to,
                createdBy: t.created_by,
                relatedToContact: t.related_to_contact,
                relatedToProject: t.related_to_project,
                relatedToDeal: t.related_to_deal,
                relatedToLead: t.related_to_lead,
                priority: t.priority,
                status: t.status,
                dueDate: t.due_date,
                startDate: t.start_date,
                completedAt: t.completed_at,
                estimatedHours: t.estimated_hours,
                actualHours: t.actual_hours,
                tags: t.tags || [],
                reminderAt: t.reminder_at,
                reminderSent: t.reminder_sent,
                subtasks: t.subtasks || [],
                attachments: t.attachments || [],
                metadata: t.metadata || {},
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            return { tasks, error: null };
        } catch (err) {
            return { tasks: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get a single task by ID
     */
    async getTaskById(taskId: string): Promise<{ task: Task | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .eq('tenant_id', tenantId) // ← VERIFY TENANT OWNERSHIP
                .single();

            if (error) throw error;

            const task: Task = {
                id: data.id,
                title: data.title,
                description: data.description,
                assignedTo: data.assigned_to,
                createdBy: data.created_by,
                relatedToContact: data.related_to_contact,
                relatedToProject: data.related_to_project,
                relatedToDeal: data.related_to_deal,
                relatedToLead: data.related_to_lead,
                priority: data.priority,
                status: data.status,
                dueDate: data.due_date,
                startDate: data.start_date,
                completedAt: data.completed_at,
                estimatedHours: data.estimated_hours,
                actualHours: data.actual_hours,
                tags: data.tags || [],
                reminderAt: data.reminder_at,
                reminderSent: data.reminder_sent,
                subtasks: data.subtasks || [],
                attachments: data.attachments || [],
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { task, error: null };
        } catch (err) {
            return { task: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Create a new task
     */
    async createTask(userId: string, taskData: CreateTaskInput): Promise<{ task: Task | null; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('tasks')
                .insert({
                    tenant_id: tenantId, // ← ASSIGN TO TENANT
                    title: taskData.title,
                    description: taskData.description,
                    assigned_to: taskData.assignedTo,
                    created_by: userId,
                    related_to_contact: taskData.relatedToContact,
                    related_to_project: taskData.relatedToProject,
                    related_to_deal: taskData.relatedToDeal,
                    related_to_lead: taskData.relatedToLead,
                    priority: taskData.priority || 'medium',
                    due_date: taskData.dueDate,
                    start_date: taskData.startDate,
                    estimated_hours: taskData.estimatedHours,
                    tags: taskData.tags || [],
                    reminder_at: taskData.reminderAt,
                    subtasks: taskData.subtasks || [],
                    metadata: taskData.metadata || {},
                })
                .select()
                .single();

            if (error) throw error;

            // Log activity
            await activityService.logActivity(userId, 'Task Created', {
                taskId: data.id,
                taskTitle: taskData.title,
            });

            // Trigger project progress recalculation if linked to a project
            if (data.related_to_project) {
                projectService.recalculateProjectProgress(data.related_to_project).catch(err => console.error('Failed to update project progress:', err));
            }

            const task: Task = {
                id: data.id,
                title: data.title,
                description: data.description,
                assignedTo: data.assigned_to,
                createdBy: data.created_by,
                relatedToContact: data.related_to_contact,
                relatedToProject: data.related_to_project,
                relatedToDeal: data.related_to_deal,
                relatedToLead: data.related_to_lead,
                priority: data.priority,
                status: data.status,
                dueDate: data.due_date,
                startDate: data.start_date,
                completedAt: data.completed_at,
                estimatedHours: data.estimated_hours,
                actualHours: data.actual_hours,
                tags: data.tags || [],
                reminderAt: data.reminder_at,
                reminderSent: data.reminder_sent,
                subtasks: data.subtasks || [],
                attachments: data.attachments || [],
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { task, error: null };
        } catch (err) {
            return { task: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Update a task
     */
    async updateTask(taskId: string, updates: Partial<Task>): Promise<{ task: Task | null; error: string | null }> {
        try {
            const updateData: any = {};

            if (updates.title !== undefined) updateData.title = updates.title;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.assignedTo !== undefined) updateData.assigned_to = updates.assignedTo;
            if (updates.relatedToDeal !== undefined) updateData.related_to_deal = updates.relatedToDeal;
            if (updates.relatedToLead !== undefined) updateData.related_to_lead = updates.relatedToLead;
            if (updates.priority !== undefined) updateData.priority = updates.priority;
            if (updates.status !== undefined) updateData.status = updates.status;
            if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
            if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
            if (updates.estimatedHours !== undefined) updateData.estimated_hours = updates.estimatedHours;
            if (updates.actualHours !== undefined) updateData.actual_hours = updates.actualHours;
            if (updates.tags !== undefined) updateData.tags = updates.tags;
            if (updates.subtasks !== undefined) updateData.subtasks = updates.subtasks;
            if (updates.reminderAt !== undefined) updateData.reminder_at = updates.reminderAt;

            // Auto-set completed_at when status changes to completed
            if (updates.status === 'completed' && !updates.completedAt) {
                updateData.completed_at = new Date().toISOString();
            }

            const tenantId = this.getTenantId();

            const { data, error } = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)
                .eq('tenant_id', tenantId) // ← VERIFY OWNERSHIP
                .select()
                .single();

            if (error) throw error;

            // Trigger project progress recalculation if linked to a project
            if (data.related_to_project) {
                projectService.recalculateProjectProgress(data.related_to_project).catch(err => console.error('Failed to update project progress:', err));
            }

            // --- AUTO-DEPENDENCY DATE SHIFTING ---
            // If the due date changed, shift all dependent tasks
            if (updates.dueDate && data.due_date) {
                const oldDate = new Date(data.due_date);
                const newDate = new Date(updates.dueDate);
                const diffTime = newDate.getTime() - oldDate.getTime();

                if (diffTime !== 0) {
                    const dependentTasks = await taskDependencyService.getDependentTasks(taskId);
                    for (const depTask of dependentTasks) {
                        if (depTask.due_date) {
                            const currentDepDueDate = new Date(depTask.due_date);
                            const newDepDueDate = new Date(currentDepDueDate.getTime() + diffTime);

                            // Recursively update dependent tasks
                            await this.updateTask(depTask.id, {
                                dueDate: newDepDueDate.toISOString().split('T')[0]
                            });
                        }
                    }
                }
            }
            // -------------------------------------

            const task: Task = {
                id: data.id,
                title: data.title,
                description: data.description,
                assignedTo: data.assigned_to,
                createdBy: data.created_by,
                relatedToContact: data.related_to_contact,
                relatedToProject: data.related_to_project,
                relatedToDeal: data.related_to_deal,
                relatedToLead: data.related_to_lead,
                priority: data.priority,
                status: data.status,
                dueDate: data.due_date,
                startDate: data.start_date,
                completedAt: data.completed_at,
                estimatedHours: data.estimated_hours,
                actualHours: data.actual_hours,
                tags: data.tags || [],
                reminderAt: data.reminder_at,
                reminderSent: data.reminder_sent,
                subtasks: data.subtasks || [],
                attachments: data.attachments || [],
                metadata: data.metadata || {},
                createdAt: data.created_at,
                updatedAt: data.updated_at,
            };

            return { task, error: null };
        } catch (err) {
            return { task: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Delete a task
     */
    async deleteTask(taskId: string): Promise<{ success: boolean; error: string | null }> {
        try {
            const tenantId = this.getTenantId();

            // Fetch task first to check for project linkage
            const { data: taskData } = await supabase
                .from('tasks')
                .select('related_to_project')
                .eq('id', taskId)
                .eq('tenant_id', tenantId)
                .single();

            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId)
                .eq('tenant_id', tenantId); // ← VERIFY OWNERSHIP

            if (error) throw error;

            // Trigger project progress recalculation if it was linked to a project
            if (taskData?.related_to_project) {
                projectService.recalculateProjectProgress(taskData.related_to_project).catch(err => console.error('Failed to update project progress:', err));
            }

            return { success: true, error: null };
        } catch (err) {
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * AI-powered task outline generation (Placeholder for MVP)
     */
    async generateTaskOutline(title: string): Promise<{ outline: string; error: string | null }> {
        // This is a placeholder for a real AI call.
        // In the future, this would call Gemini.
        const mockOutline = `Strategy for: ${title}\n\n1. Define core objectives\n2. Identify key stakeholders\n3. Establish timeline and milestones\n4. Allocate necessary resources\n5. Execute initial phase\n6. Review and optimize progress`;

        return { outline: mockOutline, error: null };
    },

    /**
     * Get task comments
     */
    async getTaskComments(taskId: string): Promise<{ comments: TaskComment[]; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('task_comments')
                .select(`
                    *,
                    profiles:user_id (
                        name,
                        avatar_url
                    )
                `)
                .eq('task_id', taskId)
                .order('created_at', { ascending: true });

            if (error) throw error;

            const comments: TaskComment[] = (data || []).map((c: any) => ({
                id: c.id,
                taskId: c.task_id,
                userId: c.user_id,
                comment: c.comment,
                attachments: c.attachments || [],
                createdAt: c.created_at,
                userName: c.profiles?.name,
                userAvatar: c.profiles?.avatar_url,
            }));

            return { comments, error: null };
        } catch (err) {
            return { comments: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Add a comment to a task
     */
    async addTaskComment(
        taskId: string,
        userId: string,
        comment: string,
        attachments?: any[]
    ): Promise<{ comment: TaskComment | null; error: string | null }> {
        try {
            const { data, error } = await supabase
                .from('task_comments')
                .insert({
                    task_id: taskId,
                    user_id: userId,
                    comment,
                    attachments: attachments || [],
                })
                .select()
                .single();

            if (error) throw error;

            const taskComment: TaskComment = {
                id: data.id,
                taskId: data.task_id,
                userId: data.user_id,
                comment: data.comment,
                attachments: data.attachments || [],
                createdAt: data.created_at,
            };

            return { comment: taskComment, error: null };
        } catch (err) {
            return { comment: null, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get tasks due soon (next 7 days)
     */
    async getUpcomingTasks(userId?: string): Promise<{ tasks: Task[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const today = new Date();
            const nextWeek = new Date();
            nextWeek.setDate(today.getDate() + 7);

            let query = supabase
                .from('tasks')
                .select('*')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .gte('due_date', today.toISOString())
                .lte('due_date', nextWeek.toISOString())
                .neq('status', 'completed')
                .neq('status', 'cancelled');

            if (userId) {
                query = query.eq('assigned_to', userId);
            }

            const { data, error } = await query.order('due_date', { ascending: true });

            if (error) throw error;

            const tasks: Task[] = (data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                assignedTo: t.assigned_to,
                createdBy: t.created_by,
                relatedToContact: t.related_to_contact,
                relatedToProject: t.related_to_project,
                relatedToDeal: t.related_to_deal,
                relatedToLead: t.related_to_lead,
                priority: t.priority,
                status: t.status,
                dueDate: t.due_date,
                startDate: t.start_date,
                completedAt: t.completed_at,
                estimatedHours: t.estimated_hours,
                actualHours: t.actual_hours,
                tags: t.tags || [],
                reminderAt: t.reminder_at,
                reminderSent: t.reminder_sent,
                subtasks: t.subtasks || [],
                attachments: t.attachments || [],
                metadata: t.metadata || {},
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            return { tasks, error: null };
        } catch (err) {
            return { tasks: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * Get overdue tasks
     */
    async getOverdueTasks(userId?: string): Promise<{ tasks: Task[]; error: string | null }> {
        try {
            const tenantId = this.getTenantId();
            const today = new Date();

            let query = supabase
                .from('tasks')
                .select('*')
                .eq('tenant_id', tenantId) // ← TENANT FILTER
                .lt('due_date', today.toISOString())
                .neq('status', 'completed')
                .neq('status', 'cancelled');

            if (userId) {
                query = query.eq('assigned_to', userId);
            }

            const { data, error } = await query.order('due_date', { ascending: true });

            if (error) throw error;

            const tasks: Task[] = (data || []).map((t: any) => ({
                id: t.id,
                title: t.title,
                description: t.description,
                assignedTo: t.assigned_to,
                createdBy: t.created_by,
                relatedToContact: t.related_to_contact,
                relatedToProject: t.related_to_project,
                relatedToDeal: t.related_to_deal,
                relatedToLead: t.related_to_lead,
                priority: t.priority,
                status: t.status,
                dueDate: t.due_date,
                startDate: t.start_date,
                completedAt: t.completed_at,
                estimatedHours: t.estimated_hours,
                actualHours: t.actual_hours,
                tags: t.tags || [],
                reminderAt: t.reminder_at,
                reminderSent: t.reminder_sent,
                subtasks: t.subtasks || [],
                attachments: t.attachments || [],
                metadata: t.metadata || {},
                createdAt: t.created_at,
                updatedAt: t.updated_at,
            }));

            return { tasks, error: null };
        } catch (err) {
            return { tasks: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },

    /**
     * AI-Driven Project Health Assessment
     * Analyzes tasks to determine project risk and health
     */
    async generateProjectHealth(projectId: string): Promise<{
        score: number;
        status: 'healthy' | 'at_risk' | 'critical';
        risks: string[];
        recommendations: string[];
        error: string | null;
    }> {
        try {
            const { tasks, error } = await this.getTasks({ relatedToProject: projectId });
            if (error) throw new Error(error);
            if (!tasks.length) return { score: 100, status: 'healthy', risks: [], recommendations: ['No objectives initialized.'], error: null };

            const now = new Date();
            const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed');
            const highPriorityTasks = tasks.filter(t => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed');
            const completedTasks = tasks.filter(t => t.status === 'completed');

            let score = 100;
            const risks: string[] = [];
            const recommendations: string[] = [];

            // Penalty for overdue tasks
            if (overdueTasks.length > 0) {
                score -= (overdueTasks.length * 15);
                risks.push(`${overdueTasks.length} objectives are critically overdue.`);
                recommendations.push('Immediate reallocation of resources to overdue tasks is required.');
            }

            // Penalty for high backlog
            if (highPriorityTasks.length > 5) {
                score -= 10;
                risks.push('High-priority backlog is exceeding sustainable thresholds.');
                recommendations.push('Consider de-scoping lower priority items.');
            }

            // Bonus for progress
            const progressRatio = completedTasks.length / tasks.length;
            if (progressRatio > 0.5) score += 5;

            score = Math.max(0, Math.min(100, score));

            let status: 'healthy' | 'at_risk' | 'critical' = 'healthy';
            if (score < 40) status = 'critical';
            else if (score < 75) status = 'at_risk';

            return { score, status, risks, recommendations, error: null };
        } catch (err) {
            return { score: 0, status: 'critical', risks: [], recommendations: [], error: err instanceof Error ? err.message : 'Unknown error' };
        }
    },
};
