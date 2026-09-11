/**
 * Reference workflow: chase unpaid invoices until paid/disputed/escalated.
 * Builds a durable parallel per-invoice graph (planner only — no side effects).
 */

import { createSupabaseAdminClient } from '@/lib/supabase-admin';
import type { GraphDependencyInput, GraphTaskInput } from '../types';
import { createGraphTransactional } from '../graphService';
import { createRunForObjective } from '../goalRunService';
import { invoiceChaseTargetSchema } from '../schemas';
import { DEFAULT_INVOICE_CHASE_POLICY } from '../chasingService';

export async function startInvoiceCollectionRun(params: {
  tenantId: string;
  userId?: string | null;
  conversationId?: string | null;
  objective?: string;
  invoiceIds?: string[];
  limit?: number;
}) {
  const admin = createSupabaseAdminClient();
  const objective =
    params.objective ||
    'Chase all unpaid invoices until each one is paid, disputed, placed on a payment plan, or escalated.';

  // Load overdue invoices from authoritative DB (tenant-scoped)
  let invoiceQuery = admin
    .from('business_invoices')
    .select('id, client_id, status, total, currency, due_date, tenant_id')
    .eq('tenant_id', params.tenantId)
    .in('status', ['overdue', 'sent', 'partially_paid', 'draft'])
    .order('due_date', { ascending: true })
    .limit(params.limit || 25);

  if (params.invoiceIds?.length) {
    invoiceQuery = invoiceQuery.in('id', params.invoiceIds);
  }

  const { data: invoices, error } = await invoiceQuery;
  if (error) {
    console.warn('[invoiceCollection] invoice query failed:', error.message);
  }

  const targets = (invoices || [])
    .map((inv) => {
      try {
        return invoiceChaseTargetSchema.parse({
          invoiceId: inv.id,
          customerId: inv.client_id,
          amountDue: inv.total,
          currency: inv.currency,
        });
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{ invoiceId: string; customerId?: string | null }>;

  const { run, goalId } = await createRunForObjective({
    tenantId: params.tenantId,
    userId: params.userId,
    conversationId: params.conversationId,
    objective,
    successCriteria: {
      requireVerifiedOutcomes: true,
      terminalOutcomes: DEFAULT_INVOICE_CHASE_POLICY.terminalOutcomes,
      perInvoiceBranches: true,
    },
    seedGraph: false,
  });

  const tasks: GraphTaskInput[] = [
    {
      tempId: 't_discover',
      title: 'Identify overdue invoices in scope',
      taskType: 'research',
      assignedAgentId: 'finance',
      status: 'READY',
      riskLevel: 'low',
      structuredInput: {
        invoiceCount: targets.length,
        invoiceIds: targets.map((t) => t.invoiceId),
        policy: DEFAULT_INVOICE_CHASE_POLICY,
      },
      verificationCriteria: { requireInvoiceList: true },
    },
  ];

  const dependencies: GraphDependencyInput[] = [];
  const branchTemps: string[] = [];

  // Cap fan-out to protect tenant capacity
  const maxParallel = Math.min(
    targets.length || 1,
    Number(process.env.BONNIE_MAX_PARALLEL_TASKS || 20)
  );
  const branchTargets = targets.slice(0, maxParallel);

  if (!branchTargets.length) {
    tasks.push({
      tempId: 't_none',
      title: 'No overdue invoices found — complete with empty result',
      taskType: 'verify',
      assignedAgentId: 'evaluation',
      status: 'DRAFT',
      riskLevel: 'low',
      structuredInput: { empty: true },
    });
    dependencies.push({
      taskTempId: 't_none',
      dependsOnTempId: 't_discover',
      dependencyType: 'finish_to_start',
    });
  }

  for (const target of branchTargets) {
    const prefix = `inv_${target.invoiceId.replace(/-/g, '').slice(0, 12)}`;
    const analyze = `${prefix}_analyze`;
    const draft = `${prefix}_draft`;
    const approve = `${prefix}_approve`;
    const send = `${prefix}_send`;
    const verify = `${prefix}_verify`;
    const monitor = `${prefix}_monitor`;

    branchTemps.push(monitor);

    tasks.push(
      {
        tempId: analyze,
        title: `Analyse invoice ${target.invoiceId.slice(0, 8)}`,
        taskType: 'specialist',
        assignedAgentId: 'finance',
        status: 'DRAFT',
        riskLevel: 'low',
        structuredInput: { ...target, stage: 'analyze' },
      },
      {
        tempId: draft,
        title: `Draft reminder for ${target.invoiceId.slice(0, 8)}`,
        taskType: 'communicate',
        assignedAgentId: 'email',
        status: 'DRAFT',
        riskLevel: 'high',
        approvalPolicy: { required: true, reason: 'External email' },
        structuredInput: { ...target, stage: 'draft' },
      },
      {
        tempId: approve,
        title: `Approval gate ${target.invoiceId.slice(0, 8)}`,
        taskType: 'approval',
        assignedAgentId: 'compliance',
        status: 'DRAFT',
        riskLevel: 'high',
        approvalPolicy: { required: true },
        structuredInput: { ...target, stage: 'approve' },
      },
      {
        tempId: send,
        title: `Send approved reminder ${target.invoiceId.slice(0, 8)}`,
        taskType: 'communicate',
        assignedAgentId: 'email',
        status: 'DRAFT',
        riskLevel: 'high',
        idempotencyKey: `${params.tenantId}:${target.invoiceId}:email.send:1`,
        structuredInput: { ...target, stage: 'send' },
      },
      {
        tempId: verify,
        title: `Verify delivery ${target.invoiceId.slice(0, 8)}`,
        taskType: 'verify',
        assignedAgentId: 'evaluation',
        status: 'DRAFT',
        riskLevel: 'low',
        structuredInput: { ...target, stage: 'verify' },
      },
      {
        tempId: monitor,
        title: `Monitor payment/reply ${target.invoiceId.slice(0, 8)}`,
        taskType: 'monitor',
        assignedAgentId: 'monitoring',
        status: 'DRAFT',
        riskLevel: 'low',
        structuredInput: {
          ...target,
          stage: 'monitor',
          chase: DEFAULT_INVOICE_CHASE_POLICY,
        },
      }
    );

    dependencies.push(
      { taskTempId: analyze, dependsOnTempId: 't_discover', dependencyType: 'finish_to_start' },
      { taskTempId: draft, dependsOnTempId: analyze, dependencyType: 'finish_to_start' },
      { taskTempId: approve, dependsOnTempId: draft, dependencyType: 'finish_to_start' },
      { taskTempId: send, dependsOnTempId: approve, dependencyType: 'approval' },
      { taskTempId: verify, dependsOnTempId: send, dependencyType: 'succeeded' },
      { taskTempId: monitor, dependsOnTempId: verify, dependencyType: 'finish_to_start' }
    );
  }

  tasks.push({
    tempId: 't_final',
    title: 'Final goal verification and report',
    taskType: 'verify',
    assignedAgentId: 'evaluation',
    status: 'DRAFT',
    riskLevel: 'low',
    structuredInput: { finalize: true, branchCount: branchTemps.length },
    verificationCriteria: { requireFreshData: true, requireAllBranchesTerminal: true },
  });

  for (const temp of branchTemps) {
    dependencies.push({
      taskTempId: 't_final',
      dependsOnTempId: temp,
      dependencyType: 'all_completed',
    });
  }
  if (!branchTemps.length) {
    dependencies.push({
      taskTempId: 't_final',
      dependsOnTempId: 't_none',
      dependencyType: 'finish_to_start',
    });
  }

  const graph = await createGraphTransactional({
    tenantId: params.tenantId,
    runId: run.id,
    tasks,
    dependencies,
    reason: 'invoice_collection_template',
    actorType: 'planner',
    actorId: 'executive',
  });

  return {
    run,
    goalId,
    graphId: graph.graphId,
    invoiceCount: branchTargets.length,
    policy: DEFAULT_INVOICE_CHASE_POLICY,
  };
}
