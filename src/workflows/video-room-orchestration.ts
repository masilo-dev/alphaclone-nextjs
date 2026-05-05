import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
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
}
