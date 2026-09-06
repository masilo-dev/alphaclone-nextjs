/**
 * Regression: manifest-bridge tools used to route MCPServer.executeToolInternal
 * -> tool-registry -> manifest-bridge handler -> MCPServer.executeToolInternal
 * forever (get_business_snapshot), exhausting the 4 GB heap every cron tick.
 *
 * The guard has two halves, both asserted here:
 *   1. tool-registry records which module registered each tool so callers can
 *      tell a bridged tool apart from a dedicated handler.
 *   2. MCPServer skips the registry for bridged tools, and the bridge passes
 *      `skipRegistry: true` when it calls back into the legacy switch.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.resolve(here, rel), 'utf8');

describe('manifest-bridge <-> MCPServer recursion guard', () => {
  it('tool-registry tracks the registering module and exposes isBridgedTool', async () => {
    const registry = await import('../../src/lib/mcp/tool-registry.ts');
    const { initializeRegistry, hasTool, isBridgedTool, getToolModule, MANIFEST_BRIDGE_MODULE } = registry;

    assert.equal(typeof isBridgedTool, 'function');
    assert.equal(typeof getToolModule, 'function');
    assert.equal(MANIFEST_BRIDGE_MODULE, 'manifest-bridge');

    initializeRegistry();

    // The tool that triggered the production crash loop.
    assert.equal(hasTool('get_business_snapshot'), true, 'get_business_snapshot must stay registered');
    assert.equal(
      isBridgedTool('get_business_snapshot'),
      true,
      'get_business_snapshot has no dedicated handler and must be flagged as bridged',
    );
    assert.equal(getToolModule('get_business_snapshot'), MANIFEST_BRIDGE_MODULE);

    // Dedicated handlers must NOT be flagged as bridged, otherwise they would
    // fall through to the legacy switch and lose their typed implementation.
    assert.equal(hasTool('get_clients'), true);
    assert.equal(isBridgedTool('get_clients'), false);
    assert.notEqual(getToolModule('get_clients'), MANIFEST_BRIDGE_MODULE);

    // Unknown tools are never "bridged".
    assert.equal(isBridgedTool('definitely_not_a_tool'), false);
    assert.equal(getToolModule('definitely_not_a_tool'), undefined);
  });

  it('MCPServer refuses to route bridged tools back through the registry', () => {
    const source = read('../../src/services/mcp/MCPServer.ts');
    assert.match(source, /skipRegistry\?: boolean/, 'executeToolInternal must accept skipRegistry');
    assert.match(
      source,
      /!options\?\.skipRegistry\s*&&\s*hasTool\(name\)\s*&&\s*!isBridgedTool\(name\)/,
      'registry routing must be gated on skipRegistry and isBridgedTool',
    );
  });

  it('manifest-bridge registers under MANIFEST_BRIDGE_MODULE and passes skipRegistry when calling back', () => {
    const source = read('../../src/lib/mcp/tools/manifest-bridge.ts');
    assert.match(source, /registerTool\(MANIFEST_BRIDGE_MODULE,/);
    assert.match(source, /\{\s*skipRegistry:\s*true\s*\}/);
  });
});
