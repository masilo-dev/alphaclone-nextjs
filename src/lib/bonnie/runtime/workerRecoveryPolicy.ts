/** Recovery can exclude historical work without changing or replaying its records. */
export function workerRecoveryFilter(env: NodeJS.ProcessEnv = process.env): string | null {
  const cutoff = env.BONNIE_WORKER_MIN_TASK_CREATED_AT?.trim();
  const ids = (env.BONNIE_WORKER_RECOVERY_TASK_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
  if (ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    throw new Error('Invalid worker recovery task ID');
  }
  if (!cutoff) {
    if (ids.length) throw new Error('Worker recovery IDs require a creation-time cutoff');
    return null;
  }
  const parsed = Date.parse(cutoff);
  if (!Number.isFinite(parsed)) throw new Error('Invalid worker recovery creation-time cutoff');
  return [`created_at.gte.${new Date(parsed).toISOString()}`, ...(ids.length ? [`id.in.(${ids.join(',')})`] : [])].join(',');
}
