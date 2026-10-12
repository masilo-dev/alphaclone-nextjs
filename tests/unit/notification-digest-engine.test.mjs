import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { aggregateDigestEvents } from '../../src/lib/email/notificationDigestAggregation.ts';

test('canonical digest schema has recipient-local idempotency and pending-event indexes', async () => {
  const sql = await fs.readFile('supabase/migrations/20260909120000_notification_digest_engine.sql', 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_digest_events/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.notification_digests/);
  assert.match(sql, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /check_internal_notification_budget/);
  assert.match(sql, /WHERE included_in_digest_id IS NULL/);
});

test('all unclassified internal sends are stopped at the canonical gateway', async () => {
  const source = await fs.readFile('src/lib/email/sendEmailServer.ts', 'utf8');
  assert.match(source, /internalNotificationKind\?: 'digest' \| 'immediate_exception'/);
  assert.match(source, /code: 'DIGEST_REQUIRED'/);
});

test('digest worker claims the unique key before provider delivery and aggregates events', async () => {
  const source = await fs.readFile('src/lib/email/notificationDigestEngine.ts', 'utf8');
  const claim = source.indexOf("from('notification_digests').insert");
  const send = source.indexOf('sendEmailServer({');
  assert.ok(claim > 0 && send > claim);
  assert.match(source, /aggregateDigestEvents\(events\)/);
  assert.match(source, /Math\.max\(0, events\.length - 1\)/);
  assert.match(source, /internalNotificationKind: 'digest'/);
});

test('250 identical MCP success events collapse into one concise summary group', () => {
  const events = Array.from({ length: 250 }, (_, index) => ({
    id: String(index), event_type: 'mcp.action_completed', event_category: 'mcp',
    entity_type: 'lead', entity_id: String(index), source_action: 'create_lead',
    severity: 'info', title: 'Lead added', summary: `Lead ${index} added`,
  }));
  const aggregated = aggregateDigestEvents(events);
  assert.equal(aggregated.length, 1);
  assert.equal(aggregated[0].count, 250);
});

test('default summary schedule is ONE per day at 18:00 local time (max 7/week)', async () => {
  const { resolveDueSummary, normalizeSummaryPreferences, maxSummariesPerWeek } = await import(
    '../../src/lib/email/dailySummaryComposer.ts'
  );

  const defaultPrefs = normalizeSummaryPreferences(null);
  assert.equal(defaultPrefs.schedule, 'daily');
  assert.equal(defaultPrefs.eveningHour, 18);
  assert.equal(defaultPrefs.morningHour, 8);
  assert.equal(maxSummariesPerWeek(defaultPrefs), 7);

  // In UTC timezone at 18:00
  const at18UTC = new Date('2026-10-12T18:15:00.000Z');
  const due18 = resolveDueSummary(at18UTC, 'UTC', defaultPrefs);
  assert.ok(due18);
  assert.equal(due18.type, 'evening');
  assert.equal(due18.date, '2026-10-12');

  // In UTC timezone at 08:00 -> NOT due under default 'daily' schedule
  const at08UTC = new Date('2026-10-12T08:15:00.000Z');
  const due08 = resolveDueSummary(at08UTC, 'UTC', defaultPrefs);
  assert.equal(due08, null);

  // In UTC timezone at 12:00 -> NOT due
  const at12UTC = new Date('2026-10-12T12:00:00.000Z');
  assert.equal(resolveDueSummary(at12UTC, 'UTC', defaultPrefs), null);
});

test('opt-in morning_evening schedule allows up to 14/week (08:00 and 18:00)', async () => {
  const { resolveDueSummary, normalizeSummaryPreferences, maxSummariesPerWeek } = await import(
    '../../src/lib/email/dailySummaryComposer.ts'
  );

  const optInPrefs = normalizeSummaryPreferences({
    summary_schedule: 'morning_evening',
  });
  assert.equal(optInPrefs.schedule, 'morning_evening');
  assert.equal(maxSummariesPerWeek(optInPrefs), 14);

  const at08 = new Date('2026-10-12T08:00:00.000Z');
  const dueMorning = resolveDueSummary(at08, 'UTC', optInPrefs);
  assert.ok(dueMorning);
  assert.equal(dueMorning.type, 'morning');

  const at18 = new Date('2026-10-12T18:00:00.000Z');
  const dueEvening = resolveDueSummary(at18, 'UTC', optInPrefs);
  assert.ok(dueEvening);
  assert.equal(dueEvening.type, 'evening');
});

