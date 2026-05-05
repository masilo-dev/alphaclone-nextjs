import { workflow, step } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Project Kickoff Workflow
 * Sets up the project environment and monitors early progress.
 */
export const projectKickoffWorkflow = workflow(async ({ projectId, tenantId }: { projectId: string; tenantId: string }) => {
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Create Default Milestones
  await step('create-milestones', async () => {
    const milestones = [
      { project_id: projectId, title: 'Project Charter Approved', status: 'pending' },
      { project_id: projectId, title: 'Environment Setup', status: 'pending' }
    ];
    await supabase.from('project_milestones').insert(milestones.map(m => ({ ...m, tenant_id: tenantId })));
  });

  // 2. Assign Team Members
  await step('assign-team', async () => {
    // Logic to auto-assign based on availability
    console.log(`Auto-assigning team members to project ${projectId}`);
  });

  // 3. Send Kickoff Email
  await step('send-kickoff-email', async () => {
    console.log(`Sending kickoff email for project ${projectId}`);
  });

  // 4. Check Milestone Progress (Wait 1 week)
  await step('check-progress', async () => {
    const { data: milestones } = await supabase.from('project_milestones').select('status').eq('project_id', projectId);
    const allDone = milestones?.every(m => m.status === 'completed');
    
    if (!allDone) {
      // 5. Alert Project Owner
      await step('alert-owner', async () => {
        console.warn(`Project ${projectId} milestones are behind schedule!`);
      });
    }
  }, { wait: '7d' });

  // 6. Assess Project Health
  await step('assess-health', async () => {
    console.log(`Assessing project ${projectId} health index`);
  });
});
