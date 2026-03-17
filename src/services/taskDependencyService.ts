import { supabase } from '../lib/supabase';
import { auditLoggingService } from './auditLoggingService';

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'completed' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigned_to?: string;
    project_id?: string;
    due_date?: string;
    dependencies: string[]; // Array of task IDs
    created_at: string;
    updated_at: string;
}

export interface TaskDependency {
    task_id: string;
    depends_on_task_id: string;
    dependency_type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
}

export interface CriticalPath {
    tasks: Task[];
    totalDuration: number;
    estimatedCompletion: Date;
}

class TaskDependencyService {
    /**
     * Add dependency between tasks
     */
    async addDependency(
        taskId: string,
        dependsOnTaskId: string,
        dependencyType: 'finish_to_start' | 'start_to_start' | 'finish_to_finish' = 'finish_to_start'
    ): Promise<{ success: boolean; error?: string }> {
        try {
            // Check for circular dependencies
            const hasCircular = await this.checkCircularDependency(taskId, dependsOnTaskId);
            if (hasCircular) {
                return { success: false, error: 'Circular dependency detected' };
            }

            // Get current task
            const { data: task } = await supabase
                .from('tasks')
                .select('dependencies')
                .eq('id', taskId)
                .single();

            const currentDeps = task?.dependencies || [];

            // Add new dependency
            const { error } = await supabase
                .from('tasks')
                .update({
                    dependencies: [...currentDeps, dependsOnTaskId],
                    updated_at: new Date().toISOString(),
                })
                .eq('id', taskId);

            if (error) {
                return { success: false, error: error.message };
            }

            // Log to audit
            await auditLoggingService.logAction(
                'task_dependency_added',
                'task',
                taskId,
                { dependencies: currentDeps },
                { dependencies: [...currentDeps, dependsOnTaskId], dependency_type: dependencyType }
            );

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Remove dependency
     */
    async removeDependency(
        taskId: string,
        dependsOnTaskId: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { data: task } = await supabase
                .from('tasks')
                .select('dependencies')
                .eq('id', taskId)
                .single();

            const currentDeps = task?.dependencies || [];
            const newDeps = currentDeps.filter((id: string) => id !== dependsOnTaskId);

            const { error } = await supabase
                .from('tasks')
                .update({
                    dependencies: newDeps,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', taskId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    /**
     * Check for circular dependencies
     */
    private async checkCircularDependency(
        taskId: string,
        newDependencyId: string
    ): Promise<boolean> {
        const visited = new Set<string>();
        const stack = [newDependencyId];

        while (stack.length > 0) {
            const currentId = stack.pop()!;

            if (currentId === taskId) {
                return true; // Circular dependency found
            }

            if (visited.has(currentId)) {
                continue;
            }

            visited.add(currentId);

            // Get dependencies of current task
            const { data: task } = await supabase
                .from('tasks')
                .select('dependencies')
                .eq('id', currentId)
                .single();

            if (task?.dependencies) {
                stack.push(...task.dependencies);
            }
        }

        return false;
    }

    /**
     * Get all blocked tasks
     */
    async getBlockedTasks(projectId?: string): Promise<Task[]> {
        try {
            let query = supabase
                .from('tasks')
                .select('*')
                .eq('status', 'blocked');

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            const { data } = await query;
            return data || [];
        } catch (error) {
            console.error('Error fetching blocked tasks:', error);
            return [];
        }
    }

    /**
     * Get tasks that are blocking a specific task
     */
    async getBlockingTasks(taskId: string): Promise<Task[]> {
        try {
            const { data: task } = await supabase
                .from('tasks')
                .select('dependencies')
                .eq('id', taskId)
                .single();

            if (!task?.dependencies || task.dependencies.length === 0) {
                return [];
            }

            const { data: blockingTasks } = await supabase
                .from('tasks')
                .select('*')
                .in('id', task.dependencies)
                .neq('status', 'completed');

            return blockingTasks || [];
        } catch (error) {
            console.error('Error fetching blocking tasks:', error);
            return [];
        }
    }

    /**
     * Get tasks that depend on a specific task
     */
    async getDependentTasks(taskId: string): Promise<Task[]> {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .contains('dependencies', [taskId]);

            return tasks || [];
        } catch (error) {
            console.error('Error fetching dependent tasks:', error);
            return [];
        }
    }

    /**
     * Calculate critical path for a project
     */
    async calculateCriticalPath(projectId: string): Promise<CriticalPath | null> {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId);

            if (!tasks || tasks.length === 0) {
                return null;
            }

            // Build dependency graph
            const graph = new Map<string, Task>();
            tasks.forEach((task: any) => graph.set(task.id, task));

            // Find tasks with no dependencies (start tasks)
            const startTasks = tasks.filter((t: any) => !t.dependencies || t.dependencies.length === 0);

            // Calculate longest path (critical path)
            let longestPath: Task[] = [];
            let maxDuration = 0;

            for (const startTask of startTasks) {
                const path = this.findLongestPath(startTask, graph, []);
                const duration = this.calculatePathDuration(path);

                if (duration > maxDuration) {
                    maxDuration = duration;
                    longestPath = path;
                }
            }

            // Calculate estimated completion date
            const now = new Date();
            const estimatedCompletion = new Date(now.getTime() + maxDuration * 24 * 60 * 60 * 1000);

            return {
                tasks: longestPath,
                totalDuration: maxDuration,
                estimatedCompletion,
            };
        } catch (error) {
            console.error('Error calculating critical path:', error);
            return null;
        }
    }

    /**
     * Find longest path from a task (recursive)
     */
    private findLongestPath(
        task: Task,
        graph: Map<string, Task>,
        visited: string[]
    ): Task[] {
        if (visited.includes(task.id)) {
            return [];
        }

        const newVisited = [...visited, task.id];

        // Get dependent tasks
        const dependents = Array.from(graph.values()).filter(t =>
            t.dependencies?.includes(task.id)
        );

        if (dependents.length === 0) {
            return [task];
        }

        let longestPath: Task[] = [];
        for (const dependent of dependents) {
            const path = this.findLongestPath(dependent, graph, newVisited);
            if (path.length > longestPath.length) {
                longestPath = path;
            }
        }

        return [task, ...longestPath];
    }

    /**
     * Calculate duration of a task path (in days)
     */
    private calculatePathDuration(tasks: Task[]): number {
        return tasks.reduce((total, task) => {
            // Estimate task duration based on priority and complexity
            // In production, this would come from task.estimated_duration field
            const baseDuration = task.priority === 'urgent' ? 1 : task.priority === 'high' ? 3 : 5;
            return total + baseDuration;
        }, 0);
    }

    /**
     * Auto-update task status based on dependencies
     */
    async updateTaskStatusByDependencies(taskId: string): Promise<void> {
        try {
            const blockingTasks = await this.getBlockingTasks(taskId);

            const { data: task } = await supabase
                .from('tasks')
                .select('status')
                .eq('id', taskId)
                .single();

            if (!task) return;

            // If all blocking tasks are completed, unblock this task
            if (blockingTasks.length === 0 && task.status === 'blocked') {
                await supabase
                    .from('tasks')
                    .update({ status: 'todo' })
                    .eq('id', taskId);
            }

            // If any blocking tasks exist and task is not blocked, block it
            if (blockingTasks.length > 0 && task.status !== 'blocked' && task.status !== 'completed') {
                await supabase
                    .from('tasks')
                    .update({ status: 'blocked' })
                    .eq('id', taskId);
            }
        } catch (error) {
            console.error('Error updating task status:', error);
        }
    }

    /**
     * Get task dependency visualization data
     */
    async getDependencyGraph(projectId: string): Promise<any> {
        try {
            const { data: tasks } = await supabase
                .from('tasks')
                .select('*')
                .eq('project_id', projectId);

            if (!tasks) return { nodes: [], edges: [] };

            const nodes = tasks.map((task: any) => ({
                id: task.id,
                label: task.title,
                status: task.status,
                priority: task.priority,
            }));

            const edges: any[] = [];
            tasks.forEach((task: any) => {
                if (task.dependencies) {
                    task.dependencies.forEach((depId: string) => {
                        edges.push({
                            from: depId,
                            to: task.id,
                            type: 'finish_to_start',
                        });
                    });
                }
            });

            return { nodes, edges };
        } catch (error) {
            console.error('Error generating dependency graph:', error);
            return { nodes: [], edges: [] };
        }
    }
}

export const taskDependencyService = new TaskDependencyService();
