/**
 * Fire-and-forget background work on Railway (long-running Node process).
 * Replaces Vercel's waitUntil for post-response side effects.
 */
export function runInBackground(task: Promise<unknown> | (() => Promise<unknown>)): void {
  const promise = typeof task === 'function' ? task() : task;
  void promise.catch((error: unknown) => {
    console.error('[backgroundTask]', error);
  });
}
