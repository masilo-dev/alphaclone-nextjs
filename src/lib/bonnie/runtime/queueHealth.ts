type QueueTask = { id: string; status: string; updated_at: string; scheduled_at?: string | null };

export function diagnoseQueueHealth(tasks: QueueTask[], now = Date.now()) {
  const stalled = tasks.filter(task =>
    ['READY', 'QUEUED'].includes(task.status) &&
    (!task.scheduled_at || Date.parse(task.scheduled_at) <= now) &&
    now - Date.parse(task.updated_at) > 120_000
  );
  return {
    status: stalled.length ? 'stalled' : 'no_stalled_tasks',
    stalled_task_ids: stalled.map(task => task.id),
    message: stalled.length
      ? 'Due tasks have not started for over two minutes. Check the durable worker, cron, and claim errors; do not resend external actions.'
      : null,
  };
}
