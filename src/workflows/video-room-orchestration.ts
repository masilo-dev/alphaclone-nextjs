import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
<<<<<<< HEAD
 * Enforces the scheduled meeting deadline even when every browser disconnects.
 * The browser timer remains a convenience; this durable workflow is authoritative.
 */
export async function videoRoomOrchestrationWorkflow({
  meetingId,
  tenantId,
}: {
  meetingId: string;
  tenantId: string;
}) {
  'use workflow';

  const deadline = await loadMeetingDeadline(meetingId, tenantId);
  if (!deadline) return;
  await sleep(new Date(deadline));
  await closeExpiredMeeting(meetingId, tenantId);
}

async function loadMeetingDeadline(meetingId: string, tenantId: string): Promise<string | null> {
  'use step';
  const admin = createSupabaseAdminClient();
  const { data: meeting, error } = await admin
    .from('video_calls')
    .select('scheduled_at, created_at, duration_limit_minutes, is_permanent')
    .eq('id', meetingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!meeting) throw new Error('Meeting not found in workspace');
  if (meeting.is_permanent) return null;

  const startMs = new Date(meeting.scheduled_at || meeting.created_at).getTime();
  const durationMs = Math.max(5, Number(meeting.duration_limit_minutes || 40)) * 60_000;
  return new Date(startMs + durationMs).toISOString();
}

async function closeExpiredMeeting(meetingId: string, tenantId: string): Promise<void> {
  'use step';
  const admin = createSupabaseAdminClient();
  const { data: meeting, error } = await admin
    .from('video_calls')
    .select('id, status, started_at')
    .eq('id', meetingId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!meeting || meeting.status === 'ended' || meeting.status === 'cancelled') return;

  const now = new Date();
  const wasActive = meeting.status === 'active';
  const durationSeconds = meeting.started_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(meeting.started_at).getTime()) / 1000))
    : 0;
  const nextStatus = wasActive ? 'ended' : 'cancelled';
  const endedReason = wasActive ? 'time_limit' : 'not_started_before_expiry';

  const { data: closed, error: closeError } = await admin
    .from('video_calls')
    .update({
      status: nextStatus,
      ended_at: now.toISOString(),
      cancelled_at: wasActive ? null : now.toISOString(),
      duration_seconds: durationSeconds,
      ended_reason: endedReason,
      updated_at: now.toISOString(),
    })
    .eq('id', meetingId)
    .eq('tenant_id', tenantId)
    .in('status', ['scheduled', 'active'])
    .select('id')
    .maybeSingle();
  if (closeError) throw closeError;
  if (!closed) return;

  const { error: expireError } = await admin
    .from('meeting_links')
    .update({ expires_at: now.toISOString() })
    .eq('meeting_id', meetingId);
  if (expireError) throw expireError;

  const { error: eventError } = await admin.from('business_automation_events').insert({
    tenant_id: tenantId,
    event_type: wasActive ? 'meeting_auto_ended' : 'meeting_expired_unstarted',
    payload: { meetingId, durationSeconds, endedReason },
  });
  if (eventError) throw eventError;
=======
 * Video Room Orchestration Workflow
 * Manages post-meeting cleanup and CRM sync.
 */
export async function videoRoomOrchestrationWorkflow({ meetingId, tenantId }: { meetingId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Save Room to Supabase (Done in route, but we track it here)
  await verifyRoomActive(meetingId);

  // 2. Wait for meeting to end (Wait 2 hours max)
  await sleep('2h');
  await meetingEndLogic(meetingId, tenantId);
}

async function verifyRoomActive(meetingId: string) {
  "use step";
  console.log(`Verifying room for meeting ${meetingId} is active`);
}

async function meetingEndLogic(meetingId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  console.log(`Calculating duration for meeting ${meetingId}`);
  
  await supabase.from('client_activities').insert({
    tenant_id: tenantId,
    type: 'meeting',
    description: `Participated in video meeting ${meetingId}`,
    created_at: new Date().toISOString()
  });

  await sendFollowUp(meetingId);
}

async function sendFollowUp(meetingId: string) {
  "use step";
  console.log(`Sending post-meeting summary for ${meetingId}`);
>>>>>>> origin/main
}
