/**
 * MCP execution layer contract tests — schema parity, alias alignment, status vocabulary.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

const { resolveMcpToolName, MCP_TOOL_ALIASES } = await import(
  '../../src/lib/mcp/canonicalToolRegistry.ts'
);
const {
  publishSocialPostInputSchema,
  publishSocialPostJsonSchema,
  PUBLISH_EXECUTION_STATUS_VALUES,
  resolvePublishNow,
} = await import('../../src/lib/mcp/tools/socialPublishContract.ts');
const { coalesceArgs } = await import('../../src/lib/mcp/normalizeToolArguments.ts');
const { CANONICAL_SOCIAL_MCP_TOOLS } = await import('../../src/lib/social/types.ts');

test('publish_post alias resolves to publish_social_post', () => {
  assert.equal(resolveMcpToolName('publish_post'), 'publish_social_post');
  assert.equal(MCP_TOOL_ALIASES.publish_post, 'publish_social_post');
});

test('publish_post alias uses shared schema module (source parity)', async () => {
  const fs = await import('node:fs');
  const publishingSrc = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  const opsSrc = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-ops.ts', import.meta.url),
    'utf8'
  );
  assert.match(publishingSrc, /publishSocialPostInputSchema/);
  assert.match(publishingSrc, /name: 'publish_post'/);
  assert.match(publishingSrc, /name: 'publish_social_post'/);
  assert.doesNotMatch(opsSrc, /name: 'publish_post'/);
});

test('publish jsonSchema exposes target envelope and identity_id', () => {
  const props = publishSocialPostJsonSchema.properties;
  assert.ok(props.target, 'target envelope must be in schema');
  assert.ok(props.identity_id, 'identity_id must be in schema');
  assert.ok(props.status?.enum?.includes('execute_now'), 'execute_now must be accepted');
});

test('status vocabulary normalizes execute_now and queued to publish_now', () => {
  const executeNow = coalesceArgs({ status: 'execute_now', caption: 'hello' });
  assert.equal(executeNow.publish_now, true);

  const queued = coalesceArgs({ status: 'queued', caption: 'hello' });
  assert.equal(queued.publish_now, true);
});

test('target envelope maps to legacy flat fields', () => {
  const normalized = coalesceArgs({
    target: {
      integration: 'linkedin',
      identity_type: 'linkedin_person',
      identity_id: 'id-123',
    },
    caption: 'Post body',
  });
  assert.equal(normalized.platform, 'linkedin');
  assert.equal(normalized.identity_type, 'linkedin_person');
  assert.equal(normalized.identity_id, 'id-123');
});

test('resolvePublishNow handles canonical status values', () => {
  assert.equal(resolvePublishNow({ caption: 'x', publish_now: true }), true);
  assert.equal(resolvePublishNow({ caption: 'x', status: 'execute_now' }), true);
  assert.equal(resolvePublishNow({ caption: 'x', status: 'draft' }), false);
  assert.equal(
    resolvePublishNow({ caption: 'x', status: 'scheduled', scheduled_at: '2026-09-01T10:00:00.000Z' }),
    false
  );
});

test('publish zod accepts execute_now status', () => {
  const parsed = publishSocialPostInputSchema.parse({
    caption: 'Hello',
    status: 'execute_now',
  });
  assert.equal(parsed.status, 'execute_now');
  assert.ok(PUBLISH_EXECUTION_STATUS_VALUES.includes('execute_now'));
});

test('preflight_social_publish is in canonical social tool list', () => {
  assert.ok(CANONICAL_SOCIAL_MCP_TOOLS.includes('preflight_social_publish'));
});

test('preflight_social_publish tool is defined in social-publishing module', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/social-publishing.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /name: 'preflight_social_publish'/);
});

test('execution gateway module exports executeMcpWrite (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/executionGateway.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /export async function executeMcpWrite/);
  assert.match(src, /processNormalizedTrigger/);
});

test('TARGET_AMBIGUOUS code is defined on tenant guard', async () => {
  const { TenantIsolationError } = await import('../../src/lib/social/tenantGuard.ts');
  const err = new TenantIsolationError('ambiguous', 'TARGET_AMBIGUOUS', {
    available_identities: [],
  });
  assert.equal(err.code, 'TARGET_AMBIGUOUS');
});

test('durable social publish task module defines checkpoint pipeline (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/socialPublishDurableTask.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /enqueueSocialPublishTask/);
  assert.match(src, /executeSocialPublishDurableTask/);
  assert.match(src, /load_context.*publish_provider.*verify_receipt/s);
});

test('worker routes social.publish and email.send durable tasks (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/runtime/workerService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /task\.task_type === 'social\.publish'/);
  assert.match(src, /task\.task_type === 'email\.send'/);
  assert.match(src, /task\.task_type === 'invoice\.send'/);
  assert.match(src, /task\.task_type === 'contract\.lifecycle'/);
  assert.match(src, /task\.task_type === 'contract\.signed'/);
});

test('health deep check documents Bonnie durable runtime separately from Redis (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/app/api/health/route.ts', import.meta.url), 'utf8');
  assert.match(src, /bonnie_durable_runtime/);
  assert.match(src, /Redis is cache\/rate-limit only/);
});

test('outcome orchestrator defines governed missions including quote and deal paths (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/outcomeDefinitions.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /content_to_publish/);
  assert.match(src, /lead_to_meeting/);
  assert.match(src, /send_outreach_email/);
  assert.match(src, /meeting_to_deal/);
  assert.match(src, /quote_to_cash/);
  assert.match(src, /contract_to_project/);
  assert.match(src, /project_to_delivery/);
  assert.match(src, /preflight_social_publish/);
});

test('top write tools expose idempotency or target fields in source modules', async () => {
  const fs = await import('node:fs');
  const topWriteTools = [
    { tool: 'publish_social_post', file: '../../src/lib/mcp/tools/socialPublishContract.ts', patterns: [/identity_id/, /execute_now|publish_now/] },
    { tool: 'send_email', file: '../../src/lib/mcp/tools/email-ops.ts', patterns: [/idempotency_key/, /executeMcpWrite|enqueueEmailSendTask/] },
    { tool: 'send_invoice', file: '../../src/lib/mcp/tools/invoicing.ts', patterns: [/invoice_id/, /recipient_email/] },
    { tool: 'create_invoice', file: '../../src/lib/mcp/tools/invoicing.ts', patterns: [/client_id/, /amount/] },
    { tool: 'create_deal', file: '../../src/lib/mcp/tools/deals.ts', patterns: [/name|title/, /stage/] },
  ];
  for (const entry of topWriteTools) {
    const src = fs.readFileSync(new URL(entry.file, import.meta.url), 'utf8');
    for (const pattern of entry.patterns) {
      assert.match(src, pattern, `${entry.tool} should match ${pattern}`);
    }
  }
});

test('invoice send uses unified durable router (source)', async () => {
  const fs = await import('node:fs');
  const router = fs.readFileSync(new URL('../../src/lib/invoices/durableInvoiceRouter.ts', import.meta.url), 'utf8');
  const followUp = fs.readFileSync(new URL('../../src/lib/invoices/invoiceLifecycleFollowUp.ts', import.meta.url), 'utf8');
  const timers = fs.readFileSync(new URL('../../src/lib/bonnie/runtime/timerService.ts', import.meta.url), 'utf8');
  assert.match(router, /queueInvoiceSend/);
  assert.match(router, /isDurableRuntimeEnabled/);
  assert.match(followUp, /scheduleInvoiceLifecycleFollowUp/);
  assert.match(followUp, /handleInvoiceLifecycleTimer/);
  assert.match(timers, /invoice\.lifecycle/);
});

test('invoice entrypoints route through queueInvoiceSend (source)', async () => {
  const fs = await import('node:fs');
  for (const file of [
    '../../src/app/api/invoices/send/route.ts',
    '../../src/app/api/invoices/lifecycle/route.ts',
    '../../src/lib/mcp/tools/invoicing.ts',
    '../../src/lib/contracts/contractSignedSteps.ts',
  ]) {
    const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(src, /queueInvoiceSend/, `${file} should use queueInvoiceSend`);
  }
});

test('Bonnie workspace exposes Outcomes launcher view (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/components/dashboard/bonnie/workspace/BonnieWorkspaceViews.tsx', import.meta.url),
    'utf8'
  );
  assert.match(src, /id: 'outcomes'/);
  assert.match(src, /\/api\/bonnie\/outcomes\/execute/);
});

test('shared invoice lifecycle steps extracted for workflow and worker (source)', async () => {
  const fs = await import('node:fs');
  const steps = fs.readFileSync(
    new URL('../../src/lib/invoices/invoiceLifecycleSteps.ts', import.meta.url),
    'utf8'
  );
  const workflow = fs.readFileSync(
    new URL('../../src/workflows/invoice-lifecycle.ts', import.meta.url),
    'utf8'
  );
  assert.match(steps, /runInvoiceInitialSend/);
  assert.match(workflow, /invoiceLifecycleSteps/);
});

test('intent adapter maps publish intent to content_to_publish', async () => {
  const { adaptIntent, normalizeOutcomeParams } = await import('../../src/lib/mcp/intentAdapter.ts');
  const parsed = adaptIntent({ intent: 'Please publish this post to LinkedIn' });
  assert.equal(parsed?.outcome_key, 'content_to_publish');
  const { params, missing } = normalizeOutcomeParams(parsed.mission, {
    caption: 'Hello world',
    execute: true,
  });
  assert.deepEqual(missing, []);
  assert.equal(params.execute, true);
});

test('outcome orchestrator enqueues outcome.execute_step graph tasks (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/outcomeOrchestrator.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /taskType: 'outcome\.execute_step'/);
  assert.match(src, /createGraphTransactional/);
});

test('outcome orchestration MCP tools are registered (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/outcome-orchestration.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /name: 'request_outcome'/);
  assert.match(src, /name: 'get_outcome_status'/);
  assert.match(src, /name: 'list_supported_outcomes'/);
});

test('worker routes outcome.execute_step durable tasks (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/runtime/workerService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /task\.task_type === 'outcome\.execute_step'/);
  assert.match(src, /outcomeStepExecutor/);
});

test('analytics API exposes executionOutcomes reliability block (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/bonnie/analytics/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executionOutcomes/);
  assert.match(src, /receiptCompletenessPct/);
  assert.match(src, /targetAmbiguousFailures/);
  assert.match(src, /executionAssurance/);
});

test('execution assurance service exports reconciliation helpers (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/executionAssurance.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /buildExecutionAssuranceReport/);
  assert.match(src, /reconcileTenantExecutionReceipts/);
  assert.match(src, /reconcileAllTenantsExecutionReceipts/);
});

test('execution assurance MCP tools are registered (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/execution-assurance.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /name: 'reconcile_execution_receipts'/);
  assert.match(src, /name: 'get_execution_assurance_report'/);
});

test('Bonnie reconcile cron includes MCP receipt reconciliation (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/runtime/reconciliation/index.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /reconcileAllTenantsExecutionReceipts/);
});

test('send_email routes through durable queue when runtime enabled (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/email-ops.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /isDurableRuntimeEnabled/);
  assert.match(src, /enqueueEmailSendTask/);
  assert.match(src, /status: 'queued'/);
});

test('verification service covers durable social, email, and outcome steps (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/runtime/verificationService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /social\.publish/);
  assert.match(src, /email\.send/);
  assert.match(src, /outcome\.execute_step/);
});

test('contract lifecycle uses unified durable router (source)', async () => {
  const fs = await import('node:fs');
  const router = fs.readFileSync(new URL('../../src/lib/contracts/durableContractRouter.ts', import.meta.url), 'utf8');
  const task = fs.readFileSync(new URL('../../src/lib/contracts/contractLifecycleDurableTask.ts', import.meta.url), 'utf8');
  const steps = fs.readFileSync(new URL('../../src/lib/contracts/contractLifecycleSteps.ts', import.meta.url), 'utf8');
  assert.match(router, /queueContractLifecycle/);
  assert.match(router, /isDurableRuntimeEnabled/);
  assert.match(task, /taskType: 'contract\.lifecycle'/);
  assert.match(steps, /markContractSentForSignature/);
});

test('contract entrypoints route through queueContractLifecycle (source)', async () => {
  const fs = await import('node:fs');
  for (const file of [
    '../../src/app/api/contracts/management/route.ts',
    '../../src/workflows/deal-flows.ts',
    '../../src/workflows/deal-stage.ts',
    '../../src/services/mcp/MCPServer.ts',
  ]) {
    const src = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(src, /queueContractLifecycle/, `${file} should use queueContractLifecycle`);
  }
});

test('scheduled social publish uses durable router with engagement timer (source)', async () => {
  const fs = await import('node:fs');
  const router = fs.readFileSync(new URL('../../src/lib/social/durableSocialScheduleRouter.ts', import.meta.url), 'utf8');
  const followUp = fs.readFileSync(new URL('../../src/lib/social/socialEngagementFollowUp.ts', import.meta.url), 'utf8');
  const timers = fs.readFileSync(new URL('../../src/lib/bonnie/runtime/timerService.ts', import.meta.url), 'utf8');
  assert.match(router, /queueScheduledSocialPublish/);
  assert.match(router, /enqueueSocialPublishTask/);
  assert.match(router, /scheduleSocialEngagementCheck/);
  assert.match(followUp, /handleSocialEngagementTimer/);
  assert.match(followUp, /syncSocialPostAnalyticsForPost/);
  assert.match(timers, /social\.engagement_check/);
});

test('schedule_social_automation MCP entry routes through durable social router (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/services/mcp/MCPServer.ts', import.meta.url), 'utf8');
  assert.match(src, /queueScheduledSocialPublish/);
});

test('start_invoice_lifecycle MCP entry routes through queueInvoiceSend (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/services/mcp/MCPServer.ts', import.meta.url), 'utf8');
  assert.match(src, /queueInvoiceSend/);
  assert.doesNotMatch(src, /start\(invoiceLifecycleWorkflow/);
});

test('intent adapter maps contract and delivery intents', async () => {
  const { adaptIntent, normalizeOutcomeParams } = await import('../../src/lib/mcp/intentAdapter.ts');
  const contractIntent = adaptIntent({ intent: 'Kick off project from signed contract' });
  assert.equal(contractIntent?.outcome_key, 'contract_to_project');
  const deliveryIntent = adaptIntent({ intent: 'Complete project delivery handoff' });
  assert.equal(deliveryIntent?.outcome_key, 'project_to_delivery');
  const { params, missing } = normalizeOutcomeParams(deliveryIntent.mission, {
    project_id: '00000000-0000-4000-8000-000000000001',
    execute: true,
  });
  assert.deepEqual(missing, []);
  assert.equal(params.title, 'Complete delivery checklist');
  assert.equal(params.fields.status, 'active');
});

test('get_contracts supports contract_id filter for outcome missions (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/lib/mcp/tools/contracts.ts', import.meta.url), 'utf8');
  assert.match(src, /contract_id/);
  assert.match(src, /Contract not found/);
});

test('verification service covers contract lifecycle durable tasks (source)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/bonnie/runtime/verificationService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /contract\.lifecycle/);
  assert.match(src, /contract\.signed/);
});

test('contract signed flow uses shared steps and durable router (source)', async () => {
  const fs = await import('node:fs');
  const steps = fs.readFileSync(new URL('../../src/lib/contracts/contractSignedSteps.ts', import.meta.url), 'utf8');
  const task = fs.readFileSync(new URL('../../src/lib/contracts/contractSignedDurableTask.ts', import.meta.url), 'utf8');
  const router = fs.readFileSync(new URL('../../src/lib/contracts/durableContractSignedRouter.ts', import.meta.url), 'utf8');
  const workflow = fs.readFileSync(new URL('../../src/workflows/contract-flows.ts', import.meta.url), 'utf8');
  const events = fs.readFileSync(new URL('../../src/app/api/cron/process-events/route.ts', import.meta.url), 'utf8');
  assert.match(steps, /runContractSignedFlow/);
  assert.match(steps, /queueInvoiceSend/);
  assert.match(task, /taskType: 'contract\.signed'/);
  assert.match(router, /queueContractSigned/);
  assert.match(workflow, /runContractSignedFlow/);
  assert.match(events, /queueContractSigned/);
});
