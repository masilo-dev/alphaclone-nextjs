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
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import {
  MoreVertical, Clock, CheckCircle2,
  Circle, PlayCircle, Eye, Link2,
  Zap, User as UserIcon, Lightbulb
} from 'lucide-react';
import { Task } from '../../../services/taskService';

interface KanbanViewProps {
  tasks: Task[];
  onUpdateStatus: (taskId: string, newStatus: Task['status']) => Promise<void>;
  onEditTask: (task: Task) => void;
}

const STATUSES: { id: Task['status']; label: string; icon: any; color: string; tint: string }[] = [
  { id: 'ideas', label: 'Ideas', icon: Lightbulb, color: 'text-[var(--ac-bonnie)]', tint: 'color-mix(in srgb, var(--ac-bonnie) 10%, transparent)' },
  { id: 'todo', label: 'Todo', icon: Circle, color: 'text-[var(--ws-text-secondary)]', tint: 'var(--ws-surface-secondary)' },
  { id: 'in_progress', label: 'Active', icon: PlayCircle, color: 'text-[var(--ac-accent)]', tint: 'var(--ac-accent-muted)' },
  { id: 'review', label: 'Review', icon: Eye, color: 'text-[var(--warning)]', tint: 'color-mix(in srgb, var(--warning) 10%, transparent)' },
  { id: 'completed', label: 'Success', icon: CheckCircle2, color: 'text-[var(--success)]', tint: 'color-mix(in srgb, var(--success) 10%, transparent)' },
];

export const KanbanView: React.FC<KanbanViewProps> = ({ tasks, onUpdateStatus, onEditTask }) => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
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
    let newStatus: Task['status'] | null = null;

    if (STATUSES.some((s) => s.id === overId)) {
      newStatus = overId as Task['status'];
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) newStatus = overTask.status;
    }

    const task = tasks.find((t) => t.id === activeTaskId);
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
      <div className="grid min-h-[600px] h-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        {STATUSES.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] || []}
            onEditTask={onEditTask}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          sideEffects: defaultDropAnimationSideEffects({
            styles: { active: { opacity: '0.5' } },
          }),
        }}
      >
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
  const { id, label, icon: Icon, color, tint } = status;

  return (
    <section className="flex h-full flex-col space-y-4 rounded-[var(--ws-radius-lg,14px)] border border-[var(--ws-border)] bg-[var(--ws-surface-secondary)] p-4">
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--ws-radius-control,8px)]" style={{ background: tint }}>
            <Icon className={`h-4 w-4 ${color}`} aria-hidden="true" />
          </span>
          <h3 className="truncate text-xs font-semibold text-[var(--ws-text-primary)]">{label}</h3>
          <span className="rounded-full border border-[var(--ws-border)] bg-[var(--ws-panel)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--ws-text-tertiary)]">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          aria-label={`${label} column options`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--ws-radius-control,8px)] text-[var(--ws-text-tertiary)] hover:bg-[var(--ws-hover)] hover:text-[var(--ws-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-[150px] flex-1">
        <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {tasks.map((task) => (
              <SortableTaskCard key={task.id} task={task} onEdit={onEditTask} />
            ))}
            {tasks.length === 0 ? (
              <div className="flex h-24 items-center justify-center rounded-[var(--ws-radius-lg,14px)] border border-dashed border-[var(--ws-border)]">
                <p className="text-[11px] font-medium text-[var(--ws-text-tertiary)]">No tasks</p>
              </div>
            ) : null}
          </div>
        </SortableContext>
      </div>
    </section>
  );
};

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  onEdit: (task: Task) => void;
}

const SortableTaskCard = ({ task, onEdit }: TaskCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

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
  const priorityStyle = task.priority === 'urgent'
    ? 'border-[color-mix(in_srgb,var(--danger)_38%,var(--ws-border))]'
    : task.priority === 'high'
      ? 'border-[color-mix(in_srgb,var(--warning)_38%,var(--ws-border))]'
      : 'border-[var(--ws-border)]';

  const subtaskStats = useMemo(() => {
    const subs = task.subtasks || [];
    if (subs.length === 0) return null;
    const completed = subs.filter((s) => s.completed).length;
    const percent = Math.round((completed / subs.length) * 100);
    return { completed, total: subs.length, percent };
  }, [task.subtasks]);

  return (
    <motion.button
      type="button"
      layout
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.28 }}
      className={`group w-full cursor-grab rounded-[var(--ws-radius-lg,14px)] border bg-[var(--ws-panel)] p-4 text-left shadow-sm outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${priorityStyle} ${isDragging ? 'opacity-55' : 'opacity-100'}`}
      onClick={() => onEdit(task)}
      aria-label={`Open task ${task.title}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="truncate text-sm font-semibold leading-tight text-[var(--ws-text-primary)]">
            {task.title}
          </h4>
          {task.priority === 'urgent' ? (
            <Zap className="h-3 w-3 shrink-0 text-[var(--danger)]" aria-label="Urgent priority" />
          ) : null}
        </div>

        {task.description ? (
          <p className="line-clamp-2 text-[11px] font-normal leading-relaxed text-[var(--ws-text-secondary)]">
            {task.description}
          </p>
        ) : null}

        {(task.relatedToProject || task.relatedToLead || task.relatedToDeal) ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {task.relatedToProject ? (
              <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--ac-bonnie)_22%,transparent)] bg-[color-mix(in_srgb,var(--ac-bonnie)_10%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-[var(--ac-bonnie)]">Project</span>
            ) : null}
            {task.relatedToLead ? (
              <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--ac-accent)_22%,transparent)] bg-[var(--ac-accent-muted)] px-2 py-0.5 text-[9px] font-semibold text-[var(--ac-accent)]">Lead</span>
            ) : null}
            {task.relatedToDeal ? (
              <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--warning)_22%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-[var(--warning)]">Deal</span>
            ) : null}
          </div>
        ) : null}

        {subtaskStats ? (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[10px] font-medium text-[var(--ws-text-tertiary)]">
              <span>Progress</span>
              <span className="tabular-nums">{subtaskStats.completed}/{subtaskStats.total} ({subtaskStats.percent}%)</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--ws-surface-secondary)]">
              <div
                className="h-full bg-[var(--brand-teal)] transition-[width] duration-300"
                style={{ width: `${subtaskStats.percent}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            {task.dueDate ? (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--ws-text-tertiary)]">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            ) : null}
            {(task.metadata?.linkedCount > 0 || task.relatedToProject) ? (
              <Link2 className="h-3 w-3 text-[var(--ws-text-tertiary)]" aria-label="Linked task" />
            ) : null}
          </div>

          <div className="flex -space-x-2" aria-hidden="true">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--ws-panel)] bg-[var(--ws-surface-secondary)]">
              <UserIcon className="h-2.5 w-2.5 text-[var(--ws-text-tertiary)]" />
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
};
