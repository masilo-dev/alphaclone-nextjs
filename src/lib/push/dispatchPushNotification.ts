/** Fan-out in-app + web-push (+ optional email) via the central dispatch API. */
export async function dispatchPushNotification(payload: {
  userId: string;
  tenantId?: string;
  type?: string;
  title: string;
  message?: string;
  link?: string;
  email?: boolean;
}): Promise<void> {
  try {
    await fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, email: payload.email ?? false }),
    });
  } catch {
    // Non-blocking — realtime may still deliver in foreground.
  }
}
