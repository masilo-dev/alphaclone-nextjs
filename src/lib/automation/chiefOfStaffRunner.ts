import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { createMCPServer } from '@/services/mcp/MCPServer';
import {
  completeWorkflowRun,
  recordWorkflowStep,
  startWorkflowRun,
} from '@/lib/automation/workflowRuns';

function warsawDateKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

async function resolveTenantOwnerUserId(tenantId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('tenant_users')
    .select('user_id, role')
    .eq('tenant_id', tenantId)
    .in('role', ['owner', 'admin'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.user_id || null;
}

export async function runChiefOfStaffForTenant(tenantId: string, userId?: string | null) {
  const ownerId = userId || (await resolveTenantOwnerUserId(tenantId));
  if (!ownerId) {
    return { success: false, error: 'No tenant owner found for chief of staff run' };
  }

  const idempotencyKey = `chief_of_staff:${warsawDateKey()}`;
  const workflowRun = await startWorkflowRun({
    tenantId,
    userId: ownerId,
    workflowId: 'run_chief_of_staff_routine',
    idempotencyKey,
    currentStep: 'pipeline_health',
  });

  const server = createMCPServer({ tenantId, userId: ownerId });
  const result = await server.runTool('run_chief_of_staff_routine', {
    tenant_id: tenantId,
    user_id: ownerId,
  });

  const failed = Boolean(result.isError);
  await recordWorkflowStep(workflowRun.id, 'run_chief_of_staff_routine', failed ? 'error' : 'ok', {
    error: failed ? result.content?.[0]?.text : undefined,
  });

  if (!failed) {
    await completeWorkflowRun(workflowRun.id, { idempotencyKey });
  }

  return {
    success: !failed,
    workflowRunId: workflowRun.id,
    result,
  };
}

export async function getChiefOfStaffLastRunAt(tenantId: string): Promise<string | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('mcp_sessions')
    .select('created_at')
    .eq('tenant_id', tenantId)
    .eq('tool_name', 'run_chief_of_staff_routine')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at || null;
}
