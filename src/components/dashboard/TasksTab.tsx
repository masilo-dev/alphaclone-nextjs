'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
    History
} from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { taskRecurrenceService, RecurrenceFrequency } from '../../services/taskRecurrenceService';
import { notificationService } from '../../services/dashboardService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { TaskCountdown } from './tasks/TaskCountdown';
import { CollaborativeTaskNotes } from './projects/CollaborativeTaskNotes';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';
import { useTasks } from '@/hooks/useTasks';
import { useQuery } from '@tanstack/react-query';
import { userService } from '../../services/userService';
import { projectService } from '../../services/projectService';
import { leadService } from '../../services/leadService';

interface TasksTabProps {
    userId: string;
    userRole: string;
}

const TasksTab: React.FC<TasksTabProps> = ({ userId, userRole }) => {
    const [filter, setFilter] = useState<'all' | 'my_tasks' | 'overdue' | 'completed'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
    const [selectedProject] = useState<string>('all');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);

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
        recurrenceInterval: '1'
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

    const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
        try {
            await updateTaskMutation.mutateAsync({ taskId, updates: { status: newStatus } });
            toast.success('Task status updated');
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
                        estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined
                    }
                });
                await handleRecurrencePersistence(editingTask.id);
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
                        estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined
                    }
                });

                if (result?.id) {
                    await handleRecurrencePersistence(result.id);
                }
                toast.success('Task created successfully!');
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
            recurrenceInterval: '1'
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
            recurrenceInterval: recurrenceData?.interval?.toString() || '1'
        } as any);
        setShowCreateModal(true);
    };

    const renderDirectiveList = () => (
        <div className="w-full space-y-4">
            {/* Table Header - Simplified for Modern Look */}
            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-slate-900/40 border border-white/5 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                <div className="col-span-12 lg:col-span-5">Objective Detail</div>
                <div className="lg:col-span-2 text-center">Status</div>
                <div className="lg:col-span-2 text-center">Priority</div>
                <div className="lg:col-span-2 text-center">Deadline</div>
                <div className="lg:col-span-1 text-right">Ops</div>
            </div>

            {/* List Rows */}
            <div className="space-y-3">
                {filteredAndSearchedTasks.length === 0 && !loading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-2xl border border-dashed border-white/5">
                        <Target className="w-12 h-12 mb-4 opacity-20" />
                        <p className="font-mono text-sm uppercase tracking-widest">No Active Directives</p>
                    </div>
                ) : (
                    filteredAndSearchedTasks.map((task) => (
                        <div
                            key={task.id}
                            className="group grid grid-cols-1 lg:grid-cols-12 gap-4 items-center px-6 py-4 bg-slate-900/40 hover:bg-slate-800/40 border border-white/5 hover:border-teal-500/30 rounded-2xl transition-all duration-300 relative overflow-hidden"
                        >
                            {/* Priority Indicator Line */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.priority === 'high' ? 'bg-red-500' :
                                task.priority === 'medium' ? 'bg-orange-500' : 'bg-teal-500/30'
                                }`} />

                            {/* Objective Detail */}
                            <div className="col-span-1 lg:col-span-5 flex items-center gap-4">
                                <div className={`p-2 rounded-lg ${task.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-teal-500/10 text-teal-400'}`}>
                                    {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors truncate">
                                        {task.title}
                                    </h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        {task.description && (
                                            <p className="text-xs text-slate-500 truncate max-w-[200px]">
                                                {task.description}
                                            </p>
                                        )}
                                        {task.estimatedHours && (
                                            <span className="flex items-center gap-1 text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">
                                                <Clock className="w-3 h-3" />
                                                {task.estimatedHours}h
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status Select */}
                            <div className="col-span-1 lg:col-span-2 flex justify-center">
                                <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value as any)}
                                    className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-slate-950/50 border border-white/5 outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer w-full lg:w-32 text-center appearance-none hover:bg-slate-900 transition-colors ${task.status === 'completed' ? 'text-green-400 border-green-500/20' :
                                        task.status === 'in_progress' ? 'text-teal-400 border-teal-500/20' : 'text-slate-400'
                                        }`}
                                >
                                    {[
                                        { value: 'ideas', label: 'Standby' },
                                        { value: 'todo', label: 'Planning' },
                                        { value: 'in_progress', label: 'Active' },
                                        { value: 'review', label: 'Review' },
                                        { value: 'completed', label: 'Success' },
                                    ].map((stage, idx, arr) => {
                                        const currentIdx = arr.findIndex(s => s.value === task.status);
                                        return (
                                            <option key={stage.value} value={stage.value} disabled={idx < currentIdx}>
                                                {stage.label}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            {/* Priority Tag */}
                            <div className="col-span-1 lg:col-span-2 flex justify-center">
                                <span className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg font-black uppercase tracking-widest border ${task.priority === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-500' :
                                    task.priority === 'medium' ? 'bg-orange-500/10 border-orange-500/20 text-orange-500' :
                                        'bg-slate-800/50 border-white/5 text-slate-500'
                                    }`}>
                                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${task.priority === 'high' ? 'bg-red-500' :
                                        task.priority === 'medium' ? 'bg-orange-500' : 'bg-slate-500'
                                        }`} />
                                    {task.priority}
                                </span>
                            </div>

                            {/* Deadline / Countdown */}
                            <div className="col-span-1 lg:col-span-2 flex justify-center">
                                {task.dueDate ? (
                                    <div className="bg-slate-950/30 px-3 py-1.5 rounded-lg border border-white/5 w-full lg:w-auto text-center">
                                        <TaskCountdown
                                            dueDate={task.dueDate}
                                            onOverdue={() => handleStatusChange(task.id, 'review')}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-slate-600 font-mono italic">No Deadline</span>
                                )}
                            </div>

                            {/* Row Actions */}
                            <div className="col-span-1 lg:col-span-1 flex justify-end gap-1">
                                <button
                                    onClick={() => openEditModal(task)}
                                    className="p-2 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 rounded-lg transition-all"
                                    title="Edit Directive"
                                >
                                    <Plus className="w-4 h-4 rotate-45" />
                                </button>
                                <button
                                    onClick={() => setNotesTaskId(task.id)}
                                    className="p-2 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 rounded-lg transition-all"
                                    title="Intelligence Notes"
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col space-y-6 p-8 overflow-y-auto custom-scrollbar">
            {/* Mission Interface Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
                        <div className="p-2 bg-teal-500 rounded-lg shadow-lg shadow-teal-500/20">
                            <CheckSquare className="w-6 h-6 text-slate-900" />
                        </div>
                        {filter === 'completed' ? 'MISSION HISTORY' : 'MISSION CONTROL'}
                        <span className="px-3 py-1 rounded-md bg-white/5 border border-white/10 text-teal-400 text-xs font-mono font-bold animate-pulse">
                            {loading ? 'SYNCING...' : `${filteredAndSearchedTasks.length} ${filter === 'completed' ? 'COMPLETED' : 'ACTIVE'} DIRECTIVES`}
                        </span>
                    </h1>
                    <p className="text-slate-400 text-xs font-mono uppercase tracking-[0.2em] mt-2 opacity-60">System Operational // Objective Tracking Interface</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Input
                            placeholder="SEARCH DIRECTIVES..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-slate-900/60 border-white/10 w-64 h-11 text-xs font-mono tracking-widest focus:border-teal-500 focus:bg-slate-900 transition-all pl-10"
                        />
                        <Target className="w-4 h-4 text-slate-600 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-teal-500 transition-colors" />
                    </div>
                    <Button
                        onClick={() => setFilter(filter === 'completed' ? 'all' : 'completed')}
                        icon={filter === 'completed' ? <Target className="w-4 h-4" /> : <History className="w-4 h-4" />}
                        variant="secondary"
                        className="h-11 px-6 font-black uppercase tracking-widest text-xs bg-slate-900 border-white/10 text-slate-300 hover:text-white"
                    >
                        {filter === 'completed' ? 'Active' : 'History'}
                    </Button>
                    <Button
                        onClick={() => { setEditingTask(null); resetTaskForm(); setShowCreateModal(true); }}
                        icon={<Plus className="w-4 h-4" />}
                        variant="primary"
                        className="h-11 px-6 font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-500/10"
                    >
                        New Directive
                    </Button>
                </div>
            </div>

            {/* Main Operational Window */}
            <div className="flex-1 min-h-0 relative">
                {loading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <div className="relative">
                            <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
                            <div className="absolute inset-0 bg-teal-500/20 blur-xl rounded-full" />
                        </div>
                        <p className="font-mono text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">Synchronizing Mission Data...</p>
                    </div>
                ) : (
                    renderDirectiveList()
                )}
            </div>

            {/* Directive Modification Unit (Create/Edit Modal) */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title={editingTask ? "MODifying DIRECTIVE" : "INITIALIZING NEW MISSION"}
                maxWidth="max-w-4xl"
            >
                <div className="space-y-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Mission Objective Title</label>
                        <Input
                            placeholder="Enter Objective..."
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            className="bg-slate-950/50 text-xl font-black border-white/10 focus:border-teal-500 py-6 tracking-tight"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Intelligence Briefing</label>
                            <textarea
                                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl p-4 text-slate-300 focus:border-teal-500 outline-none transition-all min-h-[160px] resize-none text-sm placeholder:text-slate-700"
                                placeholder="Describe the mission details and required parameters..."
                                value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                            />
                        </div>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Threat Level (Priority)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['low', 'medium', 'high'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setTaskForm({ ...taskForm, priority: p })}
                                            className={`py-3 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all ${taskForm.priority === p
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Launch Date</label>
                                    <Input
                                        type="date"
                                        value={taskForm.startDate}
                                        onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                                        className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Exfil Date (Due)</label>
                                    <Input
                                        type="date"
                                        value={taskForm.dueDate}
                                        onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                                        className="bg-slate-950/50 border-white/10 h-12 text-slate-300 font-mono text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Resource Allocation (Hrs)</label>
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
                                    <label htmlFor="isRecurring" className="text-[10px] font-black text-slate-300 uppercase tracking-widest font-mono cursor-pointer">
                                        Recurring Directive (Auto-generate next mission)
                                    </label>
                                </div>

                                {taskForm.isRecurring && (
                                    <div className="grid grid-cols-2 gap-4 animate-fade-in">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Frequency</label>
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
                                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Interval (Every X {taskForm.recurrenceFrequency.slice(0, -2).toLowerCase() + 's'})</label>
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
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Assigned Operative</label>
                                <select
                                    value={taskForm.assignedTo}
                                    onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })}
                                    className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                >
                                    <option value="">UNCALLIBRATED (Unassigned)</option>
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Linked Project</label>
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
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 font-mono">Linked Target (Lead)</label>
                                    <select
                                        value={taskForm.relatedToLead}
                                        onChange={(e) => setTaskForm({ ...taskForm, relatedToLead: e.target.value })}
                                        className="w-full bg-slate-950/50 border border-white/10 rounded-xl h-12 px-4 text-slate-300 focus:border-teal-500 outline-none transition-all text-xs font-mono"
                                    >
                                        <option value="">NO LEAD LINK</option>
                                        {leads.map(l => (
                                            <option key={l.id} value={l.id}>{l.businessName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-4 pt-8 border-t border-white/5">
                        <button
                            onClick={() => setShowCreateModal(false)}
                            className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 hover:text-white transition-colors"
                        >
                            Abort
                        </button>
                        <Button
                            onClick={handleCreateTask}
                            disabled={isSubmitting}
                            variant="primary"
                            className="px-8 h-12 font-black uppercase tracking-widest text-xs shadow-xl shadow-teal-500/20"
                        >
                            {isSubmitting ? 'SYNCING...' : (editingTask ? 'Commit Changes' : 'Initialize Mission')}
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Intelligence Notes Interface */}
            {notesTaskId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                    <div className="w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-3xl border border-white/10 bg-slate-900 shadow-[0_0_50px_-12px_rgba(20,184,166,0.3)] relative flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
                            <div>
                                <h3 className="font-black text-white text-lg flex items-center gap-3 tracking-tighter">
                                    <div className="p-1.5 bg-teal-500/10 rounded-lg">
                                        <FileText className="w-5 h-5 text-teal-400" />
                                    </div>
                                    INTELLIGENCE BRIEFING
                                </h3>
                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">Classification: Level 5 // Active Operational Logs</p>
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
