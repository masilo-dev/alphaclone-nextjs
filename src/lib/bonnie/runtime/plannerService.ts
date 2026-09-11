/**
 * Executive planner — builds an initial durable task graph (no side effects).
 */

import type { GraphDependencyInput, GraphTaskInput } from './types';
import { createGraphTransactional } from './graphService';

export async function createInitialGraphForObjective(params: {
  tenantId: string;
  runId: string;
  objective: string;
  agentIds: string[];
  correlationId?: string;
}) {
  const agents = params.agentIds.length ? params.agentIds : ['coo', 'crm', 'finance'];
  const tasks: GraphTaskInput[] = [
    {
      tempId: 't_understand',
      title: 'Understand objective and success criteria',
      taskType: 'plan',
      assignedAgentId: 'ceo',
      status: 'READY',
      riskLevel: 'low',
      structuredInput: { objective: params.objective },
      verificationCriteria: { requireSummary: true },
      metadata: { stage: 'understand' },
    },
    {
      tempId: 't_gather',
      title: 'Gather related business records',
      taskType: 'research',
      assignedAgentId: agents.includes('research') ? 'research' : 'crm',
      status: 'DRAFT',
      riskLevel: 'low',
      structuredInput: { objective: params.objective },
    },
  ];

  // Parallel specialist branches after gather
  const parallelTemps: string[] = [];
  for (const agentId of agents.slice(0, 4)) {
    const tempId = `t_specialist_${agentId}`;
    parallelTemps.push(tempId);
    tasks.push({
      tempId,
      title: `${agentId} specialist work`,
      taskType: 'specialist',
      assignedAgentId: agentId,
      status: 'DRAFT',
      riskLevel: agentId === 'email' || agentId === 'social' ? 'high' : 'medium',
      approvalPolicy:
        agentId === 'email' || agentId === 'social'
          ? { required: true, reason: 'External communication' }
          : {},
      structuredInput: { objective: params.objective, agentId },
    });
  }

  tasks.push({
    tempId: 't_verify',
    title: 'Verify outcomes against success criteria',
    taskType: 'verify',
    assignedAgentId: 'evaluation',
    status: 'DRAFT',
    riskLevel: 'low',
    structuredInput: { objective: params.objective },
    verificationCriteria: { requireFreshData: true },
  });

  tasks.push({
    tempId: 't_monitor',
    title: 'Continue monitoring until objective complete',
    taskType: 'monitor',
    assignedAgentId: 'monitoring',
    status: 'DRAFT',
    riskLevel: 'low',
    structuredInput: { objective: params.objective },
  });

  const dependencies: GraphDependencyInput[] = [
    { taskTempId: 't_gather', dependsOnTempId: 't_understand', dependencyType: 'finish_to_start' },
  ];
  for (const tempId of parallelTemps) {
    dependencies.push({
      taskTempId: tempId,
      dependsOnTempId: 't_gather',
      dependencyType: 'finish_to_start',
    });
    dependencies.push({
      taskTempId: 't_verify',
      dependsOnTempId: tempId,
      dependencyType: 'all_completed',
    });
  }
  dependencies.push({
    taskTempId: 't_monitor',
    dependsOnTempId: 't_verify',
    dependencyType: 'succeeded',
  });

  return createGraphTransactional({
    tenantId: params.tenantId,
    runId: params.runId,
    tasks,
    dependencies,
    reason: 'initial_plan',
    actorType: 'planner',
    actorId: 'executive',
  });
}
