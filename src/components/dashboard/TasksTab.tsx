'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    CheckSquare,
    Plus,
    Clock,
    AlertCircle,
    User,
    Calendar,
    LayoutGrid,
    Trello,
    BarChart,
    ChevronLeft,
    ChevronRight,
    ArrowRight,
    Check,
    FileText,
    MessageSquare,
    MoreVertical,
    CheckCircle2,
    X
} from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { Button, Modal, Input } from '../ui/UIComponents';
import CollaborativeTaskNotes from './projects/CollaborativeTaskNotes';
import { useAuth } from '@/contexts/AuthContext';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    closestCorners,
    PointerSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TasksTabProps {
    userId: string;
    userRole: string;
}

type ViewMode = 'grid' | 'kanban' | 'gantt';

const TasksTab: React.FC<TasksTabProps> = ({ userId, userRole }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'my_tasks' | 'overdue'>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
    const { user } = useAuth();

    // Create task form state
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 'medium' as Task['priority'],
        dueDate: '',
        startDate: new Date().toISOString().split('T')[0],
        estimatedHours: ''
    });

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    useEffect(() => {
        loadTasks();
    }, [filter, userId]);

    const loadTasks = async () => {
        setLoading(true);
        try {
            const filters: any = {};
            if (filter === 'my_tasks') {
                filters.assignedTo = userId;
            }

            const { tasks: loadedTasks, error } = await taskService.getTasks(filters);

            if (error) {
                toast.error(`Error loading tasks: ${error}`);
                setTasks([]);
            } else {
                let filteredTasks = loadedTasks;
                if (filter === 'overdue') {
                    const today = new Date();
                    filteredTasks = loadedTasks.filter(
                        (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== 'completed'
                    );
                }
                setTasks(filteredTasks);
            }
        } catch (err) {
            toast.error('Failed to load tasks');
            setTasks([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (taskId: string, newStatus: Task['status']) => {
        try {
            const { error } = await taskService.updateTask(taskId, { status: newStatus });
            if (error) {
                toast.error(`Error updating task: ${error}`);
            } else {
                toast.success('Task status updated');
                // Optimistic update for smoother experience
                setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
            }
        } catch (err) {
            toast.error('Failed to update task');
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const taskId = active.id as string;
        const newStatus = over.id as Task['status'];

        const activeTask = tasks.find(t => t.id === taskId);
        if (activeTask && activeTask.status !== newStatus) {
            handleStatusChange(taskId, newStatus);
        }

        setActiveId(null);
    };

    const handleCreateTask = async () => {
        if (!taskForm.title.trim()) {
            toast.error('Task title is required');
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await taskService.createTask(userId, {
                title: taskForm.title,
                description: taskForm.description || undefined,
                priority: taskForm.priority,
                dueDate: taskForm.dueDate || undefined,
                startDate: taskForm.startDate || undefined,
                estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined
            });

            if (error) {
                toast.error(`Failed to create task: ${error}`);
            } else {
                toast.success('Task created successfully!');
                setShowCreateModal(false);
                setTaskForm({
                    title: '',
                    description: '',
                    priority: 'medium',
                    dueDate: '',
                    startDate: new Date().toISOString().split('T')[0],
                    estimatedHours: ''
                });
                loadTasks();
            }
        } catch (err) {
            toast.error('Failed to create task');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Helper functions for various views
    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'bg-red-500/20 text-red-400 border border-red-500/30';
            case 'high': return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
            case 'low': return 'bg-teal-500/20 text-teal-400 border border-teal-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-500/20 text-green-400 border border-green-500/30';
            case 'in_progress': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
            case 'todo': return 'bg-slate-700/50 text-slate-300 border border-slate-600/50';
            case 'cancelled': return 'bg-red-500/20 text-red-400 border border-red-500/30';
            default: return 'bg-slate-800 text-slate-400';
        }
    };

    // --- Sub-components (could be in separate files, but kept here for Task Excellence) ---

    const TaskCard = ({ task, isDragging }: { task: Task, isDragging?: boolean }) => {
        const {
            attributes,
            listeners,
            setNodeRef,
            transform,
            transition,
        } = useSortable({ id: task.id });

        const style = {
            transform: CSS.Translate.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };

        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

        return (
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={`glass-panel p-4 rounded-xl border group hover:border-teal-500/40 transition-all cursor-grab active:cursor-grabbing ${isOverdue ? 'border-red-500/30 bg-red-500/5' : 'border-white/5 bg-slate-900/40'
                    }`}
            >
                <div className="flex items-start justify-between mb-2">
                    <h4 className="font-bold text-slate-100 text-sm group-hover:text-white transition-colors line-clamp-2">{task.title}</h4>
                    {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                </div>

                {task.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
                )}

                <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className={`px-2 py-0.5 text-[10px] rounded-md font-bold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] rounded-md font-bold uppercase tracking-wider ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                    </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-3">
                    <div className="flex items-center gap-2">
                        {task.dueDate && (
                            <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>
                        )}
                        {task.estimatedHours && (
                            <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{task.estimatedHours}h</span>
                            </div>
                        )}
                    </div>
                    {task.assignedTo && (
                        <div className="w-5 h-5 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                            <User className="w-3 h-3" />
                        </div>
                    )}
                </div>

                {/* Collaboration Button */}
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setNotesTaskId(task.id);
                        }}
                        className="flex items-center gap-1.5 px-2 py-1 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        <FileText className="w-3 h-3" />
                        Intel Notes
                    </button>
                </div>
            </div>
        );
    };

    const KanbanColumn = ({ status, title, items, color }: { status: string, title: string, items: Task[], color: string }) => {
        return (
            <div className="flex flex-col w-80 min-w-80 h-full">
                <div className={`p-3 rounded-t-xl bg-slate-900/60 border-t-2 ${color} border-x border-slate-800/50 flex items-center justify-between`}>
                    <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${color.replace('border-', 'bg-')}`}></span>
                        {title}
                    </h3>
                    <span className="text-xs text-slate-500 font-mono bg-slate-800/50 px-2 py-0.5 rounded-full">{items.length}</span>
                </div>
                <SortableContext
                    id={status}
                    items={items.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div
                        className="flex-1 p-3 bg-slate-900/20 border-x border-b border-slate-800/50 rounded-b-xl space-y-3 overflow-y-auto min-h-[400px]"
                        id={status}
                    >
                        {items.map(task => (
                            <TaskCard key={task.id} task={task} />
                        ))}
                    </div>
                </SortableContext>
            </div>
        );
    };

    const GanttView = () => {
        const sortedTasks = useMemo(() => {
            return [...tasks].sort((a, b) => {
                const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
                const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
                return dateA - dateB;
            });
        }, [tasks]);

        // Calculate timeline range (e.g., 30 days from now)
        const timelineStart = new Date();
        timelineStart.setDate(timelineStart.getDate() - 7); // Show 1 week back
        const days = Array.from({ length: 45 }).map((_, i) => {
            const date = new Date(timelineStart);
            date.setDate(date.getDate() + i);
            return date;
        });

        return (
            <div className="glass-panel overflow-hidden rounded-2xl border border-white/5 flex flex-col h-full min-h-[500px]">
                <div className="flex border-b border-white/5 divide-x divide-white/5 bg-slate-950/40">
                    <div className="w-64 min-w-64 p-4 font-bold text-slate-400 text-xs uppercase tracking-wider sticky left-0 z-10 bg-slate-900/80 backdrop-blur-md">Task Name</div>
                    <div className="flex-1 overflow-x-auto flex divide-x divide-white/5">
                        {days.map((day, i) => (
                            <div key={i} className={`min-w-10 w-10 p-2 text-center flex flex-col items-center justify-center ${day.toDateString() === new Date().toDateString() ? 'bg-teal-500/10' : ''
                                }`}>
                                <span className="text-[10px] text-slate-500 uppercase font-bold">{day.toLocaleDateString('default', { weekday: 'narrow' })}</span>
                                <span className={`text-xs ${day.toDateString() === new Date().toDateString() ? 'text-teal-400 font-bold' : 'text-slate-400'}`}>
                                    {day.getDate()}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                    {sortedTasks.map(task => {
                        const start = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
                        const end = task.dueDate ? new Date(task.dueDate) : new Date(start);
                        if (end < start) end.setTime(start.getTime() + 86400000); // Fail-safe

                        const startIndex = Math.max(0, Math.floor((start.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
                        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

                        return (
                            <div key={task.id} className="flex divide-x divide-white/5 hover:bg-white/5 group transition-colors">
                                <div className="w-64 min-w-64 p-3 flex items-center gap-2 sticky left-0 z-10 bg-slate-900/80 backdrop-blur-md">
                                    <div className={`w-1.5 h-6 rounded-full ${task.status === 'completed' ? 'bg-green-500' :
                                        task.status === 'in_progress' ? 'bg-blue-500' :
                                            'bg-slate-700'
                                        }`}></div>
                                    <span className="text-sm text-slate-200 truncate group-hover:text-white">{task.title}</span>
                                </div>
                                <div className="flex-1 flex relative h-12 items-center">
                                    <div
                                        className={`absolute h-6 rounded-lg flex items-center px-2 cursor-pointer group/bar ${getStatusColor(task.status).replace('text-', 'text-white ')}`}
                                        style={{
                                            left: `${startIndex * 40}px`,
                                            width: `${duration * 40}px`,
                                            minWidth: '12px'
                                        }}
                                        title={`${task.title} (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`}
                                    >
                                        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/bar:opacity-100 transition-opacity rounded-lg"></div>
                                        <span className="text-[10px] font-bold truncate pointer-events-none drop-shadow-md">
                                            {duration > 2 ? task.status.replace('_', ' ') : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Main render views
    const renderGridView = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pr-2 pb-6">
            {tasks.map((task) => (
                <div
                    key={task.id}
                    className={`glass-panel p-5 rounded-2xl border transition-all flex flex-col group relative overflow-hidden backdrop-blur-xl ${task.status === 'completed' ? 'border-green-500/20 bg-green-500/5' :
                        task.status === 'in_progress' ? 'border-blue-500/20 bg-blue-500/5' :
                            'border-white/5 bg-slate-900/40'
                        } hover:shadow-2xl hover:shadow-teal-500/10 hover:border-teal-500/30`}
                >
                    {/* Visual accents */}
                    <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10 ${task.status === 'completed' ? 'bg-green-500' :
                        task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-500'
                        }`}></div>

                    <div className="flex items-start justify-between mb-4">
                        <h3 className="font-bold text-white text-lg flex-1 group-hover:text-teal-400 transition-colors leading-tight">{task.title}</h3>
                        <div className="flex gap-1.5 opacity-60 group-hover:opacity-100 transition-all">
                            {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed' && (
                                <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setNotesTaskId(task.id);
                                }}
                                className="p-1 hover:bg-teal-500/10 text-slate-400 hover:text-teal-400 rounded-md transition-colors"
                                title="Task Intel & Collaboration"
                            >
                                <FileText className="w-4 h-4" />
                            </button>
                            <button className="p-1 hover:bg-white/10 rounded-md transition-colors"><MoreVertical className="w-4 h-4 text-slate-400" /></button>
                        </div>
                    </div>

                    {task.description && (
                        <p className="text-slate-400 text-sm mb-5 line-clamp-3 leading-relaxed flex-1 italic group-hover:text-slate-300 transition-colors">
                            "{task.description}"
                        </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-6">
                        <span className={`px-2.5 py-1 text-[10px] rounded-lg font-bold uppercase tracking-widest ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                        </span>
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] rounded-lg font-bold uppercase tracking-widest ${getStatusColor(task.status)}`}>
                            {task.status === 'completed' ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {task.status.replace('_', ' ')}
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-slate-500 text-xs">
                                {task.dueDate && (
                                    <div className="flex items-center gap-1.5 group/date">
                                        <Calendar className="w-4 h-4 text-slate-600 group-hover/date:text-teal-400 transition-colors" />
                                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                                    </div>
                                )}
                                {task.estimatedHours && (
                                    <div className="flex items-center gap-1.5 border-l border-white/10 pl-3">
                                        <Clock className="w-4 h-4 text-slate-600" />
                                        <span>{task.estimatedHours}h</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex -space-x-2">
                                <div className="w-7 h-7 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-slate-400 z-10 hover:z-20 hover:scale-110 transition-all cursor-pointer">
                                    <User className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>

                        {(userRole === 'admin' || userRole === 'tenant_admin') && (
                            <div className="flex gap-2">
                                <select
                                    value={task.status}
                                    onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                                    className="flex-1 px-3 py-2 bg-slate-950/60 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-teal-500 transition-all cursor-pointer font-bold uppercase tracking-wider"
                                >
                                    <option value="todo">Pending</option>
                                    <option value="in_progress">Working</option>
                                    <option value="completed">Done</option>
                                    <option value="cancelled">Dropped</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Completion bar */}
                    <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-teal-500 to-violet-500 transition-all duration-700" style={{
                        width: task.status === 'completed' ? '100%' : task.status === 'in_progress' ? '40%' : '5%',
                        opacity: task.status === 'todo' ? 0.3 : 1
                    }}></div>
                </div>
            ))}
        </div>
    );

    const renderKanbanView = () => (
        <DndContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCorners}
            sensors={sensors}
        >
            <div className="flex gap-6 h-full overflow-x-auto pb-4 pr-4">
                <KanbanColumn
                    status="todo"
                    title="Planning"
                    items={tasks.filter(t => t.status === 'todo')}
                    color="border-slate-600"
                />
                <KanbanColumn
                    status="in_progress"
                    title="Active Construction"
                    items={tasks.filter(t => t.status === 'in_progress')}
                    color="border-blue-500"
                />
                <KanbanColumn
                    status="completed"
                    title="Deployed & Finalized"
                    items={tasks.filter(t => t.status === 'completed')}
                    color="border-teal-400"
                />
                <KanbanColumn
                    status="cancelled"
                    title="Archived"
                    items={tasks.filter(t => t.status === 'cancelled')}
                    color="border-red-500"
                />
            </div>

            <DragOverlay>
                {activeId ? (
                    <div className="scale-105 rotate-2 shadow-2xl">
                        <TaskCard task={tasks.find(t => t.id === activeId)!} isDragging />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );

    // Mobile Status Update Sheet/Modal
    const StatusUpdateModal = ({ task, onClose, onUpdate }: { task: Task | null, onClose: () => void, onUpdate: (status: Task['status']) => void }) => {
        if (!task) return null;

        const statuses: { value: Task['status'], label: string, color: string, icon: React.ElementType }[] = [
            { value: 'todo', label: 'Planning', color: 'bg-slate-700/50 text-slate-300 border-slate-600/50', icon: CheckSquare },
            { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Clock },
            { value: 'completed', label: 'Completed', color: 'bg-teal-500/20 text-teal-400 border-teal-500/30', icon: Check },
            { value: 'cancelled', label: 'Archived', color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: AlertCircle },
        ];

        return (
            <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center pointer-events-none">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto transition-opacity" onClick={onClose}></div>
                <div className="w-full sm:max-w-sm bg-slate-900 border-t sm:border border-white/10 p-6 rounded-t-3xl sm:rounded-3xl pointer-events-auto transform transition-transform animate-in slide-in-from-bottom-10 shadow-2xl shadow-teal-500/10">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-bold text-white">Update Status</h3>
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        {statuses.map((status) => (
                            <button
                                key={status.value}
                                onClick={() => onUpdate(status.value)}
                                className={`w-full p-4 rounded-xl border flex items-center justify-between group transition-all ${task.status === status.value
                                    ? 'bg-gradient-to-r from-teal-500/10 to-teal-500/5 border-teal-500/50 shadow-lg shadow-teal-500/10'
                                    : 'bg-slate-800/50 border-white/5 hover:bg-slate-800'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${status.color.split(' ')[0]} ${status.color.split(' ')[1]}`}>
                                        <status.icon className="w-5 h-5" />
                                    </div>
                                    <span className={`font-bold uppercase tracking-wider text-sm ${task.status === status.value ? 'text-teal-400' : 'text-slate-300'}`}>
                                        {status.label}
                                    </span>
                                </div>
                                {task.status === status.value && (
                                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const MobileTaskList = () => {
        const [editingStatusTask, setEditingStatusTask] = useState<Task | null>(null);

        const handleMobileStatusClick = (e: React.MouseEvent, task: Task) => {
            e.stopPropagation();
            setEditingStatusTask(task);
        };

        return (
            <>
                <div className="space-y-4 pb-20">
                    {tasks.map(task => (
                        <div key={task.id} className="bg-slate-900/60 backdrop-blur-md border border-white/5 rounded-2xl p-4 active:scale-[0.99] transition-transform duration-100">
                            <div className="flex justify-between items-start gap-4 mb-3">
                                <div className="flex-1">
                                    <h4 className="text-white font-bold text-sm leading-snug mb-1">{task.title}</h4>
                                    <p className="text-slate-500 text-xs line-clamp-1">{task.description || "No description"}</p>
                                </div>
                                <button
                                    onClick={(e) => handleMobileStatusClick(e, task)}
                                    className={`shrink-0 px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${getStatusColor(task.status)}`}
                                >
                                    {task.status === 'completed' ? <Check className="w-3 h-3" /> : task.status === 'in_progress' ? <Clock className="w-3 h-3" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                    {task.status.replace('_', ' ')}
                                </button>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                <div className="flex items-center gap-3">
                                    {task.dueDate && (
                                        <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${new Date(task.dueDate) < new Date() && task.status !== 'completed' ? 'text-red-400' : 'text-slate-500'}`}>
                                            <Calendar className="w-3 h-3" />
                                            {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </div>
                                    )}
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest ${getPriorityColor(task.priority)}`}>
                                        {task.priority}
                                    </span>
                                </div>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setNotesTaskId(task.id);
                                    }}
                                    className="p-2 -mr-2 text-slate-400 hover:text-white active:bg-white/5 rounded-full transition-colors"
                                >
                                    <FileText className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                            <CheckSquare className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm font-medium">No tasks found</p>
                        </div>
                    )}
                </div>

                <StatusUpdateModal
                    task={editingStatusTask}
                    onClose={() => setEditingStatusTask(null)}
                    onUpdate={(status) => {
                        if (editingStatusTask) {
                            handleStatusChange(editingStatusTask.id, status);
                            setEditingStatusTask(null);
                        }
                    }}
                />
            </>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col bg-slate-950/30 p-2 md:p-6 rounded-3xl backdrop-blur-sm border border-white/5">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-2">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="p-2.5 bg-gradient-to-br from-teal-500/20 to-violet-500/20 rounded-2xl border border-white/10 shadow-lg shadow-teal-500/5">
                            <CheckSquare className="w-6 h-6 text-teal-400" />
                        </div>
                        <h2 className="text-2xl lg:text-4xl font-black text-white tracking-tight">
                            Project <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-400">Intelligence</span>
                        </h2>
                    </div>
                    <p className="text-slate-500 text-xs sm:text-sm font-medium ml-1 flex items-center gap-2 uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                        {tasks.length} Operational Units Tracked
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0 scrollbar-hide">
                    {/* View Switchers - Hidden on Mobile */}
                    <div className="hidden lg:flex p-1 bg-slate-900/60 rounded-xl border border-white/5 backdrop-blur-md">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'grid' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="text-xs font-bold hidden sm:inline">Grid</span>
                        </button>
                        <button
                            onClick={() => setViewMode('kanban')}
                            className={`p-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'kanban' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <Trello className="w-4 h-4" />
                            <span className="text-xs font-bold hidden sm:inline">Kanban</span>
                        </button>
                        <button
                            onClick={() => setViewMode('gantt')}
                            className={`p-2 rounded-lg transition-all flex items-center gap-2 ${viewMode === 'gantt' ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <BarChart className="w-4 h-4" />
                            <span className="text-xs font-bold hidden sm:inline">Timeline</span>
                        </button>
                    </div>

                    <div className="h-8 w-px bg-white/10 hidden sm:block"></div>

                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-teal-500 transition-all uppercase tracking-wider min-w-[140px]"
                    >
                        <option value="all">Global Scope</option>
                        <option value="my_tasks">Assigned To Me</option>
                        <option value="overdue">Critical Overdue</option>
                    </select>

                    {(userRole === 'admin' || userRole === 'tenant_admin') && (
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-400 hover:from-teal-500 hover:to-teal-300 text-white rounded-xl font-black text-xs uppercase tracking-tighter transition-all shadow-lg shadow-teal-600/20 hover:scale-[1.02] active:scale-95 whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            Initialize Task
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-hidden min-h-0">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <CardSkeleton key={i} />
                        ))}
                    </div>
                ) : tasks.length === 0 ? (
                    <EmptyState
                        icon={CheckSquare}
                        title="No Operational Units Initialized"
                        description="Start tracking your next initiative by creating your first global task."
                    />
                ) : (
                    <div className="h-full">
                        {/* Desktop Views */}
                        <div className="hidden lg:block h-full">
                            {viewMode === 'grid' && renderGridView()}
                            {viewMode === 'kanban' && renderKanbanView()}
                            {viewMode === 'gantt' && <GanttView />}
                        </div>
                        {/* Mobile View */}
                        <div className="lg:hidden h-full overflow-y-auto">
                            <MobileTaskList />
                        </div>
                    </div>
                )}
            </div>

            {/* Create Task Modal - Enhanced Visuals */}
            {showCreateModal && (
                <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Initialize New Operation">
                    <div className="space-y-5 p-1">
                        <Input
                            label="Operational Title *"
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            placeholder="What initiative are we starting?"
                            required
                        />

                        <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Briefing & Intel</label>
                            <textarea
                                className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50 transition-all resize-none shadow-inner"
                                rows={4}
                                value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                placeholder="Strategic details, goals, or requirements..."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Priority Tier</label>
                                <select
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                                    value={taskForm.priority}
                                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Task['priority'] })}
                                >
                                    <option value="low">Low Impact</option>
                                    <option value="medium">Standard</option>
                                    <option value="high">Mission Critical</option>
                                    <option value="urgent">Immediate Action</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Labor Estimate (Hours)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3 text-slate-200 font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500/50"
                                    value={taskForm.estimatedHours}
                                    onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                                    placeholder="0.0"
                                    step="0.5"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <Input
                                label="Execution Date"
                                type="date"
                                value={taskForm.startDate}
                                onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                            />
                            <Input
                                label="Target Deadline"
                                type="date"
                                value={taskForm.dueDate}
                                onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                            />
                        </div>

                        <div className="pt-6 flex justify-end gap-3 border-t border-white/5 mt-4">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold transition-all text-xs uppercase tracking-widest"
                            >
                                Abort
                            </button>
                            <button
                                onClick={handleCreateTask}
                                disabled={isSubmitting}
                                className="px-8 py-3 bg-gradient-to-r from-teal-600 to-teal-400 hover:from-teal-500 hover:to-teal-300 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-teal-600/20 active:scale-95"
                            >
                                {isSubmitting ? 'Initializing...' : 'Confirm Operation'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Collaborative Notes Side Panel / Modal */}
            {notesTaskId && user && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-4xl h-[80vh] animate-in zoom-in-95 duration-300">
                        <CollaborativeTaskNotes
                            taskId={notesTaskId}
                            userId={user.id}
                            userName={user.name || 'Strategist'}
                            onClose={() => setNotesTaskId(null)}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksTab;
