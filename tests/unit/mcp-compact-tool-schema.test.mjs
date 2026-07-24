import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactJsonSchemaForDiscovery,
  compactMcpToolForDiscovery,
  estimateToolsListBytes,
} from '../../src/lib/mcp/compactToolSchema.ts';

test('compactJsonSchemaForDiscovery strips session fields and property descriptions', () => {
  const compact = compactJsonSchemaForDiscovery({
    type: 'object',
    description: 'should not appear on schema root in compact form',
    properties: {
      tenant_id: { type: 'string', description: 'session' },
      email: { type: 'string', description: 'a very long property description that must be removed' },
      status: {
        type: 'string',
        enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
        description: 'huge enum should drop',
      },
      tags: { type: 'array', items: { type: 'string', description: 'tag' } },
    },
    required: ['tenant_id', 'email'],
  });

  assert.equal(compact.type, 'object');
  assert.equal(compact.description, undefined);
  assert.deepEqual(Object.keys(compact.properties || {}).sort(), ['email', 'status', 'tags']);
  assert.deepEqual(compact.required, ['email']);
  assert.equal(compact.properties.email.description, undefined);
  assert.equal(compact.properties.status.enum, undefined);
  assert.deepEqual(compact.properties.tags, { type: 'array', items: { type: 'string' } });
});

test('compactMcpToolForDiscovery keeps name and truncates description', () => {
  const long = 'x'.repeat(300);
  const tool = compactMcpToolForDiscovery({
    name: 'create_lead',
    description: long,
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Lead name' } },
      required: ['name'],
    },
  });
  assert.equal(tool.name, 'create_lead');
  assert.ok(tool.description.length <= 140);
  assert.equal(tool.inputSchema.properties.name.description, undefined);
});

test('full platform list stays smaller when compacted than verbose schemas', () => {
  const verbose = Array.from({ length: 50 }, (_, i) => ({
    name: `tool_${i}`,
    description: `Verbose description for tool ${i} `.repeat(20),
    inputSchema: {
      type: 'object',
      description: 'Workspace and user are resolved from your MCP API key or OAuth session. CRM client_id is a contact UUID.',
      properties: {
        tenant_id: { type: 'string', description: 'tenant' },
        field: {
          type: 'string',
          description: 'long field help text '.repeat(30),
          enum: Array.from({ length: 40 }, (_, j) => `opt_${j}`),
        },
      },
      required: ['tenant_id', 'field'],
    },
  }));
  const compacted = verbose.map((t) => compactMcpToolForDiscovery(t));
  const verboseBytes = estimateToolsListBytes(verbose);
  const compactBytes = estimateToolsListBytes(compacted);
  assert.equal(compacted.length, verbose.length);
  assert.ok(compactBytes < verboseBytes * 0.35, `expected strong shrink ${compactBytes} vs ${verboseBytes}`);
});
