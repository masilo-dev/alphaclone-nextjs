/**
 * ChatGPT MCP connector end-to-end contract tests (offline / dry-run safe).
 * Simulates discovery, schema validity, permissions metadata, and execution envelopes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

const TENANT = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';

const PRIORITY_WRITE_TOOLS = [
  'send_email',
  'reply_to_email',
  'create_email_draft',
  'read_emails',
  'search_emails',
  'create_lead',
  'update_lead',
  'add_note',
  'create_task',
  'update_task',
  'create_business_event',
  'create_invoice',
  'publish_social_post',
  'schedule_social_post',
  'run_workflow',
  'create_document',
  'retrieve_document',
];

const PRIORITY_READ_TOOLS = [
  'search_leads',
  'list_email_accounts',
  'integrations_status',
  'get_platform_status',
  'list_workflows',
  'get_workflow',
  'connected_accounts',
  'get_social_posts',
];

function assertValidJsonSchema(schema) {
  assert.ok(schema && typeof schema === 'object');
  assert.equal(schema.type, 'object');
  assert.ok(schema.properties && typeof schema.properties === 'object');
}

test('ChatGPT full catalog exposes all registered executable tools', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  const { initializeRegistry, listTools } = await import('../../src/lib/mcp/tool-registry.ts');
  invalidateUnifiedMcpToolCache();
  initializeRegistry();
  const registryNames = listTools(false).map((t) => t.name);
  const tools = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
    sanitizeForClient: true,
  });
  const names = new Set(tools.map((t) => t.name));
  assert.ok(
    tools.length >= registryNames.length,
    `expected >= ${registryNames.length}, got ${tools.length}`
  );
  for (const name of registryNames) {
    assert.ok(names.has(name), `ChatGPT full catalog missing ${name}`);
  }
});

test('priority business execution tools are discoverable and registered', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  const { initializeRegistry, hasTool } = await import('../../src/lib/mcp/tool-registry.ts');
  invalidateUnifiedMcpToolCache();
  initializeRegistry();
  const tools = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  const names = new Set(tools.map((t) => t.name));

  for (const toolName of [...PRIORITY_WRITE_TOOLS, ...PRIORITY_READ_TOOLS]) {
    assert.ok(names.has(toolName), `missing priority tool in ChatGPT catalog: ${toolName}`);
  }
  for (const toolName of PRIORITY_WRITE_TOOLS) {
    assert.ok(hasTool(toolName), `priority write tool not registered: ${toolName}`);
  }
});

test('exposed tool property schemas use valid JSON Schema types', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  const validTypes = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null']);
  const invalid = [];
  for (const tool of tools) {
    const schema = tool.inputSchema || tool.jsonSchema;
    const props = schema?.properties || {};
    for (const [key, raw] of Object.entries(props)) {
      const type = raw && typeof raw === 'object' ? raw.type : undefined;
      if (typeof type === 'string' && !validTypes.has(type)) {
        invalid.push(`${tool.name}.${key}:${type}`);
      }
    }
  }
  assert.equal(invalid.length, 0, `invalid property schema types: ${invalid.slice(0, 10).join(', ')}`);
});

test('write_audit_log schema is ChatGPT-compatible', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  const tool = tools.find((t) => t.name === 'write_audit_log');
  assert.ok(tool, 'write_audit_log must be in full catalog');
  const summary = tool.inputSchema?.properties?.summary;
  assert.equal(summary?.type, 'string');
});

test('exposed tool schemas are valid JSON Schema objects', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const tools = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  const invalid = [];
  for (const tool of tools) {
    try {
      assertValidJsonSchema(tool.inputSchema || tool.jsonSchema);
    } catch {
      invalid.push(tool.name);
    }
  }
  assert.equal(invalid.length, 0, `invalid schemas: ${invalid.slice(0, 10).join(', ')}`);
});

test('run_workflow accepts workflow_id and input aliases', async () => {
  const { normalizeToolArguments } = await import('../../src/lib/mcp/normalizeToolArguments.ts');
  const args = await normalizeToolArguments(
    'run_workflow',
    {
      workflow_id: 'lead_follow_up_sequence',
      input: { lead_id: 'abc', email_subject: 'Hello' },
    },
    { tenantId: TENANT, userId: USER }
  );
  assert.equal(args.playbook_id, 'lead_follow_up_sequence');
  assert.deepEqual(args.inputs, { lead_id: 'abc', email_subject: 'Hello' });
  assert.match(String(args.idempotency_key), /^mcp-run_workflow-/);
});

test('send_email normalizes body aliases and auto idempotency', async () => {
  const { normalizeToolArguments } = await import('../../src/lib/mcp/normalizeToolArguments.ts');
  const args = await normalizeToolArguments(
    'send_email',
    { to: 'test@example.com', subject: 'Hi', body: 'Body text' },
    { tenantId: TENANT, userId: USER }
  );
  assert.equal(args.text, 'Body text');
  assert.match(String(args.idempotency_key), /^mcp-send_email-/);
});

test('structured validation errors are machine-readable (no vague Bonnie copy)', async () => {
  const { formatZodValidationError } = await import('../../src/lib/mcp/formatMcpError.ts');
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse({ email: 'not-an-email' });
  assert.equal(parsed.success, false);
  const err = formatZodValidationError('send_email', parsed.error);
  assert.equal(err.ok, false);
  assert.equal(err.error.code, 'VALIDATION_ERROR');
  assert.ok(err.error.details?.field);
  assert.match(err.error.message, /input\./);
  assert.equal(err.error.retryable, false);
  assert.doesNotMatch(err.error.message, /Ask Bonnie/);
});

test('capability metadata keeps tools visible with integration availability flags', async () => {
  const { buildToolCapabilityMeta } = await import('../../src/lib/mcp/capabilityFilter.ts');
  const meta = buildToolCapabilityMeta(
    {
      name: 'send_email',
      description: 'send email',
      inputSchema: { type: 'object', properties: {} },
    },
    { executable: true }
  );
  assert.equal(meta.read_or_write, 'write');
  assert.ok(meta.permission);
  assert.equal(typeof meta.integration_available, 'boolean');
});

test('full catalog is not silently truncated to 75 tools when cursor is zero', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  invalidateUnifiedMcpToolCache();
  const full = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'full',
    forceRefresh: true,
  });
  assert.ok(full.length >= 500, `expected full catalog >= 500, got ${full.length}`);
  const stable = await getUnifiedMcpTools({
    clientId: 'chatgpt-connector',
    catalogMode: 'stable',
    forceRefresh: true,
  });
  assert.ok(stable.length >= 50 && stable.length < full.length);
});

test('CRM email social calendar finance document workflow contract groups', async () => {
  const { invalidateUnifiedMcpToolCache, getUnifiedMcpTools } = await import(
    '../../src/lib/mcp/listAllTools.ts'
  );
  const { initializeRegistry } = await import('../../src/lib/mcp/tool-registry.ts');
  invalidateUnifiedMcpToolCache();
  initializeRegistry();
  const groups = {
    crm: ['search_leads', 'create_lead', 'update_lead', 'add_note', 'delete_lead'],
    email: ['list_email_accounts', 'read_emails', 'search_emails', 'create_email_draft', 'send_email', 'reply_to_email'],
    social: ['connected_accounts', 'publish_social_post', 'schedule_social_post', 'get_social_post', 'delete_post'],
    tasks: ['create_task', 'update_task', 'get_tasks'],
    calendar: ['events', 'create_business_event', 'tasks'],
    finance: ['invoices', 'create_invoice', 'update_invoice'],
    documents: ['create_document', 'retrieve_document', 'document_versions'],
    workflow: ['list_workflows', 'get_workflow', 'run_workflow', 'stop_workflow', 'get_workflow_run'],
  };

  const catalog = new Set(
    (
      await getUnifiedMcpTools({
        clientId: 'chatgpt-connector',
        catalogMode: 'full',
        forceRefresh: true,
      })
    ).map((t) => t.name)
  );

  for (const [group, toolNames] of Object.entries(groups)) {
    for (const name of toolNames) {
      assert.ok(catalog.has(name), `${group} contract missing ${name}`);
    }
  }
});
