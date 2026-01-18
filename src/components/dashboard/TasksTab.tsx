import React, { useEffect, useState } from 'react';
import { CheckSquare, Plus, Clock, AlertCircle, User, Calendar } from 'lucide-react';
import { taskService, Task } from '../../services/taskService';
import { Button, Modal, Input } from '../ui/UIComponents';
import { CardSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import toast from 'react-hot-toast';

interface TasksTabProps {
    userId: string;
    userRole: string;
}

const TasksTab: React.FC<TasksTabProps> = ({ userId, userRole }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'my_tasks' | 'overdue'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Create task form state
    const [taskForm, setTaskForm] = useState({
        title: '',
        description: '',
        priority: 'medium' as Task['priority'],
        dueDate: '',
        estimatedHours: ''
    });

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
                toast.success('Task updated successfully');
                loadTasks();
            }
        } catch (err) {
            toast.error('Failed to update task');
        }
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
                estimatedHours: taskForm.estimatedHours ? parseFloat(taskForm.estimatedHours) : undefined
            });

            if (error) {
                toast.error(`Failed to create task: ${error}`);
            } else {
                toast.success('Task created successfully!');
                setShowCreateModal(false);
                // Reset form
                setTaskForm({
                    title: '',
                    description: '',
                    priority: 'medium',
                    dueDate: '',
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

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'bg-red-500/10 text-red-400';
            case 'high':
                return 'bg-orange-500/10 text-orange-400';
            case 'medium':
                return 'bg-yellow-500/10 text-yellow-400';
            case 'low':
                return 'bg-blue-500/10 text-blue-400';
            default:
                return 'bg-slate-500/10 text-slate-400';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-500/10 text-green-400';
            case 'in_progress':
                return 'bg-blue-500/10 text-blue-400';
            case 'todo':
                return 'bg-slate-500/10 text-slate-400';
            case 'cancelled':
                return 'bg-red-500/10 text-red-400';
            default:
                return 'bg-slate-500/10 text-slate-400';
        }
    };

    const isOverdue = (task: Task) => {
        if (!task.dueDate || task.status === 'completed') return false;
        return new Date(task.dueDate) < new Date();
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-violet-500 flex items-center gap-3">
                        <CheckSquare className="w-6 h-6 sm:w-8 sm:h-8 text-teal-400" /> Task Management
                    </h2>
                    <p className="text-slate-400 mt-1 text-xs sm:text-sm">{tasks.length} tasks found</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm"
                    >
                        <option value="all">All Tasks</option>
                        <option value="my_tasks">My Tasks</option>
                        <option value="overdue">Overdue</option>
                    </select>
                    {userRole === 'admin' && (
                        <Button onClick={() => setShowCreateModal(true)}>
                            <Plus className="w-5 h-5 mr-2" /> Create Task
                        </Button>
                    )}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <CardSkeleton key={i} />
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <EmptyState
                    icon={CheckSquare}
                    title="No Tasks Found"
                    description="Create tasks to track your work and stay organized."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tasks.map((task) => (
                        <div
                            key={task.id}
                            className={`glass-panel p-5 rounded-2xl border hover:border-teal-500/30 transition-all flex flex-col group ${
                                isOverdue(task) ? 'border-red-500/30' : 'border-white/5'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <h3 className="font-bold text-white text-lg flex-1">{task.title}</h3>
                                {isOverdue(task) && (
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 ml-2" />
                                )}
                            </div>

                            {task.description && (
                                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{task.description}</p>
                            )}

                            <div className="flex flex-wrap gap-2 mb-4">
                                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${getPriorityColor(task.priority)}`}>
                                    {task.priority}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${getStatusColor(task.status)}`}>
                                    {task.status.replace('_', ' ')}
                                </span>
                            </div>

                            {task.dueDate && (
                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                                    <Calendar className="w-4 h-4" />
                                    <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                </div>
                            )}

                            {task.estimatedHours && (
                                <div className="flex items-center gap-2 text-slate-400 text-xs mb-3">
                                    <Clock className="w-4 h-4" />
                                    <span>Est: {task.estimatedHours}h</span>
                                    {task.actualHours && <span>| Actual: {task.actualHours}h</span>}
                                </div>
                            )}

                            {userRole === 'admin' && (
                                <div className="mt-auto pt-4 border-t border-white/5">
                                    <select
                                        value={task.status}
                                        onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                                        className="w-full px-3 py-2 bg-slate-800/50 border border-white/10 rounded-lg text-white text-sm"
                                    >
                                        <option value="todo">To Do</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Create Task Modal */}
            {showCreateModal && (
                <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create New Task">
                    <div className="space-y-4">
                        <Input
                            label="Task Title *"
                            value={taskForm.title}
                            onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                            placeholder="Enter task title"
                            required
                        />

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                            <textarea
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all"
                                rows={3}
                                value={taskForm.description}
                                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                                placeholder="Task description (optional)"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-1.5">Priority</label>
                            <select
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
                                value={taskForm.priority}
                                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as Task['priority'] })}
                            >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        <Input
                            label="Due Date"
                            type="date"
                            value={taskForm.dueDate}
                            onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                        />

                        <Input
                            label="Estimated Hours"
                            type="number"
                            value={taskForm.estimatedHours}
                            onChange={(e) => setTaskForm({ ...taskForm, estimatedHours: e.target.value })}
                            placeholder="0"
                            step="0.5"
                            min="0"
                        />

                        <div className="pt-4 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateTask} disabled={isSubmitting}>
                                {isSubmitting ? 'Creating...' : 'Create Task'}
                            </Button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default TasksTab;
