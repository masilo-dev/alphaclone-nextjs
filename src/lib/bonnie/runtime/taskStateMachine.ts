/**
 * Deterministic task state machine with allowlisted transitions.
 * Illegal transitions are rejected server-side.
 */

import type { TaskStatus } from './types';

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ['READY', 'CANCELLED', 'SKIPPED'],
  READY: ['QUEUED', 'CLAIMED', 'CANCELLED', 'PAUSED'],
  QUEUED: ['READY', 'CLAIMED', 'CANCELLED'],
  CLAIMED: ['RUNNING', 'READY', 'FAILED', 'CANCELLED'],
  RUNNING: [
    'COMPLETED',
    'PARTIALLY_COMPLETED',
    'WAITING_FOR_EVENT',
    'WAITING_FOR_APPROVAL',
    'WAITING_FOR_USER',
    'WAITING_FOR_DEPENDENCY',
    'RETRY_SCHEDULED',
    'FAILED',
    'EXECUTION_UNCERTAIN',
    'PAUSED',
    'CANCELLED',
    'COMPENSATING',
  ],
  WAITING_FOR_DEPENDENCY: ['READY', 'CANCELLED', 'FAILED'],
  WAITING_FOR_EVENT: ['READY', 'RETRY_SCHEDULED', 'CANCELLED', 'FAILED', 'PAUSED'],
  WAITING_FOR_APPROVAL: ['READY', 'CANCELLED', 'FAILED', 'PAUSED'],
  WAITING_FOR_USER: ['READY', 'CANCELLED', 'FAILED', 'PAUSED'],
  RETRY_SCHEDULED: ['READY', 'QUEUED', 'FAILED', 'CANCELLED'],
  PAUSED: ['READY', 'CANCELLED', 'FAILED'],
  EXECUTION_UNCERTAIN: ['COMPLETED', 'READY', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED'],
  COMPLETED: ['COMPENSATING'],
  PARTIALLY_COMPLETED: ['READY', 'COMPENSATING', 'CANCELLED'],
  FAILED: ['READY', 'COMPENSATING', 'CANCELLED'],
  CANCELLED: [],
  SKIPPED: [],
  COMPENSATING: ['ROLLED_BACK', 'FAILED', 'COMPLETED'],
  ROLLED_BACK: [],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  if (from === to) return true;
  return (ALLOWED[from] || []).includes(to);
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal task transition ${from} → ${to}`);
  }
}

export function listAllowedTransitions(from: TaskStatus): TaskStatus[] {
  return [...(ALLOWED[from] || [])];
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return ['COMPLETED', 'CANCELLED', 'SKIPPED', 'ROLLED_BACK'].includes(status);
}

export function isWaitingStatus(status: TaskStatus): boolean {
  return [
    'WAITING_FOR_DEPENDENCY',
    'WAITING_FOR_EVENT',
    'WAITING_FOR_APPROVAL',
    'WAITING_FOR_USER',
    'RETRY_SCHEDULED',
    'PAUSED',
    'EXECUTION_UNCERTAIN',
  ].includes(status);
}

export function isClaimableStatus(status: TaskStatus): boolean {
  return status === 'READY' || status === 'QUEUED';
}
