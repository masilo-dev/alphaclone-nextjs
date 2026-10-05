/**
 * P0.1–P0.4 master program — social/contract/project/cron convergence tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('social publish command exists and uses domain write + SPS', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/execution/commands/socialPublishCommand.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeDomainExternalWrite/);
  assert.match(src, /getSocialPublishingService/);
  assert.match(src, /guardDomainCapability/);
});

test('UI social schedule route uses executeSocialPublishCommand', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/social/schedule/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeSocialPublishCommand/);
  assert.doesNotMatch(src, /publishLinkedInPost/);
});

test('MCP socialPublishTool uses social publish command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/socialPublishTool.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeSocialPublishCommand/);
});

test('scheduled worker uses domain social command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/social/SocialPublishingService.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeSocialPublishCommand/);
  assert.match(src, /executionSource: 'cron'/);
});

test('contract send command wraps sendContract with domain write', async () => {
  const fs = await import('node:fs');
  const cmd = fs.readFileSync(
    new URL('../../src/lib/execution/commands/contractSendCommand.ts', import.meta.url),
    'utf8'
  );
  assert.match(cmd, /sendContract/);
  assert.match(cmd, /contractSendIdempotencyKey/);
  const route = fs.readFileSync(
    new URL('../../src/app/api/contracts/management/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(route, /executeContractSendCommand/);
  const mcp = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/contracts.ts', import.meta.url),
    'utf8'
  );
  assert.match(mcp, /executeContractSendCommand/);
});

test('project create command is deal/contract idempotent', async () => {
  const { projectCreateIdempotencyKey } = await import(
    '../../src/lib/execution/commands/projectCreateCommand.ts'
  );
  const a = projectCreateIdempotencyKey({
    tenantId: 't1',
    dealId: 'deal-1',
    name: 'Anything',
  });
  const b = projectCreateIdempotencyKey({
    tenantId: 't1',
    dealId: 'deal-1',
    name: 'Different name',
  });
  assert.equal(a, b);
  assert.match(a, /deal/);
});

test('MCP create_project uses project create command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/lib/mcp/tools/projects.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeProjectCreateCommand/);
});

test('revenue lifecycle provisions projects via domain command', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/app/api/revenue-lifecycle/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /executeProjectCreateCommand/);
});

test('cron execution context declares source', async () => {
  const { buildCronExecutionContext } = await import(
    '../../src/lib/execution/cronExecutionContext.ts'
  );
  const ctx = buildCronExecutionContext({
    jobName: 'social-publish',
    tenantId: 'tenant-1',
    capability: 'publish_social_post',
  });
  assert.equal(ctx.executionSource, 'cron');
  assert.equal(ctx.skipInteractiveApproval, true);
});

test('cross-surface social idempotency key stable', async () => {
  const { socialPublishIdempotencyKey } = await import(
    '../../src/lib/execution/domainIdempotencyKeys.ts'
  );
  const a = socialPublishIdempotencyKey({
    tenantId: 't1',
    postId: 'p1',
    destinationKey: 'facebook:page-1',
  });
  const b = socialPublishIdempotencyKey({
    tenantId: 't1',
    postId: 'p1',
    destinationKey: 'facebook:page-1',
  });
  assert.equal(a, b);
});

test('tenant isolation: project keys differ by tenant', async () => {
  const { projectCreateIdempotencyKey } = await import(
    '../../src/lib/execution/commands/projectCreateCommand.ts'
  );
  const a = projectCreateIdempotencyKey({ tenantId: 'A', dealId: 'd1', name: 'X' });
  const b = projectCreateIdempotencyKey({ tenantId: 'B', dealId: 'd1', name: 'X' });
  assert.notEqual(a, b);
});

test('financial money movement still blocked from MCP auto-allow', async () => {
  const { isFinancialMoneyMovementTool } = await import('../../src/lib/ai/ToolPolicyGate.ts');
  assert.equal(isFinancialMoneyMovementTool('issue_refund'), true);
  assert.equal(isFinancialMoneyMovementTool('create_invoice'), false);
});
