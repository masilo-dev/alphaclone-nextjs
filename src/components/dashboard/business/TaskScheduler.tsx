import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Play, Pause, CheckCircle, X } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

interface TaskResults {
  total: number;
  successful: number;
  failed: number;
}

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'email' | 'lead_generation' | 'contract_creation' | 'invoice' | 'follow_up' | 'custom';
  schedule: {
    type: 'daily' | 'weekly' | 'monthly' | 'once';
    time: string;
    day?: number; // for weekly (0-6) or monthly (1-31)
  };
  target: {
    count?: number;
    criteria?: string;
    template?: string;
  };
  status: 'active' | 'paused' | 'completed';
  lastRun?: string;
  nextRun?: string;
  results?: TaskResults;
}

interface TaskSchedulerProps {
  onTaskComplete?: (task: Task) => void;
}

const TaskScheduler: React.FC<TaskSchedulerProps> = ({ onTaskComplete }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: '',
    description: '',
    type: 'email',
    schedule: {
      type: 'daily',
      time: '09:00'
    },
    target: {},
    status: 'active'
  });

  const taskTypes = [
    { value: 'email', label: 'Email Outreach', icon: '📧' },
    { value: 'lead_generation', label: 'Lead Generation', icon: '🎯' },
    { value: 'contract_creation', label: 'Contract Creation', icon: '📋' },
    { value: 'invoice', label: 'Invoice Generation', icon: '💰' },
    { value: 'follow_up', label: 'Follow Up', icon: '🔄' },
    { value: 'custom', label: 'Custom Task', icon: '⚙️' }
  ];

  const scheduleTypes = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'once', label: 'One Time' }
  ];

  const daysOfWeek = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];

  useEffect(() => {
    // Load tasks from localStorage or API
    const savedTasks = localStorage.getItem('scheduled-tasks');
    if (savedTasks) {
      setTasks(JSON.parse(savedTasks));
    }
  }, []);

  useEffect(() => {
    // Save tasks to localStorage
    localStorage.setItem('scheduled-tasks', JSON.stringify(tasks));
  }, [tasks]);

  const checkAndRunTasks = async () => {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

    tasks.forEach(async (task) => {
      if (task.status !== 'active') return;

      const shouldRun = checkIfShouldRun(task, now, currentTime);
      if (shouldRun) {
        await runTask(task);
      }
    });
  };

  const checkIfShouldRun = (task: Task, now: Date, currentTime: string): boolean => {
    if (task.schedule.time !== currentTime) return false;

    const lastRun = task.lastRun ? new Date(task.lastRun) : null;

    switch (task.schedule.type) {
      case 'daily':
        return !lastRun || lastRun.toDateString() !== now.toDateString();

      case 'weekly':
        const targetDay = task.schedule.day || 0;
        return now.getDay() === targetDay &&
          (!lastRun || lastRun.toDateString() !== now.toDateString());

      case 'monthly':
        const targetDate = task.schedule.day || 1;
        return now.getDate() === targetDate &&
          (!lastRun || lastRun.toDateString() !== now.toDateString());

      case 'once':
        return !task.lastRun && !!task.nextRun && new Date(task.nextRun) <= now;

      default:
        return false;
    }
  };

  const runTask = async (task: Task) => {
    try {
      // Update task status
      const updatedTask = {
        ...task,
        lastRun: new Date().toISOString(),
        nextRun: calculateNextRun(task.schedule)
      };

      // Execute task based on type
      let results: TaskResults = { total: 0, successful: 0, failed: 0 };

      switch (task.type) {
        case 'email':
          results = await runEmailTask(task);
          break;
        case 'lead_generation':
          results = await runLeadGenerationTask(task);
          break;
        case 'contract_creation':
          results = await runContractCreationTask(task);
          break;
        case 'invoice':
          results = await runInvoiceTask(task);
          break;
        case 'follow_up':
          results = await runFollowUpTask(task);
          break;
        case 'custom':
          results = await runCustomTask(task);
          break;
      }

      updatedTask.results = results;

      if (task.schedule.type === 'once') {
        updatedTask.status = 'completed';
      }

      // Update task in state
      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));

      // Notify completion
      if (onTaskComplete) {
        onTaskComplete(updatedTask);
      }

      // Show success notification
      console.log(`Task "${task.title}" completed successfully`, results);

    } catch (error) {
      console.error(`Task "${task.title}" failed:`, error);

      // Update task with failed status
      const updatedTask = {
        ...task,
        lastRun: new Date().toISOString(),
        results: { total: 0, successful: 0, failed: 1 }
      };

      setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
    }
  };

  const calculateNextRun = (schedule: Task['schedule']): string => {
    const now = new Date();
    const next = new Date();

    switch (schedule.type) {
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      case 'once':
        return '';
    }

    return next.toISOString();
  };

  // Task execution functions
  const runEmailTask = async (task: Task): Promise<TaskResults> => {
    // Implement email sending logic
    console.log('Running email task:', task);
    return { total: 50, successful: 45, failed: 5 };
  };

  const runLeadGenerationTask = async (task: Task): Promise<TaskResults> => {
    // Implement lead generation logic
    console.log('Running lead generation task:', task);
    return { total: 25, successful: 20, failed: 5 };
  };

  const runContractCreationTask = async (task: Task): Promise<TaskResults> => {
    // Implement contract creation logic
    console.log('Running contract creation task:', task);
    return { total: 5, successful: 5, failed: 0 };
  };

  const runInvoiceTask = async (task: Task): Promise<TaskResults> => {
    // Implement invoice generation logic
    console.log('Running invoice task:', task);
    return { total: 10, successful: 10, failed: 0 };
  };

  const runFollowUpTask = async (task: Task): Promise<TaskResults> => {
    // Implement follow up logic
    console.log('Running follow up task:', task);
    return { total: 15, successful: 12, failed: 3 };
  };

  const runCustomTask = async (task: Task): Promise<TaskResults> => {
    // Implement custom task logic
    console.log('Running custom task:', task);
    return { total: 1, successful: 1, failed: 0 };
  };

  useEffect(() => {
    // Check for due tasks every minute
    const interval = setInterval(() => {
      checkAndRunTasks();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [tasks]);

  const addTask = () => {
    if (!newTask.title || !newTask.description) {
      alert('Please fill in title and description');
      return;
    }

    const task: Task = {
      id: Date.now().toString(),
      title: newTask.title,
      description: newTask.description,
      type: newTask.type || 'custom',
      schedule: newTask.schedule || { type: 'daily', time: '09:00' },
      target: newTask.target || {},
      status: 'active',
      nextRun: calculateNextRun(newTask.schedule || { type: 'daily', time: '09:00' })
    };

    setTasks(prev => [...prev, task]);
    setNewTask({
      title: '',
      description: '',
      type: 'email',
      schedule: { type: 'daily', time: '09:00' },
      target: {},
      status: 'active'
    });
    setShowAddModal(false);
  };

  const toggleTaskStatus = (taskId: string) => {
    setTasks(prev => prev.map(task =>
      task.id === taskId
        ? { ...task, status: task.status === 'active' ? 'paused' : 'active' }
        : task
    ));
  };

  const deleteTask = (taskId: string) => {
    if (confirm('Are you sure you want to delete this task?')) {
      setTasks(prev => prev.filter(task => task.id !== taskId));
    }
  };

  const formatNextRun = (nextRun?: string): string => {
    if (!nextRun) return 'N/A';
    const date = new Date(nextRun);
    return date.toLocaleString();
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-160px)] min-h-[500px] border border-white/5 bg-slate-900/40 rounded-3xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      <div className="w-24 h-24 mb-6 relative z-10">
        <div className="absolute inset-0 bg-teal-500/20 blur-2xl rounded-full animate-pulse" />
        <div className="relative bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex items-center justify-center">
          <Clock className="w-12 h-12 text-teal-400" />
        </div>
      </div>
      <h3 className="text-3xl font-bold text-white mb-4 tracking-tight relative z-10">Task Scheduler</h3>
      <div className="flex items-center gap-3 mb-6 bg-teal-500/10 px-4 py-2 rounded-full border border-teal-500/20 relative z-10">
        <div className="w-2 h-2 rounded-full bg-teal-500 animate-[ping_2s_ease-in-out_infinite]" />
        <span className="text-sm font-black text-teal-400 uppercase tracking-widest">Coming Soon</span>
      </div>
      <p className="text-slate-400 max-w-lg text-lg leading-relaxed relative z-10">
        Automate your daily business tasks, follow-ups, and notifications. Build intricate multi-step workflows with AI.
      </p>
    </div>
  );
};

export default TaskScheduler;