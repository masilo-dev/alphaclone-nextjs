import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeToolSchemaForClient, mergeSessionArgs } from '../../src/lib/mcp/sanitizeToolSchema.ts';
import { compactJsonSchemaForDiscovery } from '../../src/lib/mcp/compactToolSchema.ts';
import { MCP_TOOLS } from '../../src/services/mcp/toolManifest.ts';
import { ensureMcpIdempotencyKey } from '../../src/lib/mcp/toolRiskTiers.ts';

test('discovery keeps retry keys and requirements while hiding session identity', () => {
  const schema = {
    type: 'object',
    properties: {
      tenant_id: { type: 'string' },
      user_id: { type: 'string' },
      idempotency_key: { type: 'string' },
      idempotencyKey: { type: 'string' },
      subject: { type: 'string' },
    },
    required: ['tenant_id', 'user_id', 'idempotency_key', 'subject'],
  };
  const sanitized = sanitizeToolSchemaForClient(schema);
  for (const discovered of [sanitized, compactJsonSchemaForDiscovery(sanitized)]) {
    assert.equal(discovered.properties.tenant_id, undefined);
    assert.equal(discovered.properties.user_id, undefined);
    assert.equal(discovered.properties.idempotency_key.type, 'string');
    assert.equal(discovered.properties.idempotencyKey.type, 'string');
    assert.deepEqual(discovered.required, ['idempotency_key', 'subject']);
  }
  assert.equal(schema.properties.tenant_id.type, 'string');
});

test('batch outreach exposes retry and review controls through both discovery passes', () => {
  const tool = MCP_TOOLS.find((tool) => tool.name === 'send_batch_outreach');
  const schema = compactJsonSchemaForDiscovery(sanitizeToolSchemaForClient(tool.inputSchema));
  assert.equal(schema.properties.idempotency_key.type, 'string');
  assert.equal(schema.properties.dry_run.type, 'boolean');
  assert.equal(schema.properties.final_confirmation.type, 'boolean');
});

test('session binding preserves the exact client retry key', () => {
  const args = { tenant_id: 'wrong', user_id: 'wrong', idempotency_key: 'campaign-60-v1' };
  const merged = mergeSessionArgs(args, { tenantId: 'tenant', userId: 'user' });
  assert.equal(merged.idempotency_key, args.idempotency_key);
  assert.equal(merged.tenant_id, 'tenant');
  assert.equal(merged.user_id, 'user');
  assert.equal(args.tenant_id, 'wrong');
});

test('domain-required internal writes retain supplied keys and derive stable retry keys', () => {
  for (const toolName of ['create_project', 'create_invoice', 'create_contract', 'promote_lead_candidate']) {
    const args = { name: 'Example' };
    const key = ensureMcpIdempotencyKey({ tenantId: 'tenant', toolName, args, requireKey: true });
    assert.ok(key);
    assert.equal(args.idempotency_key, key);
    assert.equal(ensureMcpIdempotencyKey({ tenantId: 'tenant', toolName, args: { name: 'Example' }, requireKey: true }), key);
    const supplied = { idempotency_key: 'client-retry-key' };
    assert.equal(ensureMcpIdempotencyKey({ tenantId: 'tenant', toolName, args: supplied, requireKey: true }), 'client-retry-key');
  }
  assert.equal(ensureMcpIdempotencyKey({ tenantId: 'tenant', toolName: 'list_leads', args: {} }), null);
});
