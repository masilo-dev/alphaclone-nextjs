/**
 * In-process counters for worker / MCP / reconciliation telemetry.
 */

let activeWorkerTicks = 0;
let activeBonnieTasks = 0;
let activeMcpRequests = 0;
let activeReconciliation = 0;
let queueDepth = 0;

export type WorkerRuntimeCounters = {
  activeWorkerTicks: number;
  activeBonnieTasks: number;
  activeMcpRequests: number;
  activeReconciliation: number;
  queueDepth: number;
};

export function getWorkerRuntimeCounters(): WorkerRuntimeCounters {
  return {
    activeWorkerTicks,
    activeBonnieTasks,
    activeMcpRequests,
    activeReconciliation,
    queueDepth,
  };
}

export function incrementActiveWorkerTicks(): void {
  activeWorkerTicks += 1;
}

export function decrementActiveWorkerTicks(): void {
  activeWorkerTicks = Math.max(0, activeWorkerTicks - 1);
}

export function setActiveBonnieTasks(count: number): void {
  activeBonnieTasks = Math.max(0, count);
}

export function incrementActiveBonnieTasks(): void {
  activeBonnieTasks += 1;
}

export function decrementActiveBonnieTasks(): void {
  activeBonnieTasks = Math.max(0, activeBonnieTasks - 1);
}

export function incrementActiveMcpRequests(): void {
  activeMcpRequests += 1;
}

export function decrementActiveMcpRequests(): void {
  activeMcpRequests = Math.max(0, activeMcpRequests - 1);
}

export function incrementActiveReconciliation(): void {
  activeReconciliation += 1;
}

export function decrementActiveReconciliation(): void {
  activeReconciliation = Math.max(0, activeReconciliation - 1);
}

export function setQueueDepth(depth: number): void {
  queueDepth = Math.max(0, depth);
}
