export type ProjectHealthStatus =
  | 'HEALTHY'
  | 'AT_RISK'
  | 'BLOCKED'
  | 'OVERDUE'
  | 'WAITING_ON_CLIENT'
  | 'WAITING_ON_PAYMENT'
  | 'COMPLETED';

export interface ProjectHealthInput {
  projectStatus?: string | null;
  dueDate?: string | null;
  openBlockers?: number;
  overdueTasks?: number;
  overdueMilestones?: number;
  pendingClientApprovals?: number;
  outstandingAmount?: number;
  paymentOverdue?: boolean;
  completedTasks?: number;
  totalTasks?: number;
}

export interface ProjectHealthResult {
  status: ProjectHealthStatus;
  reasons: string[];
}

function isCompletedStatus(status: string | null | undefined): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return ['completed', 'complete', 'done', 'closed', 'finished'].includes(normalized);
}

export function evaluateProjectHealth(input: ProjectHealthInput, now = new Date()): ProjectHealthResult {
  if (isCompletedStatus(input.projectStatus)) {
    return { status: 'COMPLETED', reasons: ['Project is marked completed.'] };
  }

  const reasons: string[] = [];
  const openBlockers = Math.max(0, Number(input.openBlockers || 0));
  const overdueTasks = Math.max(0, Number(input.overdueTasks || 0));
  const overdueMilestones = Math.max(0, Number(input.overdueMilestones || 0));
  const pendingClientApprovals = Math.max(0, Number(input.pendingClientApprovals || 0));
  const outstandingAmount = Math.max(0, Number(input.outstandingAmount || 0));

  if (openBlockers > 0) {
    reasons.push(`${openBlockers} unresolved blocker${openBlockers === 1 ? '' : 's'}.`);
    return { status: 'BLOCKED', reasons };
  }

  const due = input.dueDate ? new Date(input.dueDate) : null;
  const projectOverdue = Boolean(due && !Number.isNaN(due.getTime()) && due.getTime() < now.getTime());
  if (projectOverdue || overdueTasks > 0 || overdueMilestones > 0) {
    if (projectOverdue) reasons.push('Project deadline has passed.');
    if (overdueTasks > 0) reasons.push(`${overdueTasks} task${overdueTasks === 1 ? '' : 's'} overdue.`);
    if (overdueMilestones > 0) reasons.push(`${overdueMilestones} milestone${overdueMilestones === 1 ? '' : 's'} overdue.`);
    return { status: 'OVERDUE', reasons };
  }

  if (pendingClientApprovals > 0) {
    reasons.push(`${pendingClientApprovals} client approval${pendingClientApprovals === 1 ? '' : 's'} pending.`);
    return { status: 'WAITING_ON_CLIENT', reasons };
  }

  if (input.paymentOverdue && outstandingAmount > 0) {
    reasons.push(`Payment is overdue with ${outstandingAmount.toFixed(2)} outstanding.`);
    return { status: 'WAITING_ON_PAYMENT', reasons };
  }

  const totalTasks = Math.max(0, Number(input.totalTasks || 0));
  const completedTasks = Math.max(0, Number(input.completedTasks || 0));
  if (totalTasks >= 4 && completedTasks / totalTasks < 0.25) {
    reasons.push('Less than 25% of tracked tasks are complete.');
    return { status: 'AT_RISK', reasons };
  }

  return { status: 'HEALTHY', reasons: ['No active blocker, overdue checkpoint, client wait, or overdue payment detected.'] };
}
