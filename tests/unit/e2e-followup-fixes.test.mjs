import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('E2E follow-up fixes', () => {
  it('canonicalWorkspaceStats defines closed task statuses', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/crm/canonicalWorkspaceStats.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /CLOSED_TASK_STATUSES/);
    assert.match(src, /'completed'/);
    assert.match(src, /'cancelled'/);
    assert.match(src, /isOpenTaskStatus/);
  });

  it('normalizeContractContent replaces underscore signature lines', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/contracts/normalizeContractContent.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /SIGNATURE_BLOCK_TOKEN/);
    assert.match(src, /_{3,}/);
  });

  it('legal validator allows SIGNATURE_BLOCK token', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/document-os/validators/legalConsistency.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /ALLOWED_PLACEHOLDER_TOKENS/);
    assert.match(src, /SIGNATURE_BLOCK/);
  });

  it('workflow-ops registers direct lifecycle and project email tools', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/mcp/tools/workflow-ops.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /name: 'start_contract_lifecycle'/);
    assert.match(src, /name: 'send_project_email'/);
    assert.match(src, /queueContractLifecycle/);
    assert.doesNotMatch(src, /executeToolInternal/);
  });

  it('summarize_workspace uses canonical stats', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/mcp/tools/discovery-system.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /getCanonicalWorkspaceCounts/);
    assert.match(src, /stats_source: 'canonical_workspace_stats'/);
  });

  it('crm-ops exposes identity merge tools', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/mcp/tools/crm-ops.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /find_duplicate_clients/);
    assert.match(src, /merge_client_identities/);
  });
});
