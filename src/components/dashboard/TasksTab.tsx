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
    Search
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
        <div className="w-full space-y-6">
            {/* Table Header - Elite Protocol Styling */}
            <div className="hidden lg:grid grid-cols-12 gap-6 px-8 py-4 bg-slate-900/40 border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 font-mono backdrop-blur-md shadow-inner">
                <div className="col-span-12 lg:col-span-5 flex items-center gap-3">
                    <Target className="w-3 h-3 text-teal-400" />
                    Objective Detail
                </div>
                <div className="lg:col-span-2 text-center">Status</div>
                <div className="lg:col-span-2 text-center">Priority</div>
                <div className="lg:col-span-2 text-center">Timeline</div>
                <div className="lg:col-span-1 text-right">Ops</div>
            </div>

            {/* List Rows */}
            <div className="space-y-4">
                {filteredAndSearchedTasks.length === 0 && !loading ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="py-24 flex flex-col items-center justify-center text-slate-500 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-white/5 backdrop-blur-sm"
                    >
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mb-6 shadow-inner">
                            <Target className="w-10 h-10 opacity-20" />
                        </div>
                        <p className="font-black text-sm uppercase tracking-[0.3em] text-slate-600">No Active Directives</p>
                        <p className="text-[10px] font-mono text-slate-700 mt-2 uppercase">System Idle // Awaiting Input</p>
                    </motion.div>
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

                                {/* Objective Detail - Desktop & Mobile Header */}
                                <div className="col-span-1 lg:col-span-5 flex items-center gap-3 sm:gap-6">
                                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-500 shadow-inner group-hover:scale-110 shrink-0 ${task.status === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                                        {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" /> : <Target className="w-5 h-5 sm:w-6 sm:h-6" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm sm:text-base font-black text-slate-200 group-hover:text-white transition-colors truncate tracking-tight">
                                            {task.title}
                                        </h4>
                                        <div className="flex items-center gap-2 sm:gap-3 mt-0.5 sm:mt-1.5">
                                            {task.description && (
                                                <p className="text-[10px] sm:text-xs text-slate-500 truncate max-w-[150px] sm:max-w-[200px] font-medium italic">
                                                    {task.description}
                                                </p>
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
                                            className={`w-full text-[10px] font-black uppercase tracking-widest px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 outline-none cursor-pointer text-center appearance-none ${task.status === 'completed' ? 'text-green-400 border-green-500/30' : 'text-teal-400 border-teal-500/30'}`}
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
                                    <span className={`px-4 py-2 text-[10px] rounded-xl font-black uppercase tracking-[0.1em] border ${task.priority === 'high' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-slate-800/40 border-white/5 text-slate-500'}`}>
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
                                        <span className="text-[10px] text-slate-700 font-black uppercase tracking-widest italic opacity-40">No Deadline</span>
                                    )}
                                </div>

                                {/* Mobile Metadata Row */}
                                <div className="lg:hidden flex flex-wrap gap-3 mt-2 pt-2 border-t border-white/5 w-full">
                                    <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 uppercase">
                                        <div className={`w-1.5 h-1.5 rounded-full ${task.status === 'completed' ? 'bg-green-500' : 'bg-teal-500'}`} />
                                        {task.status}
                                    </div>
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${task.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-teal-500/10 text-teal-400 border-teal-500/20'}`}>
                                        {task.priority}
                                    </span>
                                    {task.dueDate && (
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono ml-auto">
                                            <Calendar className="w-3 h-3 text-teal-500/60" />
                                            {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                        </div>
                                    )}
                                </div>

                                {/* Tactical Operations */}
                                <div className="col-span-1 lg:col-span-1 flex justify-end gap-2 lg:opacity-0 group-hover:opacity-100 transition-all duration-500 mt-2 md:mt-0">
                                    <button onClick={() => openEditModal(task)} className="flex-1 md:flex-none p-2 sm:p-3 text-slate-500 hover:text-white rounded-xl md:rounded-2xl border border-white/5 bg-white/5 md:bg-white/2 flex justify-center items-center"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => setNotesTaskId(task.id)} className="flex-1 md:flex-none p-2 sm:p-3 text-slate-500 hover:text-white rounded-xl md:rounded-2xl border border-white/5 bg-white/5 md:bg-white/2 flex justify-center items-center"><FileText className="w-4 h-4" /></button>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col space-y-6 md:space-y-8 p-4 md:p-8 overflow-y-auto custom-scrollbar bg-[radial-gradient(circle_at_top_right,rgba(20,184,166,0.05),transparent_40%)]">
            {/* Elite Mission Header */}
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
                                <p className="text-[9px] md:text-[10px] font-mono text-teal-500/60 uppercase tracking-[0.2em] md:tracking-[0.3em] truncate">System Live // Objective Tracking</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                <div className="flex flex-wrap items-center gap-3 md:gap-4 relative z-10">
                    <div className="px-3 md:px-4 py-2 border border-white/5 bg-slate-900/50 rounded-xl md:rounded-2xl backdrop-blur-md flex items-center shrink-0">
                        <span className="text-[9px] md:text-[10px] font-mono text-slate-500 uppercase tracking-widest mr-2 md:mr-3">Status:</span>
                        <span className="text-[10px] md:text-xs font-black text-teal-400 font-mono">
                            {loading ? 'SYNCING...' : `${filteredAndSearchedTasks.length} DIRECTIVES`}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tactical Control Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6 p-2 md:p-3 bg-slate-900/40 border border-white/5 rounded-2xl md:rounded-[2.5rem] backdrop-blur-2xl shadow-2xl">
                <div className="flex overflow-x-auto custom-scrollbar p-1 md:p-1.5 bg-black/40 rounded-xl md:rounded-[1.8rem] border border-white/5">
                    {[
                        { id: 'all', label: 'All', icon: <List className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'my_tasks', label: 'My Ops', icon: <User className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'overdue', label: 'Critical', icon: <AlertCircle className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> },
                        { id: 'completed', label: 'History', icon: <History className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" /> }
                    ].map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => setFilter(btn.id as any)}
                            className={`relative whitespace-nowrap px-4 md:px-6 py-2 md:py-2.5 rounded-lg md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-[0.15em] transition-all flex items-center gap-2 md:gap-2.5 group ${filter === btn.id ? 'text-white' : 'text-slate-500 hover:text-slate-300'
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
                    <div className="relative group flex-1 md:flex-none">
                        <Search className="w-3.5 h-3.5 md:w-4 md:h-4 absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-teal-400 transition-colors" />
                        <input
                            type="text"
                            placeholder="ENCRYPTED SEARCH..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full lg:w-72 bg-black/40 border border-white/5 rounded-xl md:rounded-2xl pl-10 md:pl-12 pr-4 md:pr-6 py-2 md:py-3 text-[9px] md:text-[10px] font-mono tracking-widest text-white focus:border-teal-500/40 outline-none transition-all placeholder:text-slate-700 shadow-inner"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02, translateY: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setEditingTask(null); resetTaskForm(); setShowCreateModal(true); }}
                        className="bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl md:rounded-2xl h-10 md:h-12 px-4 md:px-8 shadow-[0_10px_30px_rgba(20,184,166,0.3)] transition-all flex items-center justify-center gap-2 md:gap-3 group shrink-0"
                    >
                        <Plus className="w-4 h-4 font-bold group-hover:rotate-90 transition-transform duration-500" />
                        <span className="hidden sm:inline font-black text-[9px] md:text-[10px] uppercase tracking-[0.2em]">Deploy Directive</span>
                    </motion.button>
                </div>
            </div>

            {/* Main Deployment Field */}
            <div className="flex-1 min-h-0 relative">
                {loading && tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 space-y-6">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-teal-500/10 border-t-teal-500 rounded-full animate-spin" />
                            <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full animate-pulse" />
                        </div>
                        <p className="font-mono text-[10px] text-slate-500 uppercase tracking-[0.4em] animate-pulse">Synchronizing Tactical Data...</p>
                    </div>
                ) : (
                    <div className="h-full overflow-y-auto pr-2 custom-scrollbar pb-12">
                        {renderDirectiveList()}
                    </div>
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
