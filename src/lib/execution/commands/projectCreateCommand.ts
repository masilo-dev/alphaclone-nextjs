import { createHash } from 'node:crypto';
import { resolveCanonicalLifecycleClient } from '@/lib/crm/resolveCanonicalLifecycleClient';
import type { PolicySource } from '@/lib/ai/ToolPolicyGate';
import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import { executeDomainExternalWrite } from '@/lib/execution/domainExternalWrite';
import { guardDomainCapability } from '@/lib/execution/domainCapabilityGuard';
import { domainResultFromGateway, type DomainExecutionResult } from '@/lib/execution/domainExecutionResult';
import {
  normalizeProjectStage,
  normalizeProjectStatus,
  toCanonicalProjectStage,
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
  templateId?: string;
  projectType?: string;
  progressMethod?: 'task_based' | 'weighted_tasks' | 'milestones' | 'manual';
  extras?: Record<string, unknown>;
  isTestData?: boolean;
  historicalImport?: boolean;
  executionAuthorized?: boolean;
};

export type ProjectCreateResult = {
  project: Record<string, unknown>;
  created: boolean;
  duplicate: boolean;
  templateApplication?: unknown;
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
    execute: async (executionContext): Promise<ProjectCreateResult> => {
      const clientId = params.input.clientId ? await resolveCanonicalLifecycleClient(admin, params.tenantId, params.input.clientId) : null;
      const status = normalizeProjectStatus(params.input.status || 'Pending');
      if (!status) throw Object.assign(new Error('input.status is not a supported project status'), {code: 'VALIDATION_ERROR'});
      const currentStage = toCanonicalProjectStage(params.input.currentStage || 'Initiation');
      const ownerId = params.input.ownerId || params.userId;

      const portalEnabled = params.input.extras?.portal_enabled !== undefined
        ? Boolean(params.input.extras.portal_enabled)
        : Boolean(clientId);
      const isPublic = params.input.extras?.is_public !== undefined
        ? Boolean(params.input.extras.is_public)
        : Boolean(clientId);
      const clientVisible = params.input.extras?.client_visible !== undefined
        ? Boolean(params.input.extras.client_visible)
        : portalEnabled;

      const row: Record<string, unknown> = {
        ...params.input.extras,
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
        client_id: clientId,
        deal_id: params.input.dealId || null,
        contract_id: params.input.contractId || null,
        team: params.input.extras?.team || [],
        resources: params.input.extras?.resources || [],
        is_public: isPublic,
        show_in_portfolio: Boolean(params.input.extras?.show_in_portfolio),
        portal_enabled: portalEnabled,
        portal_token: portalEnabled ? globalThis.crypto.randomUUID() : null,
        auto_invoice_enabled: false,
        contract_status: 'None',
        budget_used: 0,
        project_type: params.input.projectType || null,
        progress_method: params.input.progressMethod || 'weighted_tasks',
        metadata: {
          creation_idempotency_key: idempotencyKey,
          is_test_data: Boolean(params.input.isTestData),
          historical_import: Boolean(params.input.historicalImport),
          execution_authorized: Boolean(params.input.executionAuthorized),
          client_visible: clientVisible,
        },
      };

      let templateId=params.input.templateId;
      if(!templateId && params.input.projectType) {
        const templateKey=params.input.projectType==='website'?'website-development':params.input.projectType;
        const template=await admin.from('project_templates').select('id').eq('tenant_id',params.tenantId).eq('template_key',templateKey).eq('is_active',true).maybeSingle();
        if(template.error)throw template.error;
        if(!template.data)throw new Error('No active project template is configured for this project type');
        templateId=template.data.id;
      }
      const {data, error} = await admin.rpc('create_project_lifecycle', {
        p_tenant_id: params.tenantId, p_row: row, p_key: idempotencyKey,
        p_template_id: templateId || null, p_actor: params.userId || null,
      });
      if (error) {
        console.error('[project.create] database failure', {correlationId: executionContext.correlationId, code: error.code, message: error.message});
        throw Object.assign(new Error(`Project lifecycle persistence failed: ${error.message}`), {code: 'PROJECT_PERSISTENCE_FAILED'});
      }
      if (!data?.project?.id) throw new Error('Project create returned no persisted row');
      return data as ProjectCreateResult;
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
