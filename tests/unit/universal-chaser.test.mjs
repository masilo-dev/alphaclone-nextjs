import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Universal Chaser — critical repairs', () => {
  it('startChaseForTask merges existing task metadata', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/bonnie/runtime/chasingService.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /mergeChaseMetadata/);
    assert.match(src, /existingTask/);
    assert.doesNotMatch(src, /metadata:\s*\{\s*chasing:/);
  });

  it('advanceChaseAfterTimeout uses atomic transition patch for metadata', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/bonnie/runtime/chasingService.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /patch:\s*\{[\s\S]*metadata: nextMetadata/);
    assert.doesNotMatch(
      src.slice(src.indexOf('advanceChaseAfterTimeout')),
      /\.from\('agent_tasks'\)\s*\.update\(\{\s*metadata:/,
    );
  });

  it('proposal follow-up uses autoSourceKey idempotency', () => {
    const src = fs.readFileSync(
      new URL('../../src/services/commercial/proposalLifecycleEngine.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /autoSourceKey: sourceKey/);
    assert.match(src, /proposal_followup:/);
  });

  it('invoice lifecycle uses due-date-aware schedule', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/invoices/invoiceLifecycleFollowUp.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /computeInitialInvoiceLifecycleTimer/);
    assert.doesNotMatch(src, /SEVEN_DAYS_MS/);
  });
});

describe('Universal Chaser — Phase 1 foundation', () => {
  it('policy registry defines all brief policies', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/chaser/policyRegistry.ts', import.meta.url),
      'utf8',
    );
    for (const key of [
      'task_chaser',
      'invoice_chaser',
      'quote_proposal_chaser',
      'social_chaser',
    ]) {
      assert.match(src, new RegExp(`${key}:`));
    }
  });

  it('chase-ops registers MCP tools from brief', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/mcp/tools/chase-ops.ts', import.meta.url),
      'utf8',
    );
    for (const tool of [
      'list_chase_items',
      'get_chase_item',
      'start_chase',
      'run_chase_scan',
      'get_chase_brief',
      'snooze_chase',
      'stop_chase',
    ]) {
      assert.match(src, new RegExp(`name: '${tool}'`));
    }
    const registry = fs.readFileSync(
      new URL('../../src/lib/mcp/tool-registry.ts', import.meta.url),
      'utf8',
    );
    assert.match(registry, /chase-ops/);
  });

  it('chase executor and event bridge exist', () => {
    const exec = fs.readFileSync(
      new URL('../../src/lib/chaser/chaseExecutorService.ts', import.meta.url),
      'utf8',
    );
    assert.match(exec, /executeChaseInstance/);
    assert.match(exec, /approveAndExecuteChase/);
    const bridge = fs.readFileSync(
      new URL('../../src/lib/chaser/chaseEventBridge.ts', import.meta.url),
      'utf8',
    );
    assert.match(bridge, /resolveChasesForDomainEvent/);
    const reconcile = fs.readFileSync(
      new URL('../../src/lib/bonnie/runtime/reconciliation/index.ts', import.meta.url),
      'utf8',
    );
    assert.match(reconcile, /reconcileChaseScan/);
  });

  it('dashboard chase inbox routes registered', () => {
    assert.ok(fs.existsSync(new URL('../../src/app/api/dashboard/chase-inbox/route.ts', import.meta.url).pathname));
    assert.ok(fs.existsSync(new URL('../../src/app/api/dashboard/chase-brief/route.ts', import.meta.url).pathname));
  });
});

describe('invoiceLifecycleSchedule', () => {
  it('schedules upcoming phase 3 days before due date', () => {
    const src = fs.readFileSync(
      new URL('../../src/lib/invoices/invoiceLifecycleSchedule.ts', import.meta.url),
      'utf8',
    );
    assert.match(src, /phaseOffsetDays/);
    assert.match(src, /upcoming[\s\S]*return -3/);
    assert.match(src, /computeInitialInvoiceLifecycleTimer/);
  });
});
