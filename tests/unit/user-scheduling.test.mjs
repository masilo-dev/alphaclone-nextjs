import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { resolveScheduleTime, nextCronRun, parseCron } from '../../src/lib/scheduling/scheduleTime.ts';
import crypto from 'node:crypto';
import { sequenceEnrollmentIdentity } from '../../src/lib/scheduling/sequenceSchedule.ts';
import { classifyMcpToolTier, deriveStableMcpIdempotencyKey } from '../../src/lib/mcp/toolRiskTiers.ts';

const now = new Date('2026-10-13T06:00:00Z');
test('user-selected local time is preserved in the supplied zone', () => {
  assert.equal(resolveScheduleTime('2026-10-14T14:37:00', 'Europe/Zurich', now), '2026-10-14T12:37:00.000Z');
  assert.equal(resolveScheduleTime('2026-10-14T14:37:00', 'Africa/Harare', now), '2026-10-14T12:37:00.000Z');
  assert.equal(resolveScheduleTime('2026-12-14T14:37:00', 'Europe/Zurich', now), '2026-12-14T13:37:00.000Z');
  assert.equal(resolveScheduleTime('2026-10-14T14:37:00-04:00', undefined, now), '2026-10-14T18:37:00.000Z');
});
test('missing timezone, past date, invalid zone and daylight-saving ambiguity are rejected', () => {
  assert.throws(() => resolveScheduleTime('2026-10-14T14:37:00', undefined, now), /timezone/);
  assert.throws(() => resolveScheduleTime('2026-10-12T14:37:00Z', undefined, now), /future/);
  assert.throws(() => resolveScheduleTime('2026-10-14T14:37:00', 'invented/zone', now), /timezone/);
  assert.throws(() => resolveScheduleTime('2027-03-28T02:30:00', 'Europe/Zurich', now), /does not exist/);
  assert.throws(() => resolveScheduleTime('2026-10-25T02:30:00', 'Europe/Zurich', now), /occurs twice/);
  assert.equal(resolveScheduleTime('2026-10-25T02:30:00+01:00', 'Europe/Zurich', now), '2026-10-25T01:30:00.000Z');
});
test('recurring clock times use the chosen timezone and support user intervals', () => {
  assert.equal(nextCronRun('37 14 * * *', 'Europe/Zurich', now).toISOString(), '2026-10-13T12:37:00.000Z');
  assert.equal(nextCronRun('*/17 9-17 * * 1-5', 'Europe/Zurich', new Date('2026-10-13T07:18:00Z')).toISOString(), '2026-10-13T07:34:00.000Z');
  assert.equal(nextCronRun('30 9 * * *', 'Europe/Zurich', new Date('2026-10-24T08:00:00Z')).toISOString(), '2026-10-25T08:30:00.000Z');
  assert.throws(() => parseCron('99 24 * * *'));
  assert.throws(() => parseCron('*/0 * * * *'));
});
function load(dependencies) {
  const source = fs.readFileSync(new URL('../../src/lib/scheduling/scheduledActions.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => dependencies[name], console, Date });
  return exports;
}
function fixture(jobs = []) {
  const rows = [], updates = [], executions = [];
  let member = true;
  const db = { async rpc() { return { data: jobs.splice(0), error: null }; }, from(table) {
    let payload, updating = false;
    const query = { select() { return this; }, eq() { return this; },
      upsert(value) { payload = value; return this; },
      update(value) { payload = value; updating = true; return this; },
      async maybeSingle() {
        if (table === 'tenant_users') return { data: member ? { user_id: 'user' } : null };
        if (table === 'email_sequence_enrollments') return { data: { status: 'active' } };
        if (payload && !updating) { const existing = rows.find(r => r.idempotency_key === payload.idempotency_key); if (existing) return { data: null }; const row = { id: 'job-' + rows.length, status: 'scheduled', ...payload }; rows.push(row); return { data: row }; }
        return { data: rows[0] };
      }, async single() { return { data: rows[0] }; },
      then(resolve) { updates.push({ table, payload }); return Promise.resolve({ error: null }).then(resolve); },
    }; return query;
  } };
  const module = load({
    '@/lib/mcp/connector/permissions': { assertPermission: async () => ({}) },
    '@/lib/media/ingestMedia': { ingestMediaInput: async ({ media }) => ({ id: 'asset-frozen', url: 'https://media.example.invalid/asset-frozen' }) },
    '@/lib/email/resolveMcpEmailRecipient': { resolveMcpEmailRecipient: async (db, tenantId, args) => ({ email: args.to }) },
    '@/lib/supabase-admin': { createSupabaseAdminClient: () => db },
    '@/lib/mcp/toolRiskTiers': { classifyMcpToolTier, deriveStableMcpIdempotencyKey },
    './scheduleTime': { resolveScheduleTime, nextCronRun, parseCron, validateTimezone: x => x },
    '@/lib/mcp/normalizeToolArguments': { normalizeToolArguments: async (tool, args) => args },
    '@/lib/mcp/tool-registry': { getTool: () => ({ inputSchema: { parse: args => args } }), executeTool: async (...args) => { executions.push(args); return { content: [{ text: JSON.stringify({ ok: true, data: { status: 'provider_accepted' } }) }] }; } },
  });
  return { ...module, rows, updates, executions, revoke() { member = false; } };
}
test('scheduling freezes exact payload, respects chosen time and replays without duplicate jobs', async () => {
  const f = fixture();
  const input = { tenantId: 'tenant', userId: 'user', toolName: 'send_email', args: { to: 'owner@example.com', message: 'Exact content', attachments: [{ asset_id: 'asset' }] }, scheduledAt: '2030-01-02T15:43:00+02:00' };
  const first = await f.scheduleAction(input), replay = await f.scheduleAction(input);
  assert.equal(first.id, replay.id); assert.equal(f.rows.length, 1); assert.equal(f.executions.length, 0);
  assert.equal(first.scheduled_at, '2030-01-02T13:43:00.000Z');
  assert.equal(first.args.message, 'Exact content'); assert.equal(first.args.attachments[0].asset_id, 'asset');
  assert.equal(first.args.tenant_id, 'tenant'); assert.equal(first.args.user_id, 'user');
  assert.equal(f.scheduledActionResponse(first).execution_truth.may_claim_completed, false);
});
test('due worker uses stored approval and stable occurrence identity without approval requeue', async () => {
  const job = { id: 'job', tenant_id: 'tenant', user_id: 'user', tool_name: 'send_invoice', args: { invoice_id: 'invoice', recipients: ['owner@example.com'] }, approved_at: '2026-10-13T06:00:00Z', scheduled_at: '2026-10-13T06:10:00Z', idempotency_key: 'stable', metadata: {} };
  const f = fixture([job]);
  await f.runDueScheduledActions(); await f.runDueScheduledActions();
  assert.equal(f.executions.length, 1);
  assert.equal(f.executions[0][3].idempotency_key, 'stable:2026-10-13T06:10:00Z');
  assert.equal(f.executions[0][4].executionSource, 'cron'); assert.equal(f.executions[0][4].skipPolicyEvaluation, true);
  assert.equal(f.updates[0].payload.status, 'provider_accepted');
});
test('revoked membership cannot execute a stored schedule', async () => {
  const f = fixture([{ id: 'job', tenant_id: 'tenant', user_id: 'user', tool_name: 'send_email', approved_at: 'now', args: {}, metadata: {} }]);
  f.revoke(); await f.runDueScheduledActions(); assert.equal(f.executions.length, 0);
});
test('uncertain provider outcomes never become completed', () => {
  const f = fixture();
  assert.equal(f.executionOutcome({ content: [{ text: JSON.stringify({ execution_truth: { status: 'UNKNOWN_EXECUTION_STATE' } }) }] }).status, 'unknown');
  assert.equal(f.executionOutcome({ content: [{ text: JSON.stringify({ ok: true }) }] }).status, 'provider_accepted');
  assert.equal(f.executionOutcome({ content: [{ text: JSON.stringify({ ok: false, error: 'Failed' }) }] }).status, 'failed');
});
test('invalid calendar dates cannot silently roll into another day', () => {
  assert.throws(() => resolveScheduleTime('2027-02-30T12:00:00Z', undefined, now), /calendar/);
  assert.throws(() => resolveScheduleTime('2026-10-14T25:00:00Z', undefined, now), /calendar/);
  assert.equal(resolveScheduleTime('2026-10-14T14:37+02:00', undefined, now), '2026-10-14T12:37:00.000Z');
});
test('legacy sequence enrollment creates due actions at user-selected delays and exact dates', async () => {
  const source = fs.readFileSync(new URL('../../src/lib/scheduling/sequenceSchedule.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}, scheduled = [];
  vm.runInNewContext(code, { exports, Date, require: name => name === 'node:crypto' ? crypto : ({ scheduleAction: async args => { scheduled.push(args); return { id: 'job', scheduled_at: args.scheduledAt, status: 'scheduled' }; } }) });
  const db = { from(table) { return { select() { return this; }, eq() { return this; }, is() { return this; }, order() { return this; },
    then(resolve) { return Promise.resolve({ data: [{ id: 'step1', delay_days: 2, subject: 'One', body: 'First' }, { id: 'step2', scheduled_at: '2030-01-10T16:42:00Z', timezone: 'Europe/Zurich', subject: 'Two', body: 'Second' }] }).then(resolve); },
    async maybeSingle() { return { data: { email: 'owner@example.com' } }; },
  }; } };
  await exports.scheduleSequenceEnrollment(db, { id: 'enrollment', scheduled_by: 'user', tenant_id: 'tenant', contact_id: 'contact', sequence_id: 'sequence', enrolled_at: '2030-01-01T10:00:00Z' }, 'user');
  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].scheduledAt, '2030-01-03T10:00:00.000Z');
  assert.equal(scheduled[1].scheduledAt, '2030-01-10T16:42:00.000Z');
  assert.equal(scheduled[0].args.to, 'owner@example.com');
  assert.equal(scheduled[0].args.text, 'First');
  assert.equal(scheduled[1].metadata.last_step, true);
});
test('MCP scheduled_at stores an action without executing the immediate tool handler', async () => {
  const source = fs.readFileSync(new URL('../../src/lib/mcp/tool-registry.ts', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}, saved = []; let calls = 0;
  const dependencies = {
    '@/lib/scheduling/scheduledActions': { isSchedulableTool: () => true, scheduleAction: async input => { saved.push(input); return { id: 'scheduled' }; }, scheduledActionResponse: job => ({ ok: true, data: job }) },
    '@/lib/mcp/canonicalToolRegistry': { resolveMcpToolName: x => x },
    '@/lib/mcp/mcpToolTelemetry': { normalizeToolName: x => x },
    '@/lib/execution/toolExecutionGuard': { guardToolExecution: async () => ({ allowed: true, policy: { approvalState: 'approved' } }) },
  };
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || {}, console });
  exports.registerTool('email', { name: 'send_email', jsonSchema: { type: 'object', properties: {} }, inputSchema: {}, handler: async () => { calls++; } });
  const result = await exports.executeTool('tenant', 'user', 'send_email', { to: 'owner@example.com', text: 'Frozen', scheduled_at: '2030-01-02T15:43:00', schedule_timezone: 'Europe/Zurich' });
  assert.equal(calls, 0); assert.equal(saved.length, 1);
  assert.equal(saved[0].scheduledAt, '2030-01-02T15:43:00');
  assert.equal(saved[0].timezone, 'Europe/Zurich');
  assert.equal(JSON.parse(result.content[0].text).data.id, 'scheduled');
});
test('temporary social media links are materialized before their scheduled publication', async () => {
  const f = fixture();
  const job = await f.scheduleAction({ tenantId: 'tenant', userId: 'user', toolName: 'create_social_post', args: { caption: 'Exact caption', platform: 'instagram', media_urls: ['https://temporary.example.invalid/image?expires=soon'] }, scheduledAt: '2030-01-02T15:43:00Z' });
  assert.equal(job.args.media_urls[0], 'https://media.example.invalid/asset-frozen');
  assert.equal(job.args.caption, 'Exact caption');
  assert.equal(job.args.publish_now, true);
  assert.equal(f.executions.length, 0);
});
test('sequence enrollment retries have one identity and remain tenant-isolated', () => {
  const id = sequenceEnrollmentIdentity('tenant-a', 'sequence', 'contact');
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(id, sequenceEnrollmentIdentity('tenant-a', 'sequence', 'contact'));
  assert.notEqual(id, sequenceEnrollmentIdentity('tenant-b', 'sequence', 'contact'));
  assert.notEqual(id, sequenceEnrollmentIdentity('tenant-a', 'sequence', 'other-contact'));
});
