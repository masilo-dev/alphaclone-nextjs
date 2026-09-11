type HermesTaskInput = {
  tenantId: string;
  userId: string;
  taskId: string;
  prompt: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

export type HermesDispatchResult = {
  dispatched: boolean;
  hermesTaskId?: string;
  status: 'queued' | 'local_queued' | 'unavailable';
  message?: string;
  runId?: string;
  goalId?: string | null;
  graphId?: string | null;
  worker?: {
    processed: number;
    completed: number;
    waiting: number;
    failed: number;
  };
};

function hermesConfig() {
  return {
    url: process.env.HERMES_INTERNAL_URL?.replace(/\/$/, '') || '',
    apiKey: process.env.HERMES_INTERNAL_API_KEY || '',
    localMode: process.env.HERMES_LOCAL_MODE !== 'false',
  };
}

export function isHermesConfigured() {
  const config = hermesConfig();
  return config.localMode || Boolean(config.url && config.apiKey);
}

export async function dispatchHermesTask(input: HermesTaskInput): Promise<HermesDispatchResult> {
  const config = hermesConfig();
  if (config.localMode && !config.url) {
    const { createSupabaseAdminClient } = await import('@/lib/supabase-admin');
    const { createInitialGraphForObjective } = await import('@/lib/bonnie/runtime/plannerService');
    const { scheduleReadyTasks } = await import('@/lib/bonnie/runtime/schedulerService');
    const { publishOutboxBatch } = await import('@/lib/bonnie/runtime/outboxService');
    const { processClaimableTasks } = await import('@/lib/bonnie/runtime/workerService');
    const admin = createSupabaseAdminClient();

    const { data: run, error } = await admin
      .from('agent_runs')
      .select('id, tenant_id, correlation_id, metadata')
      .eq('tenant_id', input.tenantId)
      .eq('id', input.taskId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!run) throw new Error('Hermes local runtime could not find the recorded agent run');

    const { data: existingGraph } = await admin
      .from('agent_graphs')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('run_id', input.taskId)
      .maybeSingle();

    const graph = existingGraph
      ? { graphId: existingGraph.id }
      : await createInitialGraphForObjective({
          tenantId: input.tenantId,
          runId: input.taskId,
          objective: input.prompt,
          agentIds: ['ceo', 'crm', 'finance', 'operations'],
          correlationId: run.correlation_id,
        });

    await admin
      .from('agent_runs')
      .update({
        status: 'planning',
        metadata: {
          ...(((run.metadata || {}) as Record<string, unknown>)),
          hermesLocal: {
            queuedAt: new Date().toISOString(),
            prompt: input.prompt,
            metadata: input.metadata || {},
          },
        },
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.taskId);

    // Hermes local mode used to stop here at "planning" and depend entirely on
    // external cron/worker deployment. Kick the canonical Bonnie durable runtime
    // once so delegation from chat actually starts. The durable worker retains
    // all existing idempotency, approval, lease and verification semantics.
    let worker: HermesDispatchResult['worker'] | undefined;
    try {
      await scheduleReadyTasks({ tenantId: input.tenantId, runId: input.taskId, limit: 20 });
      await publishOutboxBatch(20);
      const firstTick = await processClaimableTasks(4);
      worker = {
        processed: firstTick.processed,
        completed: firstTick.completed,
        waiting: firstTick.waiting,
        failed: firstTick.failed,
      };
    } catch (kickErr) {
      console.warn('[Hermes] local runtime kick failed; durable worker can retry:', kickErr);
    }

    return {
      dispatched: true,
      status: 'local_queued',
      hermesTaskId: input.taskId,
      runId: input.taskId,
      goalId: null,
      graphId: graph.graphId,
      worker,
      message: worker && worker.processed > 0
        ? `Hermes local runtime started ${worker.processed} task(s)`
        : 'Hermes local runtime queued the task; the durable worker will continue it',
    };
  }

  if (!config.url || !config.apiKey) {
    return {
      dispatched: false,
      status: 'unavailable',
      message: 'Hermes internal service is not configured',
    };
  }

  const response = await fetch(`${config.url}/tasks`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      tenant_id: input.tenantId,
      user_id: input.userId,
      task_id: input.taskId,
      session_id: input.sessionId || null,
      prompt: input.prompt,
      metadata: input.metadata || {},
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String(payload.error || payload.message || 'Hermes task dispatch failed'));
  }

  return {
    dispatched: true,
    status: 'queued',
    hermesTaskId: payload.id || payload.task_id || payload.taskId,
  };
}
