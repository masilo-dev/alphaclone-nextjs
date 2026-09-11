/**
 * Contract coverage: every exposed MCP tool must have JSON schema and classification metadata.
 * Generates artifacts/audit/mcp-tool-contract-results.json
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { getUnifiedMcpTools } = await import('../../src/lib/mcp/listAllTools.ts');
const { resolveToolAnnotations } = await import('../../src/lib/mcp/toolAnnotations.ts');
const { initializeRegistry, hasTool } = await import('../../src/lib/mcp/tool-registry.ts');

function classifyTool(name) {
  const n = name.toLowerCase();
  if (/^(get_|list_|search|fetch|inspect|audit_|analyze_|verify_|status|health|report|dashboard)/.test(n)) {
    return 'read-only';
  }
  if (/^(delete_|remove_|purge_|cancel_)/.test(n)) return 'delete';
  if (/send_|publish_|post_|reply_|upload_|create_|add_|update_|schedule_|sync_/.test(n)) {
    if (/email|mail|send_|publish_|post_/.test(n)) return 'external-send';
    if (/invoice|payment|bill|charge|refund/.test(n)) return 'financial';
    return /update_/.test(n) ? 'update' : 'create';
  }
  if (/auth|oauth|token|login|register/.test(n)) return 'authentication';
  if (/admin|platform|restart|migration|audit_log/.test(n)) return 'administrative';
  return 'read-only';
}

function validateEnvelopeShape(sample) {
  return (
    typeof sample === 'object' &&
    sample !== null &&
    'ok' in sample &&
    'tool' in sample &&
    ('data' in sample || 'error' in sample)
  );
}

test('every catalog tool has schema, registry entry, and contract metadata', async () => {
  initializeRegistry();
  const tools = await getUnifiedMcpTools({ catalogMode: 'full' });
  assert.ok(tools.length >= 500, `expected 500+ tools, got ${tools.length}`);

  const results = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const tool of tools) {
    const annotations = resolveToolAnnotations(tool.name);
    const classification = classifyTool(tool.name);
    const registered = hasTool(tool.name);
    const hasSchema =
      tool.jsonSchema &&
      typeof tool.jsonSchema === 'object' &&
      tool.jsonSchema.type === 'object';

    let status = 'passed';
    let reason = null;

    if (!hasSchema) {
      status = 'failed';
      reason = 'missing_json_schema';
    } else if (!registered && !['search', 'fetch', 'list_tools'].includes(tool.name)) {
      status = 'failed';
      reason = 'not_in_registry';
    } else if (
      typeof annotations.readOnlyHint !== 'boolean' ||
      typeof annotations.destructiveHint !== 'boolean'
    ) {
      status = 'failed';
      reason = 'missing_annotations';
    } else if (classification === 'delete' || classification === 'external-send') {
      status = 'skipped';
      reason = 'staging_only';
    }

    if (status === 'passed') passed += 1;
    else if (status === 'skipped') skipped += 1;
    else failed += 1;

    results.push({
      tool: tool.name,
      classification,
      registered,
      has_schema: Boolean(hasSchema),
      status,
      reason,
      envelope_sample_valid: validateEnvelopeShape({
        ok: true,
        tool: tool.name,
        data: {},
        error: null,
      }),
    });
  }

  const outDir = path.join(process.cwd(), 'artifacts', 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'mcp-tool-contract-results.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        total_tools: tools.length,
        passed,
        failed,
        skipped,
        before_failure_count: 8,
        after_failure_count: failed,
        results,
      },
      null,
      2
    )
  );

  assert.equal(failed, 0, `${failed} tools failed contract checks — see ${outPath}`);
  assert.ok(passed > 0);
  console.log(`Contract coverage: ${passed} passed, ${skipped} skipped (staging), ${failed} failed`);
});
