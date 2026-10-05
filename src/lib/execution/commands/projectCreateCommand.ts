import { createHash } from 'node:crypto';
import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';
import {
  normalizeProjectStage,
  normalizeProjectStatus,
} from '@/lib/projects/projectEnums';

export type ProjectCreateInput = {
  name: string;
  clientId?: string | null;
  dealId?: string | null;
  contractId?: string | null;
  status?: string;
  description?: string | null;
  dueDate?: string | null;
  currentStage?: string;
  category?: string;
  ownerId?: string;
  ownerName?: string;
};

export type ProjectCreateResult = {
  project: Record<string, unknown>;
  created: boolean;
  duplicate: boolean;
};

export type ProjectCreateCommandParams = {
  tenantId: string;
  userId: string;
  input: ProjectCreateInput;
  idempotencyKey?: string;
  executionSource: PolicySource | 'api' | 'worker' | 'cron';
  skipPolicyEvaluation?: boolean;
};

function resolveSource(source: ProjectCreateCommandParams['executionSource']): PolicySource {
  if (source === 'api') return 'ui';
  if (source === 'worker') return 'cron';
  return source as PolicySource;
}

export function projectCreateIdempotencyKey(params: {
  tenantId: string;
  dealId?: string | null;
  contractId?: string | null;
  name: string;
  clientId?: string | null;
}): string {
  if (params.dealId) return `project-create:deal:${params.tenantId}:${params.dealId}`;
  if (params.contractId) return `project-create:contract:${params.tenantId}:${params.contractId}`;
  const hash = createHash('sha256')
    .update([params.name.trim().toLowerCase(), params.clientId || ''].join('|'))
    .digest('hex')
    .slice(0, 24);
  return `project-create:${params.tenantId}:${hash}`;
}

export async function executeProjectCreateCommand(
  params: ProjectCreateCommandParams
): Promise<DomainExecutionResult<ProjectCreateResult>> {
  const executionSource = resolveSource(params.executionSource);
  const idempotencyKey =
    params.idempotencyKey?.trim() ||
    projectCreateIdempotencyKey({
      tenantId: params.tenantId,
      dealId: params.input.dealId,
      contractId: params.input.contractId,
      name: params.input.name,
      clientId: params.input.clientId,
    });

  const guard = await guardDomainCapability({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'create_project',
    executionSource,
    args: {
      name: params.input.name,
      client_id: params.input.clientId,
      deal_id: params.input.dealId,
    },
    idempotencyKey,
    skipPolicyEvaluation: params.skipPolicyEvaluation,
  });

  if (!guard.allowed) {
    return {
      execution_id: '',
      status: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      verification_state: guard.body.code === 'APPROVAL_REQUIRED' ? 'QUEUED' : 'FAILED',
      idempotency_key: idempotencyKey,
      execution_source: String(executionSource),
      ok: false,
      failure_code: guard.body.code,
      error: { code: guard.body.code as 'POLICY_BLOCKED', message: guard.body.error },
    };
  }

  const admin = createSupabaseAdminClient();
  const gateway = await executeDomainExternalWrite({
    tenantId: params.tenantId,
    userId: params.userId,
    capability: 'create_project',
    action: 'project.create',
    mode: 'execute_now',
    executionSource,
    idempotencyKey,
    target: {
      workspace_id: params.tenantId,
      resource_type: 'project',
      resource_id: params.input.dealId || params.input.contractId || null,
    },
    payload: {
      name: params.input.name,
      dealId: params.input.dealId,
      contractId: params.input.contractId,
      clientId: params.input.clientId,
    },
    execute: async (): Promise<ProjectCreateResult> => {
      // Deal-won / lifecycle: one project per deal.
      if (params.input.dealId) {
        const { data: existingByDeal } = await admin
          .from('projects')
          .select('*')
          .eq('tenant_id', params.tenantId)
          .eq('deal_id', params.input.dealId)
          .maybeSingle();
        if (existingByDeal) {
          return { project: existingByDeal, created: false, duplicate: true };
        }
      }

      if (params.input.contractId) {
        const { data: existingByContract } = await admin
          .from('projects')
          .select('*')
          .eq('tenant_id', params.tenantId)
          .eq('contract_id', params.input.contractId)
          .maybeSingle();
        if (existingByContract) {
          return { project: existingByContract, created: false, duplicate: true };
        }
      }

      const status = normalizeProjectStatus(params.input.status || 'Pending') || 'Pending';
      const currentStage = normalizeProjectStage(params.input.currentStage || 'Discovery') || 'Discovery';
      const ownerId = params.input.ownerId || params.userId;

      const row: Record<string, unknown> = {
        tenant_id: params.tenantId,
        owner_id: ownerId,
        owner_name: params.input.ownerName || 'Workspace member',
        name: params.input.name,
        category: params.input.category || 'General',
        status,
        current_stage: currentStage,
        progress: 0,
        description: params.input.description || null,
        due_date: params.input.dueDate ? String(params.input.dueDate).slice(0, 10) : null,
        client_id: params.input.clientId || null,
        deal_id: params.input.dealId || null,
        contract_id: params.input.contractId || null,
        team: [],
        resources: [],
        is_public: false,
        show_in_portfolio: false,
        portal_enabled: false,
        auto_invoice_enabled: false,
        contract_status: 'None',
        budget_used: 0,
      };

      let { data: project, error } = await admin.from('projects').insert(row).select('*').single();
      if (error && /deal_id|contract_id|schema cache|PGRST204/i.test(error.message)) {
        delete row.deal_id;
        delete row.contract_id;
        const retry = await admin.from('projects').insert(row).select('*').single();
        project = retry.data;
        error = retry.error;
      }
      if (error) throw error;
      if (!project) throw new Error('Project create returned no row');
      return { project, created: true, duplicate: false };
    },
    isSuccess: (r) => Boolean(r.project?.id),
    buildReceipt: (r) => ({
      action_id: '',
      status: 'verified',
      timestamp: new Date().toISOString(),
      entity_type: 'project',
      entity_id: String(r.project.id),
    }),
  });

  return domainResultFromGateway({
    executionSource: String(executionSource),
    gateway,
    businessObject: {
      type: 'project',
      id: gateway.result?.project ? String(gateway.result.project.id) : undefined,
    },
    approvalState: guard.policy?.approvalState,
  });
}
