'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckSquare,
    Plus,
    User,
    Calendar,
    LayoutGrid,
    Trello,
    X,
    Loader2,
    FileText,
    List,
    AlertCircle,
    CheckCircle2,
    Clock,
    Target,
    History,
    ChevronDown,
    Edit2,
    Search,
    Link2,
    Unlink
} from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { taskRecurrenceService, RecurrenceFrequency } from '../../services/taskRecurrenceService';
import { taskDependencyService } from '../../services/taskDependencyService';
import { notificationService } from '../../services/dashboardService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { AIIntelligencePanel } from './AIIntelligencePanel';
import { TaskCountdown } from './tasks/TaskCountdown';
import { CollaborativeTaskNotes } from './projects/CollaborativeTaskNotes';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { showActionNextSteps } from '../common/showActionNextSteps';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { useTasks } from '@/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { projectService } from '../../services/projectService';
import { leadService } from '../../services/leadService';
import { KanbanView } from './tasks/KanbanView';

interface TasksTabProps {
    userId: string;
    userRole: string;
}

const TasksTab: React.FC<TasksTabProps> = ({ userId, userRole }) => {
    const router = useRouter();
    const [filter, setFilter] = useState<'all' | 'my_tasks' | 'overdue' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
    const [selectedProject] = useState<string>('all');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
    const searchParams = useSearchParams();

    // Hooks
    const { user } = useAuth();
    const {
        tasks,
        isLoading: loading,
        fetchNextPage,
        hasNextPage,
        updateTask: updateTaskMutation,
        createTask: createTaskMutation,
        deleteTask: deleteTaskMutation
    } = useTasks({
        assignedTo: filter === 'my_tasks' ? userId : undefined,
        relatedToProject: selectedProject !== 'all' ? selectedProject : undefined,
        limit: 50
    });

    // Fetch related data for relational fields
    const { data: userData } = useQuery({
        queryKey: ['users'],
        queryFn: () => userService.getUsers(),
        staleTime: 5 * 60 * 1000,
        enabled: showCreateModal || !!editingTask,
    });

    const { data: projectData } = useQuery({
        queryKey: ['projects', userId],
        queryFn: () => projectService.getProjects(userId, userRole as any),
        staleTime: 5 * 60 * 1000,
        enabled: showCreateModal || !!editingTask,
    });

    const { data: leadData } = useQuery({
        queryKey: ['leads'],
        queryFn: () => leadService.getLeads(),
        staleTime: 5 * 60 * 1000,
        enabled: showCreateModal || !!editingTask,
    });

    const users = userData?.users || [];
    const projects = projectData?.projects || [];
    const leads = leadData?.leads || [];

    // Form state
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 'medium' as Task['priority'],
        assignedTo: '',
        relatedToProject: '',
        relatedToLead: '',
        dueDate: '',
        startDate: new Date().toISOString().split('T')[0],
        estimatedHours: '',
        isRecurring: false,
        recurrenceFrequency: 'Weekly' as RecurrenceFrequency,
        recurrenceInterval: '1',
        dependencies: [] as string[]
    });

    // Computed Tasks
    const filteredAndSearchedTasks = useMemo(() => {
        let result = tasks || [];
        if (filter === 'completed') {
            result = result.filter(t => t.status === 'completed');
        } else {
            result = result.filter(t => t.status !== 'completed');
        }
        if (filter === 'overdue') {
            const today = new Date();
            result = result.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'completed');
        }
        if (!searchQuery.trim()) return result;
        const query = searchQuery.toLowerCase();
        return result.filter(t =>
            t.title.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query)
        );
    }, [tasks, searchQuery, filter]);

    const operationsSnapshot = useMemo(() => {
        const openTasks = (tasks || []).filter((task) => task.status !== 'completed' && task.status !== 'cancelled');
        const now = new Date();
        const blockedTasks = openTasks.filter((task) => {
            const deps = (task.metadata?.dependencies as string[]) || [];
            return deps.some((depId) => {
                const depTask = tasks?.find((candidate) => candidate.id === depId);
                return depTask && depTask.status !== 'completed';
            });
        });
        const overdueTasks = openTasks.filter((task) => task.dueDate && new Date(task.dueDate) < now);
        const unassignedTasks = openTasks.filter((task) => !task.assignedTo);
        const urgentTasks = openTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high');
        const dueSoonTasks = openTasks.filter((task) => {
            if (!task.dueDate) return false;
            const due = new Date(task.dueDate);
            const diff = due.getTime() - now.getTime();
            return diff >= 0 && diff <= 1000 * 60 * 60 * 24 * 7;
        });

        const actionQueue = openTasks
            .map((task) => {
                const reasons: string[] = [];
                let urgency = 0;

                if (blockedTasks.some((blocked) => blocked.id === task.id)) {
                    reasons.push('blocked by dependency');
                    urgency += 4;
                }
                if (task.dueDate && new Date(task.dueDate) < now) {
                    reasons.push('overdue');
                    urgency += 4;
                }
                if (!task.assignedTo) {
                    reasons.push('unassigned');
                    urgency += 2;
                }
                if (task.priority === 'urgent') {
                    reasons.push('urgent priority');
                    urgency += 3;
                } else if (task.priority === 'high') {
                    reasons.push('high priority');
                    urgency += 2;
                }
                if (!task.relatedToProject && !task.relatedToLead && !task.relatedToDeal) {
                    reasons.push('not linked to execution context');
                    urgency += 1;
                }

                return { task, reasons, urgency };
            })
            .filter((item) => item.urgency > 0)
            .sort((a, b) => b.urgency - a.urgency)
            .slice(0, 6);

        return {
            openTasks,
            blockedTasks,
            overdueTasks,
            unassignedTasks,
            urgentTasks,
            dueSoonTasks,
            actionQueue,
        };
    }, [tasks]);

    // Handle Command Palette deep links
    useEffect(() => {
        const statusParam = searchParams.get('setStatus');
        const priorityParam = searchParams.get('setPriority');

        if (statusParam || priorityParam) {
            // Find the most recent task to apply changes to, or notify user
            const targetTask = filteredAndSearchedTasks?.[0]; // Default to most recent for quick actions
            if (targetTask) {
                if (statusParam) handleStatusChange(targetTask.id, statusParam as any);
                if (priorityParam) {
                    updateTaskMutation.mutate({ taskId: targetTask.id, updates: { priority: priorityParam as any } });
                    toast.success(`Priority set to ${priorityParam}`);
                }
                
                // Clear params to prevent re-triggering
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.delete('setStatus');
                newParams.delete('setPriority');
                const newPath = window.location.pathname + (newParams.toString() ? `?${newParams.toString()}` : '');
                router.replace(newPath as any);
            }
        }
    }, [searchParams, tasks, filteredAndSearchedTasks, router]);

    // Check if task is blocked by incomplete dependencies
    const isTaskBlocked = (task: Task): boolean => {
        const deps = (task.metadata?.dependencies as string[]) || [];
        if (deps.length === 0) return false;
        
        const incompleteDeps = deps.filter(depId => {
            const depTask = tasks?.find(t => t.id === depId);
            return depTask && depTask.status !== 'completed';
        });
        
        return incompleteDeps.length > 0;
    };

    const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
        // Check if trying to complete a task that has incomplete dependencies
        if (newStatus === 'completed') {
            const task = tasks?.find(t => t.id === taskId);
            if (task && isTaskBlocked(task)) {
                const deps = (task.metadata?.dependencies as string[]) || [];
                const incompleteDepTitles = deps
                    .filter(depId => {
                        const depTask = tasks?.find(t => t.id === depId);
                        return depTask && depTask.status !== 'completed';
                    })
                    .map(depId => tasks?.find(t => t.id === depId)?.title);
                
                toast.error(`Cannot complete task. Dependencies not met: ${incompleteDepTitles.join(', ')}`);
                return;
            }
        }
        
        try {
            await updateTaskMutation.mutateAsync({ taskId, updates: { status: newStatus } });
            toast.success('Task status updated');
            
            // If task was just completed, check if any dependent tasks can be unblocked
            if (newStatus === 'completed') {
                const dependentTasks = await taskDependencyService.getDependentTasks(taskId);
                for (const depTask of dependentTasks) {
                    await taskDependencyService.updateTaskStatusByDependencies(depTask.id);
                }
            }
        } catch (err) {
            toast.error('Failed to update task');
        }
    };

    const handleRecurrencePersistence = async (taskId: string) => {
        if (taskForm.isRecurring) {
            await taskRecurrenceService.setRecurrence(taskId, {
                frequency: taskForm.recurrenceFrequency,
                interval: parseInt(taskForm.recurrenceInterval) || 1,
            });
        } else if (editingTask) {
            await taskRecurrenceService.removeRecurrence(taskId);
        }
    };

    const handleCreateTask = async () => {
        if (!taskForm.title.trim()) {
            toast.error('Task title is required');
            return;
        }
        setIsSubmitting(true);
        try {
            if (editingTask) {
                await updateTaskMutation.mutateAsync({
                    taskId: editingTask.id,
                    updates: {
                        title: taskForm.title,
                        description: taskForm.description || undefined,
                        priority: taskForm.priority,
                        dueDate: taskForm.dueDate || undefined,
                        startDate: taskForm.startDate || undefined,
                        assignedTo: (taskForm as any).assignedTo || undefined,
                        relatedToProject: (taskForm as any).relatedToProject || undefined,
                        relatedToLead: (taskForm as any).relatedToLead || undefined,
                        estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined,
                        metadata: { dependencies: (taskForm as any).dependencies || [] }
                    }
                });
                await handleRecurrencePersistence(editingTask.id);
                
                // Update dependencies - remove old ones, add new ones
                const oldDeps = (editingTask.metadata?.dependencies as string[]) || [];
                const newDeps = (taskForm as any).dependencies || [];
                
                // Remove dependencies that are no longer needed
                for (const oldDep of oldDeps) {
                    if (!newDeps.includes(oldDep)) {
                        await taskDependencyService.removeDependency(editingTask.id, oldDep);
                    }
                }
                
                // Add new dependencies
                for (const newDep of newDeps) {
                    if (!oldDeps.includes(newDep)) {
                        await taskDependencyService.addDependency(editingTask.id, newDep);
                    }
                }
                
                toast.success('Task updated successfully!');
            } else {
                const result = await createTaskMutation.mutateAsync({
                    userId,
                    taskData: {
                        title: taskForm.title,
                        description: taskForm.description || undefined,
                        priority: taskForm.priority,
                        dueDate: taskForm.dueDate || undefined,
                        startDate: taskForm.startDate || undefined,
                        assignedTo: (taskForm as any).assignedTo || undefined,
                        relatedToProject: (taskForm as any).relatedToProject || undefined,
                        relatedToLead: (taskForm as any).relatedToLead || undefined,
                        estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined,
                        metadata: { dependencies: (taskForm as any).dependencies || [] }
                    }
                });

                if (result?.id) {
                    await handleRecurrencePersistence(result.id);
                    
                    // Add dependencies
                    const deps = (taskForm as any).dependencies || [];
                    for (const depId of deps) {
                        await taskDependencyService.addDependency(result.id, depId);
                    }
                }
                toast.success('Task created successfully!');
                showActionNextSteps('task_created', (path) => router.push(path));
            }
            setShowCreateModal(false);
            setEditingTask(null);
            resetTaskForm();
        } catch (err) {
            toast.error(editingTask ? 'Failed to update task' : 'Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetTaskForm = () => {
        setTaskForm({
            title: '',
            description: '',
            priority: 'medium',
            assignedTo: '',
            relatedToProject: '',
            relatedToLead: '',
            dueDate: '',
            startDate: new Date().toISOString().split('T')[0],
            estimatedHours: '',
            isRecurring: false,
            recurrenceFrequency: 'Weekly',
            recurrenceInterval: '1',
            dependencies: []
        } as any);
    };

    const openEditModal = async (task: Task) => {
        setEditingTask(task);

        // Fetch recurrence info
        const { data: recurrenceData } = await taskRecurrenceService.getRecurrence(task.id);

        setTaskForm({
            title: task.title,
            description: task.description || '',
            priority: task.priority,
            assignedTo: task.assignedTo || '',
            relatedToProject: task.relatedToProject || '',
            relatedToLead: task.relatedToLead || '',
            dueDate: task.dueDate || '',
            startDate: task.startDate || '',
            estimatedHours: task.estimatedHours?.toString() || '',
            isRecurring: !!recurrenceData,
            recurrenceFrequency: recurrenceData?.frequency || 'Weekly',
            recurrenceInterval: recurrenceData?.interval?.toString() || '1',
            dependencies: (task.metadata?.dependencies as string[]) || []
        } as any);
        setShowCreateModal(true);
    };

    const renderTaskList = () => (
        <div className="w-full space-y-6">
            {/* Table header */}
            {viewMode === 'list' && (
                <div className="hidden lg:grid grid-cols-12 gap-6 px-8 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-500 font-mono backdrop-blur-md shadow-inner">
                    <div className="col-span-12 lg:col-span-5 flex items-center gap-3">
                        <Target className="w-3 h-3 text-teal-400" />
                        Task Details
                    </div>
                    <div className="lg:col-span-2 text-center">Status</div>
                    <div className="lg:col-span-2 text-center">Priority</div>
                    <div className="lg:col-span-2 text-center">Timeline</div>
                    <div className="lg:col-span-1 text-right">Actions</div>
                </div>
            )}

            {/* List Rows */}
            <AnimatePresence mode="wait">
                {viewMode === 'list' ? (
                    <motion.div 
                        key="list-view"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="space-y-4"
                    >
                        {filteredAndSearchedTasks.length === 0 && !loading ? (
                            <EmptyState
                                icon={Target}
                                title="All systems clear."
                                description="Execution is everything. What's next on your roadmap?"
                                action={
                                    <Button 
                                        onClick={() => { setEditingTask(null); resetTaskForm(); setShowCreateModal(true); }}
                                        className="bg-teal-600 hover:bg-teal-500 uppercase tracking-widest font-black"
                                    >
                                        Deploy Task
                                    </Button>
                                }
                            />
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filteredAndSearchedTasks.map((task, idx) => (
                                    <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
                                        transition={{
                                            delay: idx * 0.05,
                                            duration: 0.4,
                                            ease: [0.23, 1, 0.32, 1]
                                        }}
                                        className="group grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 items-center px-4 md:px-8 py-4 md:py-6 bg-slate-900/40 hover:bg-slate-800/60 border border-white/5 hover:border-teal-500/30 rounded-2xl md:rounded-[2rem] transition-all duration-500 relative overflow-hidden backdrop-blur-xl shadow-2xl hover:shadow-teal-500/5"
                                    >
                                        {/* Priority Glow Indicator */}
                                        <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500 group-hover:w-2 ${task.priority === 'high' ? 'bg-red-500 shadow-[2px_0_15px_rgba(239,68,68,0.5)]' :
                                            task.priority === 'medium' ? 'bg-orange-500 shadow-[2px_0_15px_rgba(249,115,22,0.5)]' :
                                                'bg-teal-500/30 group-hover:bg-teal-500 group-hover:shadow-[2px_0_15px_rgba(20,184,166,0.5)]'
                                            }`} />

                                        {/* Task details */}
                                        <div className="col-span-1 lg:col-span-5 flex items-center gap-3 sm:gap-6">
                                            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner group-hover:scale-110 shrink-0 ${task.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                                                {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Target className="w-5 h-5 sm:w-6 sm:h-6" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="text-sm sm:text-base font-black text-slate-200 group-hover:text-white transition-colors truncate tracking-tight">
                                                        {task.title}
                                                    </h4>
                                                    {isTaskBlocked(task) && (
                                                        <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider rounded-full shrink-0">
                                                            Blocked
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1.5">
                                                    {task.description && (
                                                        <p className="text-xs sm:text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px] font-medium italic">
                                                            {task.description}
                                                        </p>
                                                    )}
                                                    {(task.metadata?.dependencies as string[])?.length > 0 && (
                                                        <span className="text-xs text-slate-600 font-mono flex items-center gap-1">
                                                            <Link2 className="w-2.5 h-2.5" />
                                                            {(task.metadata?.dependencies as string[])?.length} dep{(task.metadata?.dependencies as string[])?.length === 1 ? '' : 's'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Intelligence (Hidden on extreme mobile, shown as pill in next row) */}
                                        <div className="hidden lg:block col-span-2">
                                            <div className="relative w-full group/status">
                                                <select
                                                    value={task.status}
                                                    onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                                    className={`w-full text-xs font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 outline-none cursor-pointer text-center appearance-none ${task.status === 'completed' ? 'text-green-400 border-green-500/30' : 'text-teal-400 border-teal-500/30'}`}
                                                >
                                                    <option value="ideas">Standby</option>
                                                    <option value="todo">Planning</option>
                                                    <option value="in_progress">Active</option>
                                                    <option value="review">Review</option>
                                                    <option value="completed">Success</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Priority Node */}
                                        <div className="hidden lg:flex col-span-2 justify-center">
                                            <span className={`px-4 py-2 text-xs rounded-xl font-black uppercase tracking-[0.1em] border ${task.priority === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-800/40 border-white/5 text-slate-500'}`}>
                                                {task.priority}
                                            </span>
                                        </div>

                                        {/* Timeline Control */}
                                        <div className="hidden lg:flex col-span-2 justify-center">
                                            {task.dueDate ? (
                                                <div className="bg-slate-950/40 px-4 py-2 rounded-xl border border-white/5">
                                                    <TaskCountdown dueDate={task.dueDate} onOverdue={() => handleStatusChange(task.id, 'review')} />
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-700 font-black uppercase tracking-widest italic opacity-40">No Deadline</span>
                                            )}
                                        </div>

                                        {/* Mobile Metadata Row */}
                                        <div className="lg:hidden flex flex-wrap gap-3 mt-2 pt-2 border-t border-white/5 w-full">
                                            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase">
                                                <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-teal-500'}`} />
                                                {task.status}
                                            </div>
                                            <span className={`text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-teal-500/10 text-teal-400 border-teal-500/20'}`}>
                                                {task.priority}
                                            </span>
                                            {task.dueDate && (
                                                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono ml-auto">
                                                    <Calendar className="w-3 h-3 text-teal-500/60" />
                                                    {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-1 lg:col-span-1 flex justify-end gap-2 lg:opacity-0 group-hover:opacity-100 transition-all duration-500 mt-2 md:mt-0">
                                            <button onClick={() => openEditModal(task)} className="flex-1 md:flex-none p-2 sm:p-3 text-slate-500 hover:text-white rounded-xl md:rounded-2xl border border-white/5 bg-white/5 md:bg-white/2 flex justify-center items-center"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => setNotesTaskId(task.id)} className="flex-1 md:flex-none p-2 sm:p-3 text-slate-500 hover:text-white rounded-xl md:rounded-2xl border border-white/5 bg-white/5 md:bg-white/2 flex justify-center items-center"><FileText className="w-4 h-4" /></button>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        )}
                    </motion.div>
                ) : (
                    <motion.div
                        key="kanban-view"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                    >
                        <KanbanView 
                            tasks={filteredAndSearchedTasks} 
                            onUpdateStatus={handleStatusChange}
                            onEditTask={openEditModal}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );

    return (
        <div className="h-full flex flex-col space-y-6 md:space-y-8 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_40%)]">
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 md:pb-8 border-b border-white/5 relative">
                <div className="relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 md:gap-4 mb-2 md:mb-3"
                    >
                        <div className="p-2.5 md:p-3 bg-teal-500 rounded-xl md:rounded-2xl shadow-xl md:shadow-2xl shadow-teal-500/40 rotate-3 shrink-0">
                            <CheckSquare className="w-6 h-6 md:w-8 md:h-8 text-slate-900" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase leading-none">
                                {filter === 'completed' ? 'Archive' : 'Operations'}
                            </h1>
                            <div className="flex items-center gap-2 mt-1 md:mt-1.5">
                                <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-teal-500 animate-pulse" />
                                <p className="text-xs md:text-xs font-mono text-teal-500/60 uppercase tracking-[0.2em] md:tracking-[0.3em] truncate">Live task tracking</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 relative z-10">
                </div>
            </div>

            <div className="mb-8">
                <AIIntelligencePanel moduleKey="taskManagement" title="Operations Intelligence" />
            </div>

            {/* Filter and actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 p-2 md:p-3 bg-slate-900/40 border border-white/5 rounded-2xl md:rounded-[2.5rem] backdrop-blur-2xl shadow-2xl">
                <div className="flex overflow-x-auto custom-scrollbar p-1 md:p-1.5 bg-black/40 rounded-xl md:rounded-[1.8rem] border border-white/5">
                    {[
                        { id: 'all', label: 'All', icon: <List className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'my_tasks', label: 'My Tasks', icon: <User className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'overdue', label: 'Critical', icon: <AlertCircle className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'completed', label: 'History', icon: <History className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> }
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => setFilter(btn.id as any)}
                            className={`relative whitespace-nowrap px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-2xl text-xs md:text-xs font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 md:gap-2.5 group ${filter === btn.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
                                }`}
                        >
                            {filter === btn.id && (
                                <motion.div
                                    layoutId="active-nav-bg"
                                    className="absolute inset-0 bg-teal-500/10 border border-teal-500/20 rounded-lg md:rounded-2xl shadow-[0_0_25px_rgba(20,184,166,0.15)]"
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className={`${filter === btn.id ? 'text-teal-400 scale-110' : 'text-slate-600 group-hover:text-slate-400'} transition-all duration-300`}>
                                {btn.icon}
                            </span>
                            <span className="relative z-10">{btn.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2 md:gap-4 px-1 md:px-2">
                    <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/5 mr-2">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            title="List View"
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-teal-500 text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            title="Kanban Board"
                        >
                            <Trello className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-teal-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full lg:w-72 bg-black/40 border border-white/5 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 md:pr-6 py-2 md:py-3 text-xs md:text-xs font-mono tracking-widest text-white focus:border-teal-500/40 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setEditingTask(null); resetTaskForm(); setShowCreateModal(true); }}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl md:rounded-2xl h-10 md:h-12 px-4 md:px-8 shadow-[0_10px_30px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-2 md:gap-3 group shrink-0"
                    >
                        <Plus className="w-4 h-4 font-bold group-hover:rotate-90 transition-transform duration-500" />
                        <span className="hidden sm:inline font-black text-xs md:text-xs uppercase tracking-[0.2em]">New Task</span>
                    </motion.button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
                {[
                    {
                        label: 'Blocked Tasks',
                        value: operationsSnapshot.blockedTasks.length,
                        hint: 'Execution waiting on incomplete dependencies.',
                        icon: <Link2 className="w-4 h-4 text-red-300" />,
                    },
                    {
                        label: 'Overdue Work',
                        value: operationsSnapshot.overdueTasks.length,
                        hint: 'Open tasks whose delivery dates already slipped.',
                        icon: <AlertCircle className="w-4 h-4 text-amber-300" />,
                    },
                    {
                        label: 'Unassigned',
                        value: operationsSnapshot.unassignedTasks.length,
                        hint: 'Tasks without a clear owner create execution drift.',
                        icon: <User className="w-4 h-4 text-sky-300" />,
                    },
                    {
                        label: 'Due This Week',
                        value: operationsSnapshot.dueSoonTasks.length,
                        hint: 'Work that needs proactive follow-through now.',
                        icon: <Calendar className="w-4 h-4 text-teal-300" />,
                    },
                ].map((card) => (
                    <div key={card.label} className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 backdrop-blur-xl">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs font-mono uppercase tracking-widest text-slate-500">{card.label}</p>
                                <p className="text-2xl font-black text-white mt-2">{card.value}</p>
                                <p className="text-xs text-slate-500 mt-2">{card.hint}</p>
                            </div>
                            <div className="rounded-xl border border-white/10 bg-slate-950/70 p-2">
                                {card.icon}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.18em]">Task Command Queue</h2>
                            <p className="text-xs text-slate-500 mt-1">The work most likely to stall delivery if ignored.</p>
                        </div>
                        <Target className="w-4 h-4 text-teal-400" />
                    </div>

                    <div className="space-y-3">
                        {operationsSnapshot.actionQueue.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-5 text-sm text-slate-400">
                                No urgent execution gaps in the current task set.
                            </div>
                        ) : (
                            operationsSnapshot.actionQueue.map(({ task, reasons, urgency }) => (
                                <button
                                    key={task.id}
                                    type="button"
                                    onClick={() => openEditModal(task)}
                                    className="w-full rounded-xl border border-white/10 bg-slate-950/50 p-4 text-left hover:border-teal-500/40 hover:bg-slate-900/70 transition-colors"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{task.title}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {task.status.replace('_', ' ')} • {task.priority} priority • {task.dueDate || 'No due date'}
                                            </p>
                                        </div>
                                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-200">
                                            P{urgency}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        {reasons.map((reason) => (
                                            <span key={reason} className="rounded-full border border-white/10 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-300">
                                                {reason}
                                            </span>
                                        ))}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-900/50 p-4 backdrop-blur-xl">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-sm font-black text-white uppercase tracking-[0.18em]">Execution Hygiene</h2>
                            <p className="text-xs text-slate-500 mt-1">Weaknesses that usually stay hidden inside generic task apps.</p>
                        </div>
                        <CheckCircle2 className="w-4 h-4 text-teal-400" />
                    </div>

                    <div className="space-y-3">
                        {[
                            {
                                label: 'Urgent/high priority tasks',
                                value: operationsSnapshot.urgentTasks.length,
                                detail: 'Signals where workload pressure is concentrating.',
                            },
                            {
                                label: 'Tasks with no project/lead/deal link',
                                value: operationsSnapshot.openTasks.filter((task) => !task.relatedToProject && !task.relatedToLead && !task.relatedToDeal).length,
                                detail: 'Work without context is hard to prioritize commercially.',
                            },
                            {
                                label: 'Review-stage tasks',
                                value: operationsSnapshot.openTasks.filter((task) => task.status === 'review').length,
                                detail: 'Approval bottlenecks often hide in review queues.',
                            },
                            {
                                label: 'Recurring open tasks',
                                value: operationsSnapshot.openTasks.filter((task) => Boolean(task.metadata?.recurrence_rule || task.metadata?.recurrence)).length,
                                detail: 'Recurring work needs periodic cleanup so it does not become clutter.',
                            },
                        ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm text-slate-200">{item.label}</p>
                                    <span className="text-lg font-semibold text-white">{item.value}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-2">{item.detail}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main task list */}
            <div className="flex-1 min-h-0 relative">
                {loading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full animate-pulse" />
                        </div>
                        <p className="font-mono text-xs text-slate-500 uppercase tracking-[0.4em] animate-pulse">Loading tasks...</p>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto pr-2 custom-scrollbar pb-12">
                        {renderTaskList()}
                    </div>
                )}
            </div>

            {/* Create/edit task modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={editingTask ? "Edit Task" : "Create Task"}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Task Title</label>
                        <Input
                            placeholder="Enter task title..."
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            className="bg-slate-950/50 text-xl font-black border-white/10 focus:border-teal-500 py-6 tracking-tight"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Description</label>
                            <textarea
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-slate-300 focus:border-teal-500 outline-none transition-all min-h-[160px] resize-none text-sm placeholder:text-slate-700"
                                placeholder="Add task details..."
                                value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Priority</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['low', 'medium', 'high'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setTaskForm({ ...taskForm, priority: p })}
                                            className={`py-3 rounded-xl border text-xs font-black uppercase tracking-widest transition-all ${taskForm.priority === p
                                                ? 'bg-teal-500 border-teal-400 text-slate-900 shadow-xl shadow-teal-500/20'
                                                : 'bg-slate-900 border-white/5 text-slate-600 hover:border-white/20'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Start Date</label>
                                    <Input
                                        type="date"
                                        value={taskForm.startDate}
                                        onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                                        className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Due Date</label>
                                    <Input
                                        type="date"
                                        value={taskForm.dueDate}
                                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                                        className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Estimated Hours</label>
                                <Input
                                    type="number"
                                    placeholder="0.0"
                                    value={taskForm.estimatedHours}
                                    onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                                    className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                />
                            </div>

                            {/* Recurrence Settings */}
                            <div className="md:col-span-2 pt-4 mt-2 border-t border-white/5">
                                <div className="flex items-center gap-3 mb-4">
                                    <input
                                        type="checkbox"
                                        id="isRecurring"
                                        checked={taskForm.isRecurring}
                                        onChange={(e) => setTaskForm({ ...taskForm, isRecurring: e.target.checked })}
                                        className="w-4 h-4 rounded border-white/10 bg-slate-950/50 text-teal-500 focus:ring-teal-500"
                                    />
                                    <label htmlFor="isRecurring" className="text-xs font-black text-slate-300 uppercase tracking-widest font-mono cursor-pointer">
                                        Recurring task
                                    </label>
                                </div>

                                {taskForm.isRecurring && (
                                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Frequency</label>
                                            <select
                                                value={taskForm.recurrenceFrequency}
                                                onChange={(e) => setTaskForm({ ...taskForm, recurrenceFrequency: e.target.value as any })}
                                                className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                            >
                                                <option value="Daily">Daily</option>
                                                <option value="Weekly">Weekly</option>
                                                <option value="Monthly">Monthly</option>
                                                <option value="Yearly">Yearly</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Interval (Every X {taskForm.recurrenceFrequency.slice(0, -2).toLowerCase() + 's'})</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={taskForm.recurrenceInterval}
                                                onChange={(e) => setTaskForm({ ...taskForm, recurrenceInterval: e.target.value })}
                                                className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* New Relational Fields */}
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Assigned To</label>
                                <select
                                    value={taskForm.assignedTo}
                                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                >
                                    <option value="">Unassigned</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Linked Project</label>
                                    <select
                                        value={taskForm.relatedToProject}
                                        onChange={(e) => setTaskForm({ ...taskForm, relatedToProject: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                    >
                                        <option value="">NO PROJECT LINK</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Linked Lead</label>
                                    <select
                                        value={taskForm.relatedToLead}
                                        onChange={(e) => setTaskForm({ ...taskForm, relatedToLead: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                    >
                                        <option value="">No lead link</option>
                                        {leads.map(l => (
                                            <option key={l.id} value={l.id}>{l.businessName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Task Dependencies */}
                            <div className="md:col-span-2 pt-4 mt-2 border-t border-white/5">
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 font-mono flex items-center gap-2">
                                    <Link2 className="w-3 h-3" />
                                    Dependencies (tasks that must complete first)
                                </label>
                                <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4">
                                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                                        {(tasks || []).filter(t => t.id !== editingTask?.id).map(task => (
                                            <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-900/50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    id={`dep-${task.id}`}
                                                    checked={(taskForm as any).dependencies?.includes(task.id)}
                                                    onChange={(e) => {
                                                        const deps = (taskForm as any).dependencies || [];
                                                        if (e.target.checked) {
                                                            setTaskForm({ ...taskForm, dependencies: [...deps, task.id] });
                                                        } else {
                                                            setTaskForm({ ...taskForm, dependencies: deps.filter((d: string) => d !== task.id) });
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-white/10 bg-slate-900 text-teal-500 focus:ring-teal-500"
                                                />
                                                <label htmlFor={`dep-${task.id}`} className="flex-1 text-xs text-slate-300 cursor-pointer flex items-center gap-2">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'completed' ? 'bg-green-500' : task.status === 'in_progress' ? 'bg-teal-500' : 'bg-slate-500'}`} />
                                                    {task.title}
                                                </label>
                                                <span className="text-xs text-slate-500 font-mono">{task.status}</span>
                                            </div>
                                        ))}
                                        {(tasks || []).filter(t => t.id !== editingTask?.id).length === 0 && (
                                            <p className="text-xs text-slate-500 italic">No other tasks available to depend on</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-8 border-t border-white/5">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="px-6 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <Button
                            onClick={handleCreateTask}
                            disabled={isSubmitting}
                            variant="primary"
                            className="px-8 h-12 font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-500/20"
                        >
                            {isSubmitting ? 'Saving...' : (editingTask ? 'Save Changes' : 'Create Task')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Task notes */}
            {notesTaskId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-[0_0_50px_-12px_rgba(20,184,166,0.3)] relative flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
                            <div>
                                <h3 className="font-black text-white text-lg flex items-center gap-3 tracking-tighter">
                                    <div className="p-1.5 bg-teal-500/10 rounded-lg">
                                        <FileText className="w-5 h-5 text-teal-400" />
                                    </div>
                                    Task Notes
                                </h3>
                                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest mt-1">Shared notes and updates</p>
                            </div>
                            <button onClick={() => setNotesTaskId(null)} className="p-2 hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10">
                                <X className="w-6 h-6 text-slate-500 hover:text-white" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden relative bg-slate-950/20">
                            <CollaborativeTaskNotes taskId={notesTaskId} userId={userId} userName={user?.user_metadata?.name || 'Agent'} onClose={() => setNotesTaskId(null)} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksTab;

