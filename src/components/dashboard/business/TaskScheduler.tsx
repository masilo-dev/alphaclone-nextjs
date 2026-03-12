import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Trash2, Play, Pause, CheckCircle } from 'lucide-react';
import { Button } from '../../ui/UIComponents';

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
  results?: {
    total: number;
    successful: number;
    failed: number;
  };
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

  useEffect(() => {
    // Check for due tasks every minute
    const interval = setInterval(() => {
      checkAndRunTasks();
    }, 60000); // Check every minute

    return () => clearInterval(interval);
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
        return !task.lastRun && task.nextRun && new Date(task.nextRun) <= now;
      
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
      let results = { total: 0, successful: 0, failed: 0 };

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
  const runEmailTask = async (task: Task): Promise<Task['results']> => {
    // Implement email sending logic
    console.log('Running email task:', task);
    return { total: 50, successful: 45, failed: 5 };
  };

  const runLeadGenerationTask = async (task: Task): Promise<Task['results']> => {
    // Implement lead generation logic
    console.log('Running lead generation task:', task);
    return { total: 25, successful: 20, failed: 5 };
  };

  const runContractCreationTask = async (task: Task): Promise<Task['results']> => {
    // Implement contract creation logic
    console.log('Running contract creation task:', task);
    return { total: 5, successful: 5, failed: 0 };
  };

  const runInvoiceTask = async (task: Task): Promise<Task['results']> => {
    // Implement invoice generation logic
    console.log('Running invoice task:', task);
    return { total: 10, successful: 10, failed: 0 };
  };

  const runFollowUpTask = async (task: Task): Promise<Task['results']> => {
    // Implement follow up logic
    console.log('Running follow up task:', task);
    return { total: 15, successful: 12, failed: 3 };
  };

  const runCustomTask = async (task: Task): Promise<Task['results']> => {
    // Implement custom task logic
    console.log('Running custom task:', task);
    return { total: 1, successful: 1, failed: 0 };
  };

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white">Task Scheduler</h3>
          <p className="text-slate-400">Automate your daily business tasks</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-teal-600 hover:bg-teal-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Task
        </Button>
      </div>

      {/* Task Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-teal-400">{tasks.length}</div>
          <div className="text-sm text-slate-400">Total Tasks</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-400">
            {tasks.filter(t => t.status === 'active').length}
          </div>
          <div className="text-sm text-slate-400">Active</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-yellow-400">
            {tasks.filter(t => t.status === 'paused').length}
          </div>
          <div className="text-sm text-slate-400">Paused</div>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-400">
            {tasks.filter(t => t.status === 'completed').length}
          </div>
          <div className="text-sm text-slate-400">Completed</div>
        </div>
      </div>

      {/* Tasks List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No scheduled tasks yet</p>
            <p className="text-sm">Click "Add Task" to create your first automated task</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-lg">
                      {taskTypes.find(t => t.value === task.type)?.icon}
                    </span>
                    <h4 className="font-semibold text-white">{task.title}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      task.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      task.status === 'paused' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                  <p className="text-slate-400 text-sm mb-3">{task.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-400">
                        {task.schedule.type} at {task.schedule.time}
                      </span>
                    </div>
                    {task.nextRun && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-400">
                          Next: {formatNextRun(task.nextRun)}
                        </span>
                      </div>
                    )}
                    {task.results && (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-slate-400">
                          {task.results.successful}/{task.results.total} successful
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleTaskStatus(task.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      task.status === 'active' 
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                    title={task.status === 'active' ? 'Pause task' : 'Resume task'}
                  >
                    {task.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Add New Task</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Task Title</label>
                <input
                  type="text"
                  value={newTask.title || ''}
                  onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="e.g., Daily Email Outreach"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Description</label>
                <textarea
                  value={newTask.description || ''}
                  onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  rows={3}
                  placeholder="Describe what this task will do..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Task Type</label>
                <select
                  value={newTask.type || 'custom'}
                  onChange={(e) => setNewTask(prev => ({ ...prev, type: e.target.value as Task['type'] }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                >
                  {taskTypes.map(type => (
                    <option key={type.value} value={type.value}>
                      {type.icon} {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Schedule</label>
                <div className="space-y-2">
                  <select
                    value={newTask.schedule?.type || 'daily'}
                    onChange={(e) => setNewTask(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, type: e.target.value as Task['schedule']['type'] }
                    }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  >
                    {scheduleTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>

                  <input
                    type="time"
                    value={newTask.schedule?.time || '09:00'}
                    onChange={(e) => setNewTask(prev => ({
                      ...prev,
                      schedule: { ...prev.schedule, time: e.target.value }
                    }))}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  />

                  {(newTask.schedule?.type === 'weekly') && (
                    <select
                      value={newTask.schedule.day || 0}
                      onChange={(e) => setNewTask(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, day: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                    >
                      {daysOfWeek.map((day, index) => (
                        <option key={index} value={index}>
                          {day}
                        </option>
                      ))}
                    </select>
                  )}

                  {(newTask.schedule?.type === 'monthly') && (
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={newTask.schedule.day || 1}
                      onChange={(e) => setNewTask(prev => ({
                        ...prev,
                        schedule: { ...prev.schedule, day: parseInt(e.target.value) }
                      }))}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                      placeholder="Day of month (1-31)"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-slate-300">Target (Optional)</label>
                <input
                  type="number"
                  value={newTask.target?.count || ''}
                  onChange={(e) => setNewTask(prev => ({
                    ...prev,
                    target: { ...prev.target, count: e.target.value ? parseInt(e.target.value) : undefined }
                  }))}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-teal-500"
                  placeholder="Number of items to process"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={addTask}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                Add Task
              </Button>
              <Button
                onClick={() => setShowAddModal(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskScheduler;