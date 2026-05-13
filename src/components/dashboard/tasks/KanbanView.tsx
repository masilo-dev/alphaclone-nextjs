'use client';

import React, { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MoreVertical, Clock, AlertCircle, CheckCircle2, 
  Circle, PlayCircle, Eye, MessageSquare, Link2,
  Zap
} from 'lucide-react';
import { Task } from '../../../services/taskService';

interface KanbanViewProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: Task['status']) => Promise<void>;
  onEditTask: (task: Task) => void;
}

const STATUSES: { id: Task['status']; label: string; icon: any; color: string }[] = [
  { id: 'todo', label: 'Todo', icon: Circle, color: 'text-slate-400' },
  { id: 'in_progress', label: 'Active', icon: PlayCircle, color: 'text-blue-400' },
  { id: 'review', label: 'Review', icon: Eye, color: 'text-amber-400' },
  { id: 'completed', label: 'Success', icon: CheckCircle2, color: 'text-teal-400' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onUpdateStatus, onEditTask }) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tasksByStatus = useMemo(() => {
    return STATUSES.reduce((acc, status) => {
      acc[status.id] = tasks.filter((t) => t.status === status.id);
      return acc;
    }, {} as Record<Task['status'], Task[]>);
  }, [tasks]);

  const activeTask = useMemo(() => tasks.find((t) => t.id === activeId), [tasks, activeId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeTaskId = active.id as string;
    const overId = over.id as string;

    // Determine if we dropped on a column or another task
    let newStatus: Task['status'] | null = null;

    if (STATUSES.some(s => s.id === overId)) {
        newStatus = overId as Task['status'];
    } else {
        const overTask = tasks.find(t => t.id === overId);
        if (overTask) newStatus = overTask.status;
    }

    const task = tasks.find(t => t.id === activeTaskId);
    if (task && newStatus && task.status !== newStatus) {
      await onUpdateStatus(activeTaskId, newStatus);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-full min-h-[600px]">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] || []}
            onEditTask={onEditTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: {
                    opacity: '0.5',
                },
            },
        }),
      }}>
        {activeTask ? (
          <div className="w-[300px]">
            <KanbanCard task={activeTask} isDragging onEdit={() => {}} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

interface KanbanColumnProps {
  status: typeof STATUSES[0];
  tasks: Task[];
  onEditTask: (task: Task) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({ status, tasks, onEditTask }) => {
  const { id, label, icon: Icon, color } = status;

  return (
    <div className="flex flex-col h-full bg-slate-950/30 rounded-3xl border border-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between px-2 shrink-0">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">{label}</h3>
          <span className="text-[10px] font-bold text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-white/5">
            {tasks.length}
          </span>
        </div>
        <button className="text-slate-600 hover:text-slate-400">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-[150px]">
        <SortableContext id={id} items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onEdit={onEditTask} />
            ))}
            {tasks.length === 0 && (
                <div className="h-24 border border-dashed border-white/5 rounded-2xl flex items-center justify-center">
                    <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">No Intel</p>
                </div>
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onEdit: (task: Task) => void;
}

const SortableTaskCard = ({ task, onEdit }: TaskCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <KanbanCard task={task} isDragging={isDragging} onEdit={onEdit} />
    </div>
  );
};

const KanbanCard = ({ task, isDragging, onEdit }: TaskCardProps) => {
  const urgencyColor = task.priority === 'urgent' ? 'border-rose-500/50 shadow-rose-500/10' :
                       task.priority === 'high' ? 'border-amber-500/50 shadow-amber-500/10' :
                       'border-white/5 shadow-black/20';

  const urgencyGlow = task.priority === 'urgent' ? 'shadow-[0_0_15px_-5px_rgba(244,63,94,0.3)]' :
                      task.priority === 'high' ? 'shadow-[0_0_15px_-5px_rgba(245,158,11,0.2)]' : '';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`group bg-slate-900/60 backdrop-blur-xl p-4 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${urgencyColor} ${urgencyGlow} ${isDragging ? 'opacity-50' : 'opacity-100'}`}
      onClick={() => onEdit(task)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors leading-tight truncate">
            {task.title}
          </h4>
          {task.priority === 'urgent' && (
              <Zap className="w-3 h-3 text-rose-500 fill-rose-500/20 shrink-0" />
          )}
        </div>

        {task.description && (
          <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed font-medium">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            {task.dueDate && (
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-600">
                <Clock className="w-3 h-3" />
                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            )}
            {(task.metadata?.linkedCount > 0 || task.relatedToProject) && (
              <Link2 className="w-3 h-3 text-slate-700" />
            )}
          </div>
          
          <div className="flex -space-x-2">
            {[1].map((_, i) => (
              <div key={i} className="w-5 h-5 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center">
                <UserIcon className="w-2.5 h-2.5 text-slate-500" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
