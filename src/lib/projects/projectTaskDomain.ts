export const PROJECT_STATUSES = [
  'proposed', 'planning', 'ready', 'in_progress', 'at_risk', 'blocked',
  'on_hold', 'in_review', 'completed', 'cancelled', 'archived',
] as const;

export const TASK_STATUSES = [
  'backlog', 'to_do', 'in_progress', 'blocked', 'in_review',
  'awaiting_approval', 'done', 'cancelled', 'archived',
] as const;

export type ProjectStatus = typeof PROJECT_STATUSES[number];
export type TaskStatus = typeof TASK_STATUSES[number];

export const PROJECT_TRANSITIONS: Record<ProjectStatus, readonly ProjectStatus[]> = {
  proposed: ['planning', 'cancelled', 'archived'],
  planning: ['ready', 'on_hold', 'cancelled'],
  ready: ['in_progress', 'on_hold', 'cancelled'],
  in_progress: ['at_risk', 'blocked', 'on_hold', 'in_review', 'completed'],
  at_risk: ['in_progress', 'blocked', 'on_hold', 'in_review'],
  blocked: ['in_progress', 'at_risk', 'on_hold', 'cancelled'],
  on_hold: ['planning', 'ready', 'in_progress', 'cancelled'],
  in_review: ['in_progress', 'completed'],
  completed: ['archived'],
  cancelled: ['archived'],
  archived: [],
};

export const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  backlog: ['to_do', 'cancelled', 'archived'],
  to_do: ['in_progress', 'blocked', 'cancelled', 'archived'],
  in_progress: ['blocked', 'in_review', 'awaiting_approval', 'done', 'cancelled'],
  blocked: ['to_do', 'in_progress', 'cancelled'],
  in_review: ['in_progress', 'awaiting_approval', 'done'],
  awaiting_approval: ['in_progress', 'done'],
  done: ['in_progress', 'archived'],
  cancelled: ['to_do', 'archived'],
  archived: [],
};

const LEGACY_TASK_STATUS: Record<string, TaskStatus> = {
  ideas: 'backlog',
  todo: 'to_do',
  review: 'in_review',
  completed: 'done',
};

const STORAGE_TASK_STATUS: Partial<Record<TaskStatus, string>> = {
  backlog: 'ideas',
  to_do: 'todo',
  in_review: 'review',
  done: 'completed',
};

export function normalizeTaskStatus(status: string): TaskStatus | null {
  const normalized = LEGACY_TASK_STATUS[status] ?? status;
  return TASK_STATUSES.includes(normalized as TaskStatus) ? normalized as TaskStatus : null;
}

export function taskStatusForStorage(status: TaskStatus): string {
  return STORAGE_TASK_STATUS[status] ?? status;
}

export function canTransitionTask(from: string, to: string): boolean {
  const current = normalizeTaskStatus(from);
  const next = normalizeTaskStatus(to);
  return Boolean(current && next && (current === next || TASK_TRANSITIONS[current].includes(next)));
}

export function canTransitionProject(from: ProjectStatus, to: ProjectStatus): boolean {
  return from === to || PROJECT_TRANSITIONS[from].includes(to);
}

export function calculateWeightedProgress(
  tasks: Array<{ status: string; weight?: number | null; deletedAt?: string | null }>,
): number {
  const active = tasks.filter((task) => !task.deletedAt);
  const total = active.reduce((sum, task) => sum + Math.max(0, task.weight ?? 1), 0);
  if (!total) return 0;
  const complete = active.reduce((sum, task) => {
    return normalizeTaskStatus(task.status) === 'done'
      ? sum + Math.max(0, task.weight ?? 1)
      : sum;
  }, 0);
  return Math.round((complete / total) * 10_000) / 100;
}

export type ProjectHealth = {
  status: 'not_assessed' | 'on_track' | 'needs_attention' | 'at_risk' | 'blocked' | 'overdue' | 'completed';
  reasons: string[];
};

export function calculateProjectHealth(input: {
  status: string;
  targetDate?: string | null;
  overdueTaskCount?: number;
  blockedTaskCount?: number;
  overdueMilestoneCount?: number;
  budgetVariancePercent?: number | null;
}): ProjectHealth {
  const reasons: string[] = [];
  const status = input.status.toLowerCase();
  if (['completed', 'done'].includes(status)) return { status: 'completed', reasons: ['Project is completed'] };
  if (status === 'blocked' || (input.blockedTaskCount ?? 0) > 0) {
    if ((input.blockedTaskCount ?? 0) > 0) reasons.push(`${input.blockedTaskCount} blocked task(s)`);
    if (status === 'blocked') reasons.push('Project status is blocked');
    return { status: 'blocked', reasons };
  }
  if (input.targetDate && new Date(input.targetDate).getTime() < Date.now()) {
    return { status: 'overdue', reasons: ['Target date has passed'] };
  }
  if ((input.overdueMilestoneCount ?? 0) > 0) reasons.push(`${input.overdueMilestoneCount} overdue milestone(s)`);
  if ((input.overdueTaskCount ?? 0) > 2) reasons.push(`${input.overdueTaskCount} overdue task(s)`);
  if ((input.budgetVariancePercent ?? 0) > 10) reasons.push(`Budget is ${input.budgetVariancePercent}% over plan`);
  if (reasons.length >= 2) return { status: 'at_risk', reasons };
  if (reasons.length === 1) return { status: 'needs_attention', reasons };
  return { status: 'on_track', reasons: ['No deterministic risk signals detected'] };
}

export function wouldCreateDependencyCycle(
  taskId: string,
  dependsOnTaskId: string,
  dependencies: Array<{ taskId: string; dependsOnTaskId: string }>,
): boolean {
  if (taskId === dependsOnTaskId) return true;
  const graph = new Map<string, string[]>();
  for (const edge of dependencies) {
    graph.set(edge.taskId, [...(graph.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
  }
  graph.set(taskId, [...(graph.get(taskId) ?? []), dependsOnTaskId]);
  const visited = new Set<string>();
  const stack = new Set<string>();
  const visit = (node: string): boolean => {
    if (stack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    stack.add(node);
    for (const next of graph.get(node) ?? []) if (visit(next)) return true;
    stack.delete(node);
    return false;
  };
  return visit(taskId);
}
