/** Called only by existing Send/Approve button handlers; never schedules a send. */
export async function fetchApprovedOutreach(url: string, init: RequestInit): Promise<Response> {
  const payload = JSON.parse(String(init.body || '{}'));
  if (payload.queue || payload.autoSend !== true) return fetch(url, init);
  const headers = new Headers(init.headers);
  headers.set('x-outreach-phase', 'approve');
  const approval = await fetch(url, { ...init, headers });
  if (!approval.ok) return approval;
  const { approvalToken } = await approval.json();
  if (!approvalToken) throw new Error('Approval could not be recorded. No email was sent.');
  headers.delete('x-outreach-phase');
  headers.set('x-outreach-approval', approvalToken);
  // No automatic retries. The same payload has a durable server operation identity.
  return fetch(url, { ...init, headers });
}
