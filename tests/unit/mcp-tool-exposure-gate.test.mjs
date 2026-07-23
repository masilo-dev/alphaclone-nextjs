import test from 'node:test';
import assert from 'node:assert/strict';
import { isChatgptClient, CHATGPT_CONNECTOR_TOOL_NAMES } from '../../src/lib/mcp/toolAnnotations.ts';
import { evaluateToolPolicy } from '../../src/lib/ai/ToolPolicyGate.ts';
import { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } from '../../src/lib/mcp/listAllTools.ts';

test('alphaclone-mcp-client is NOT treated as ChatGPT (fixes Claude empty tools)', () => {
  assert.equal(
    isChatgptClient({ clientId: 'alphaclone-mcp-client', clientLabel: null, userAgent: null }),
    false
  );
  assert.equal(isChatgptClient({ userAgent: 'Claude-User/1.0' }), false);
  assert.equal(isChatgptClient({ clientLabel: 'anthropic-claude' }), false);
  assert.equal(isChatgptClient({ clientId: 'cursor-ide' }), false);
});

test('ChatGPT connector clients are still detected for curated catalog', () => {
  assert.equal(isChatgptClient({ clientId: 'chatgpt-connector', userAgent: 'ChatGPT' }), true);
  assert.equal(isChatgptClient({ clientLabel: 'OpenAI Apps Connector' }), true);
  assert.ok(CHATGPT_CONNECTOR_TOOL_NAMES.length > 20);
});

test('ToolPolicyGate always allows (no pending approval queue)', async () => {
  const decision = await evaluateToolPolicy({
    tenantId: '00000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000002',
    toolName: 'send_bulk_email_campaign',
    source: 'mcp',
    args: {},
  });
  assert.equal(decision.outcome, 'allow');
  assert.match(decision.reason, /disabled|immediately/i);
});

test('unified tools/list returns non-empty full catalog for Claude-like clients', async () => {
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    sanitizeForClient: false,
    forceRefresh: true,
    clientId: 'alphaclone-mcp-client',
    clientLabel: 'claude.ai',
    userAgent: 'Claude-User',
  });
  assert.ok(tools.length > 50, `expected full catalog, got ${tools.length}`);
  const names = new Set(tools.map((t) => t.name));
  // Core tools that must remain exposed (do not delete/rename)
  for (const required of ['create_lead', 'create_post', 'search_leads', 'list_leads']) {
    assert.ok(names.has(required), `missing required tool ${required}`);
  }
});