test('custom summary delivery hour is honored and timezone aware', async () => {
  const { resolveDueSummary, normalizeSummaryPreferences } = await import(
    '../../src/lib/email/dailySummaryComposer.ts'
  );

  const customPrefs = normalizeSummaryPreferences({
    summary_hour: 20, // 20:00 local
  });
  assert.equal(customPrefs.eveningHour, 20);

  // In America/New_York (UTC-4 in October EDT), 20:00 local is 00:00 UTC next day
  const at20EDT = new Date('2026-10-13T00:15:00.000Z');
  const due = resolveDueSummary(at20EDT, 'America/New_York', customPrefs);
  assert.ok(due);
  assert.equal(due.type, 'evening');
  assert.equal(due.date, '2026-10-12');
});

test('clean quiet brief emitted when zero stalled items and zero activity', async () => {
  const { composeSummaryBody, NO_OUTSTANDING_ACTIONS } = await import(
    '../../src/lib/email/dailySummaryComposer.ts'
  );

  const composed = composeSummaryBody({
    type: 'evening',
    date: '2026-10-12',
    activity: [],
    eventCount: 0,
    chaseSections: [],
  });

  assert.equal(composed.isQuiet, true);
  assert.match(composed.bodyHtml, new RegExp(NO_OUTSTANDING_ACTIONS));
  assert.match(composed.bodyText, new RegExp(NO_OUTSTANDING_ACTIONS));
});

test('Universal Chaser stalled items are categorized correctly for owner brief', async () => {
  const { groupChaseItemsForSummary, composeSummaryBody } = await import(
    '../../src/lib/email/dailySummaryComposer.ts'
  );

  const sampleChases = [
    { policy_key: 'project_chaser', severity: 'high', reason_code: 'no_progress', context_snapshot: { name: 'Acme Website Redesign' } },
    { policy_key: 'milestone_chaser', severity: 'critical', reason_code: 'overdue', context_snapshot: { name: 'Phase 1 Frontend Delivery' } },
    { policy_key: 'lead_chaser', severity: 'medium', reason_code: 'no_touch', context_snapshot: { business_name: 'Globex Corp' } },
    { policy_key: 'contract_chaser', severity: 'high', reason_code: 'unsigned', context_snapshot: { title: 'Master Service Agreement' } },
    { policy_key: 'invoice_chaser', severity: 'high', reason_code: 'overdue', context_snapshot: { invoice_number: 'INV-2026-0042' } },
    { policy_key: 'quote_proposal_chaser', severity: 'medium', reason_code: 'viewed_no_decision', context_snapshot: { quote_number: 'Q-1008' } },
  ];

  const sections = groupChaseItemsForSummary(sampleChases);
  const labels = sections.map((s) => s.label);

  assert.ok(labels.includes('Stalled projects'));
  assert.ok(labels.includes('Overdue milestones'));
  assert.ok(labels.includes('Leads and deals needing attention'));
  assert.ok(labels.includes('Contracts awaiting signature'));
  assert.ok(labels.includes('Invoices due or overdue'));
  assert.ok(labels.includes('Quotes awaiting a decision'));

  const composed = composeSummaryBody({
    type: 'evening',
    date: '2026-10-12',
    activity: [{ title: 'Invoice paid', summary: 'INV-2026-0010 paid', severity: 'info', count: 1 }],
    eventCount: 1,
    chaseSections: sections,
  });

  assert.equal(composed.isQuiet, false);
  assert.match(composed.bodyHtml, /Needs your attention \(6\)/);
  assert.match(composed.bodyHtml, /Acme Website Redesign/);
  assert.match(composed.bodyHtml, /Phase 1 Frontend Delivery/);
  assert.match(composed.bodyHtml, /Globex Corp/);
  assert.match(composed.bodyHtml, /INV-2026-0042/);
  assert.match(composed.bodyHtml, /No client or lead has been contacted as a result of these detections/);
});

test('milestone events exist in canonical taxonomy and milestone.completed stops milestone_chaser', async () => {
  const { getCanonicalEvent, chaseStopForEvent } = await import(
    '../../src/lib/events/businessEventTaxonomy.ts'
  );

  const created = getCanonicalEvent('milestone.created');
  assert.ok(created);
  assert.equal(created.category, 'projects');
  assert.equal(created.entityType, 'milestone');

  const completed = getCanonicalEvent('milestone.completed');
  assert.ok(completed);
  assert.deepEqual(chaseStopForEvent('milestone.completed'), {
    entityType: 'milestone',
    outcome: 'completed',
  });
});

