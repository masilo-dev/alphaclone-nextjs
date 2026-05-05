import { sleep } from 'workflow';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';

/**
 * Project Kickoff Workflow
 * Sets up the project environment and monitors early progress.
 */
export async function projectKickoffWorkflow({ projectId, tenantId }: { projectId: string; tenantId: string }) {
  "use workflow";
  
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });

  // 1. Create Default Milestones
  await createMilestones(projectId, tenantId);

  // 2. Assign Team Members
  await assignTeam(projectId);

  // 3. Send Kickoff Email
  await sendKickoffEmail(projectId);

  // 4. Check Milestone Progress (Wait 1 week)
  await sleep('7d');
  await checkProgress(projectId, tenantId);

  // 5. Assess Project Health
  await assessHealth(projectId);
}

async function createMilestones(projectId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const milestones = [
    { project_id: projectId, title: 'Project Charter Approved', status: 'pending' },
    { project_id: projectId, title: 'Environment Setup', status: 'pending' }
  ];
  await supabase.from('project_milestones').insert(milestones.map(m => ({ ...m, tenant_id: tenantId })));
}

async function assignTeam(projectId: string) {
  "use step";
  console.log(`Auto-assigning team members to project ${projectId}`);
}

async function sendKickoffEmail(projectId: string) {
  "use step";
  console.log(`Sending kickoff email for project ${projectId}`);
}

async function checkProgress(projectId: string, tenantId: string) {
  "use step";
  const supabase = createSupabaseAdminClient();
  await supabase.rpc('set_tenant_context', { tenant_id: tenantId });
  const { data: milestones } = await supabase.from('project_milestones').select('status').eq('project_id', projectId);
  const allDone = milestones?.every(m => m.status === 'completed');
  
  if (!allDone) {
    console.warn(`Project ${projectId} milestones are behind schedule!`);
  }
}

async function assessHealth(projectId: string) {
  "use step";
  console.log(`Assessing project ${projectId} health index`);
}
