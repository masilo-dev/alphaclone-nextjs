import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { classifyMcpToolTier, mcpToolRequiresApproval } from '../../src/lib/mcp/toolRiskTiers.ts';

function fixture(mode = 'autonomous') {
  let inserts = 0;
  const query = {
    select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: { high_risk_approval_required: true } }; },
    insert() { inserts++; return this; },
    async single() { return { data: { id: 'queued' } }; },
  };
  const dependencies = {
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => ({ from: () => query }) },
    '@/services/mcp/mcpStore': { mcpStore: { getBusinessAIState: async () => ({ agent_mode: mode }) } },
    '@/lib/ai/resolveEffectiveAgentMode': { resolveEffectiveAgentMode: () => mode },
    '@/services/mcp/businessAIState': { evaluateBusinessAIState: () => ({ recommended_mode: 'act_with_approval', readiness_score: 79, reasons: ['Human review'] }) },
    '@/lib/mcp/toolRiskTiers': { classifyMcpToolTier, mcpToolRequiresApproval },
  };
  const source = fs.readFileSync(new URL('../../src/lib/ai/ToolPolicyGate.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name], console });
  return { evaluate: (source, toolName, args = {}) => exports.evaluateToolPolicy({ tenantId: 'tenant', userId: 'owner', source, toolName, args }), inserts: () => inserts };
}

test('manual delivery supplies approval independently of agent readiness and mode', async () => {
  for (const mode of ['observe', 'draft', 'act_with_approval', 'autonomous']) {
    const f = fixture(mode);
    for (const tool of ['send_email', 'reply_to_email', 'send_contract', 'send_quote', 'send_invoice']) {
      const decision = await f.evaluate('ui', tool);
      assert.equal(decision.outcome, 'allow', `${mode}: ${tool}`);
      assert.equal(decision.approvalState, 'approved');
      assert.equal(decision.sourcePolicy, 'manual_user_approval');
    }
    assert.equal(f.inserts(), 0);
  }
});

test('manual delivery exception does not authorize bulk, signing or money movement', async () => {
  const f = fixture();
  for (const tool of ['send_bulk_email', 'sign_contract', 'transfer_funds', 'record_payment']) {
    assert.equal((await f.evaluate('ui', tool)).outcome, 'queue_approval', tool);
  }
  assert.equal(f.inserts(), 4);
});

test('cron, playbook and Bonnie sends still queue even with caller-supplied approval flags', async () => {
  const f = fixture();
  for (const source of ['cron', 'playbook', 'bonnie']) {
    for (const tool of ['send_email', 'send_invoice', 'send_contract']) {
      assert.equal((await f.evaluate(source, tool, { source: 'ui', approved: true })).outcome, 'queue_approval');
    }
  }
  assert.equal(f.inserts(), 9);
});

test('authenticated MCP commands execute without a second approval in every agent mode', async () => {
  for (const mode of ['observe', 'draft', 'act_with_approval', 'autonomous']) {
    const f = fixture(mode);
    for (const tool of ['send_email', 'send_invoice', 'send_contract', 'send_bulk_email', 'publish_social_post', 'sign_contract', 'transfer_funds']) {
      const decision = await f.evaluate('mcp', tool);
      assert.equal(decision.outcome, 'allow', `${mode}: ${tool}`);
      assert.equal(decision.approvalState, 'approved');
      assert.equal(decision.policyAttributes.human_approval_source, 'authenticated_mcp_command');
    }
    assert.equal(f.inserts(), 0);
  }
});
