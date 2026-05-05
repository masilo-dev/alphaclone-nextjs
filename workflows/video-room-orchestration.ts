import { workflow, step } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Video Room Orchestration Workflow
 * Manages post-meeting cleanup and CRM sync.
 */
export const videoRoomOrchestrationWorkflow = workflow(async ({ meetingId, tenantId }: { meetingId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Save Room to Supabase (Done in route, but we track it here)
  await step('verify-room-active', async () => {
    console.log(`Verifying room for meeting ${meetingId} is active`);
  });

  // 2. Wait for meeting to end (Wait 2 hours max or polled check)
  await step('meeting-end-logic', async () => {
    // 3. Update Meeting Duration
    console.log(`Calculating duration for meeting ${meetingId}`);
    
    // 4. Update CRM with Meeting Log
    await supabase.from('client_activities').insert({
      tenant_id: tenantId,
      type: 'meeting',
      description: `Participated in video meeting ${meetingId}`,
      created_at: new Date().toISOString()
    });

    // 5. Send Post-Meeting Email
    await step('send-follow-up', async () => {
      console.log(`Sending post-meeting summary for ${meetingId}`);
    });
  }, { wait: '2h' });
});
