type Scope = { tenantId: string; taskId: string };
type KickServices = {
  schedule: (work: () => Promise<void>) => void;
  process: (limit: number, scope: Scope) => Promise<unknown>;
  log: (error: unknown) => void;
};

/** The persisted task remains authoritative; the kick uses its normal atomic lease. */
export async function scheduleDurableWorkerKick(scope: Scope | Scope[], services?: KickServices): Promise<void> {
  "use step";
  const schedule = services?.schedule || (await import('next/server')).after;
  const runtime: KickServices = services || {
    schedule,
    process: async (limit, taskScope) => {
      const { processClaimableTasks } = await import('@/lib/bonnie/runtime/workerService');
      return processClaimableTasks(limit, taskScope);
    },
    log: error => console.error('[durable-worker] scoped kick failed; task remains durable', error),
  };
  try {
    runtime.schedule(async () => {
      for (const taskScope of Array.isArray(scope) ? scope : [scope]) {
        try { await runtime.process(1, taskScope); }
        catch (error) { runtime.log(error); }
      }
    });
  } catch (error) {
    // Outside a Next request (e.g. a worker), the durable poller owns execution.
    runtime.log(error);
  }
}
