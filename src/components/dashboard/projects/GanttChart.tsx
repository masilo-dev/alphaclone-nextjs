import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
}

interface Edge {
  from: string;
  to: string;
  type: string;
}

interface GanttChartProps {
  tasks: Task[];
  edges: Edge[];
}

const COLUMN_WIDTH = 120;
const ROW_HEIGHT = 50;
const HEADER_HEIGHT = 40;

export const GanttChart: React.FC<GanttChartProps> = ({ tasks, edges }) => {
  // 1. Calculate time range
  const { minDate, maxDate, dates } = useMemo(() => {
    const allDates = tasks
      .map(t => t.due_date ? new Date(t.due_date).getTime() : null)
      .filter((d): d is number => d !== null);
    
    if (allDates.length === 0) {
      const now = new Date();
      return { 
        minDate: now.getTime(), 
        maxDate: now.getTime() + 7 * 24 * 60 * 60 * 1000,
        dates: Array.from({ length: 8 }, (_, i) => new Date(now.getTime() + i * 24 * 60 * 60 * 1000))
      };
    }

    const min = Math.min(...allDates, Date.now()) - 2 * 24 * 60 * 60 * 1000;
    const max = Math.max(...allDates, Date.now()) + 5 * 24 * 60 * 60 * 1000;
    
    const d: Date[] = [];
    let current = new Date(min);
    while (current.getTime() <= max) {
      d.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return { minDate: min, maxDate: max, dates: d };
  }, [tasks]);

  const getX = (date: string | null) => {
    if (!date) return 0;
    const d = new Date(date).getTime();
    return ((d - minDate) / (24 * 60 * 60 * 1000)) * COLUMN_WIDTH;
  };

  const sortedTasks = useMemo(() => {
    // Basic topological sort or just sort by date
    return [...tasks].sort((a, b) => {
      const dateA = a.due_date ? new Date(a.due_date).getTime() : 0;
      const dateB = b.due_date ? new Date(b.due_date).getTime() : 0;
      return dateA - dateB;
    });
  }, [tasks]);

  const taskY = (taskId: string) => {
    const index = sortedTasks.findIndex(t => t.id === taskId);
    return index * ROW_HEIGHT + HEADER_HEIGHT + 10;
  };

  return (
    <div className="w-full overflow-x-auto bg-slate-900/50 rounded-xl border border-slate-700 p-4">
      <div 
        style={{ 
          width: dates.length * COLUMN_WIDTH, 
          height: sortedTasks.length * ROW_HEIGHT + HEADER_HEIGHT + 20,
          position: 'relative'
        }}
      >
        {/* Grid lines */}
        {dates.map((date, i) => (
          <div 
            key={i}
            className="absolute top-0 bottom-0 border-l border-slate-700/30"
            style={{ left: i * COLUMN_WIDTH }}
          >
            <span className="text-xs text-slate-500 p-1 block bg-slate-800/80 rounded mt-1 ml-1">
              {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
        ))}

        {/* Dependency lines */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{ width: '100%', height: '100%' }}
        >
          {edges.map((edge, i) => {
            const fromTask = tasks.find(t => t.id === edge.from);
            const toTask = tasks.find(t => t.id === edge.to);
            if (!fromTask || !toTask) return null;

            const x1 = getX(fromTask.due_date) + 80; // End of bar approx
            const y1 = taskY(edge.from) + ROW_HEIGHT / 4;
            const x2 = getX(toTask.due_date) - 10;
            const y2 = taskY(edge.to) + ROW_HEIGHT / 4;

            return (
              <line 
                key={i}
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(148, 163, 184, 0.4)"
                strokeWidth="1.5"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="rgba(148, 163, 184, 0.4)" />
            </marker>
          </defs>
        </svg>

        {/* Task bars */}
        {sortedTasks.map((task) => {
          const x = getX(task.due_date);
          const y = taskY(task.id);
          const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';

          return (
            <motion.div
              key={task.id}
              layoutId={task.id}
              className={`absolute h-8 rounded-lg flex items-center px-3 shadow-lg border cursor-pointer group ${
                task.status === 'completed' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' :
                isOverdue ? 'bg-rose-500/20 border-rose-500/50 text-rose-400' :
                task.status === 'blocked' ? 'bg-amber-500/20 border-amber-500/50 text-amber-400' :
                'bg-blue-500/20 border-blue-500/50 text-blue-400'
              }`}
              style={{ left: x, top: y, width: 200 }}
              whileHover={{ scale: 1.02, x: x + 2 }}
            >
              <div className="truncate text-sm font-medium">{task.title}</div>
              <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-xs uppercase font-bold px-1.5 py-0.5 rounded bg-black/40">
                  {task.status}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

