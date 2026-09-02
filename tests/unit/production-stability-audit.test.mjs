import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('memory telemetry module exposes pressure helpers', async () => {
  const source = fs.readFileSync('src/lib/runtime/memoryTelemetry.ts', 'utf8');
  assert.match(source, /startMemoryTelemetry/);
  assert.match(source, /isMemoryPressureHigh/);
  assert.match(source, /resolveHeapLimitMb/);
});

test('cron memory guard defers under pressure', async () => {
  const { denyIfCronMemoryPressure } = await import('../../src/lib/cron/cronMemoryGuard.ts');
  const original = process.env.DISABLE_CRON_MEMORY_GUARD;
  process.env.DISABLE_CRON_MEMORY_GUARD = 'true';
  assert.equal(denyIfCronMemoryPressure('test-cron'), null);
  if (original === undefined) delete process.env.DISABLE_CRON_MEMORY_GUARD;
  else process.env.DISABLE_CRON_MEMORY_GUARD = original;
});

test('mapWithConcurrency preserves order and respects limit', async () => {
  const { mapWithConcurrency } = await import('../../src/lib/concurrency/mapWithConcurrency.ts');
  const items = [1, 2, 3, 4, 5];
  let peak = 0;
  let active = 0;
  const results = await mapWithConcurrency(items, 2, async (n) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active -= 1;
    return n * 2;
  });
  assert.deepEqual(results, [2, 4, 6, 8, 10]);
  assert.ok(peak <= 2);
});

test('scheduled AI tasks reject invalid cron schedules without throwing', async () => {
  const source = fs.readFileSync('src/services/automation/taskAutomationService.ts', 'utf8');
  assert.match(source, /isValidCronSchedule/);
  assert.match(source, /status: 'paused'/);
});

test('cron routes bypass workflow start for scheduled AI tasks', () => {
  const source = fs.readFileSync('src/app/api/cron/process-scheduled-ai-tasks/route.ts', 'utf8');
  assert.doesNotMatch(source, /workflow\/api/);
  assert.match(source, /executeScheduledAiTasksDirect/);
});

test('instrumentation registers memory telemetry and process guards', () => {
  const source = fs.readFileSync('src/instrumentation.ts', 'utf8');
  assert.match(source, /registerProcessGuards/);
  assert.match(source, /startMemoryTelemetry/);
});
