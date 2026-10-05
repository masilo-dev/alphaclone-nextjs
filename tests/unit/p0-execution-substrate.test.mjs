/**
 * P0 structural execution substrate — policy chain, guard, lead promotion, ticket routing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

test('ToolPolicyGate evaluates MCP through full chain with explicit auto-allow attribute', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/lib/ai/ToolPolicyGate.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /if \(source === 'mcp'\) \{\s*return \{\s*outcome: 'allow'/s);
  assert.match(src, /mcp_connector_auto_allow/);
  assert.match(src, /mcpHighRiskQueue/);
});

test('executeTool routes through toolExecutionGuard before handlers', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/lib/mcp/tool-registry.ts', import.meta.url), 'utf8');
  assert.match(src, /guardToolExecution/);
  assert.match(src, /enrichMcpResultWithExecutionTruth/);
});

test('MCP route removed inline ticket SQL bypass', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/app/api/mcp/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /Handle ticketing tools directly/);
  assert.doesNotMatch(src, /if \(toolName === 'create_ticket'\)/);
  assert.match(src, /executionSource: 'mcp'/);
});

test('tickets-ops uses tickets table and executeMcpWrite for writes', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/lib/mcp/tools/tickets-ops.ts', import.meta.url), 'utf8');
  assert.match(src, /\.from\('tickets'\)/);
  assert.match(src, /executeMcpWrite/);
  assert.doesNotMatch(src, /support_tickets/);
});

test('canonical lead promotion service is single handoff module', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(
    new URL('../../src/services/leads/canonicalLeadPromotion.ts', import.meta.url),
    'utf8'
  );
  assert.match(src, /promoteToCanonicalLead/);
  assert.match(src, /executeMcpWrite/);
  assert.match(src, /canonical_business_key/);
  const review = fs.readFileSync(
    new URL('../../src/app/api/leads/candidates/[id]/review/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(review, /promoteToCanonicalLead/);
  assert.doesNotMatch(review, /toLeadInsertFromCandidate/);
});

test('execution states include UNKNOWN_EXECUTION_STATE', async () => {
  const { normalizeExecutionState, EXECUTION_STATES } = await import(
    '../../src/lib/execution/executionStates.ts'
  );
  assert.ok(EXECUTION_STATES.includes('UNKNOWN_EXECUTION_STATE'));
  assert.equal(normalizeExecutionState('outcome_unknown'), 'UNKNOWN_EXECUTION_STATE');
  assert.equal(normalizeExecutionState('unknown_execution_state'), 'UNKNOWN_EXECUTION_STATE');
});

test('LLM truthful response blocks completion claims unless verified', async () => {
  const { buildLlmExecutionTruth } = await import('../../src/lib/mcp/llmTruthfulResponse.ts');
  const truth = buildLlmExecutionTruth({
    toolName: 'send_email',
    parsedResult: { receipt: { status: 'queued', action_id: 'a1' } },
  });
  assert.equal(truth.may_claim_completed, false);
  assert.match(truth.user_message, /Do not tell the user/i);
});
